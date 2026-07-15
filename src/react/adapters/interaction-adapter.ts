import type { WorkbookController } from '../../core/controller/workbook-controller';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import {
  TegoSheetException,
  type CellPoint,
  type ChangeSource,
  type Selection,
} from '../../core';
import {
  createInteractionManager,
  type ClipboardPort,
  type InteractionDispatchOutcome,
  type InteractionManager,
  type InteractionRootPort,
  type SelectionState,
} from '../../engine';
import type { EventDispatcher } from './event-dispatcher';
import type { EngineAdapter } from './engine-adapter';

export interface InteractionAdapterOptions {
  readonly controller: WorkbookController;
  readonly dispatcher: EventDispatcher;
  readonly engine: EngineAdapter;
  readonly root: HTMLElement;
  readonly surface: HTMLElement;
  readonly globalTarget: Window;
  readonly contextMenuEnabled?: () => boolean;
  readonly minimumColumnWidth?: number;
  readonly onSelectionChange?: (selection: Selection | null) => void;
  readonly onViewportChange?: () => void;
  readonly commitEditor?: (selectionAfterCommit?: EditorSelectionTarget) => EditorCommitResult;
  readonly requestCancelTransient?: () => void;
  readonly requestContextMenu?: (point: Readonly<{ readonly x: number; readonly y: number }>, selection: Selection) => void;
  readonly requestDelete?: (selection: Selection, source: ChangeSource) => void;
  readonly requestEdit?: (point: CellPoint, initialText: string | undefined, source: ChangeSource) => void;
  readonly requestFormat?: (format: 'bold' | 'italic' | 'underline') => void;
  readonly requestSurfaceFocus?: () => void;
}

export interface EditorCommitResult {
  readonly allow: boolean;
}

export interface EditorSelectionTarget {
  readonly selection: Selection;
  readonly state: SelectionState;
}

function rootPort(root: HTMLElement, surface: HTMLElement): InteractionRootPort {
  return {
    addEventListener: (type, listener, options) => root.addEventListener(
      type,
      listener as EventListener,
      options as boolean | AddEventListenerOptions | undefined,
    ),
    removeEventListener: (type, listener, options) => root.removeEventListener(
      type,
      listener as EventListener,
      options as boolean | EventListenerOptions | undefined,
    ),
    contains: target => contains(root, target),
    getBoundingClientRect: () => {
      const rect = surface.getBoundingClientRect();
      return surface.clientWidth > 0 || surface.clientHeight > 0 || rect.width > 0 || rect.height > 0
        ? rect
        : root.getBoundingClientRect();
    },
  };
}

function contains(root: HTMLElement, target: unknown): boolean {
  try {
    return root.contains(target as Node | null);
  } catch {
    return false;
  }
}

function clipboardPort(): ClipboardPort | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const clipboard = navigator.clipboard;
  if (clipboard === undefined) return undefined;
  return {
    readText: () => clipboard.readText(),
    writeText: text => clipboard.writeText(text),
  };
}

function committed(outcome: ReturnType<EventDispatcher['dispatchUi']>): InteractionDispatchOutcome {
  return { status: outcome.status === 'committed' ? 'committed' : 'noop' };
}

function observeRoot(root: HTMLElement, callback: () => void): () => void {
  const observer = new ResizeObserver(callback);
  try {
    observer.observe(root);
  } catch (cause) {
    try {
      observer.disconnect();
    } catch (cleanupError) {
      throw new AggregateError(
        [cause, cleanupError],
        'ResizeObserver setup and rollback cleanup failed',
        { cause },
      );
    }
    throw cause;
  }
  return () => observer.disconnect();
}

export function createInteractionAdapter(
  options: InteractionAdapterOptions,
): InteractionManager | null {
  const initialSnapshot = options.engine.interactionSnapshot();
  if (initialSnapshot === null) return null;
  const report = (error: TegoSheetException) => options.dispatcher.reportUiError(error.error);
  const selectionTarget = (state: SelectionState): EditorSelectionTarget => ({
    state,
    selection: {
      sheet: initialSnapshot.sheet,
      range: state.range,
      active: state.active,
    },
  });
  return createInteractionManager({
    ports: {
      root: rootPort(options.root, options.surface),
      globalTarget: options.globalTarget as unknown as InteractionRootPort,
      clipboard: clipboardPort(),
      getSnapshot: () => {
        const snapshot = options.engine.interactionSnapshot();
        if (snapshot === null) {
          throw new TegoSheetException({
            code: 'INVALID_COMMAND',
            message: 'The active sheet cannot receive interactions',
            recoverable: true,
          });
        }
        return snapshot;
      },
      setSelection(selection) {
        options.engine.setSelection(selection);
        const current = options.engine.publicSelection();
        if (current !== null) {
          options.onSelectionChange?.(current);
          options.dispatcher.emitSelectionChange(current);
        }
      },
      setScroll: scroll => {
        options.engine.setScroll(scroll);
        options.onViewportChange?.();
      },
      dispatch: (command: WorkbookCommand, source) => committed(
        options.dispatcher.dispatchUi(command, source),
      ),
      readSelection: (selection: Selection) => options.engine.readSelection(selection),
      commitEditor: selection => {
        const next = selection === undefined ? undefined : selectionTarget(selection);
        const result = options.commitEditor?.(next) ?? { allow: true };
        return result.allow;
      },
      requestEdit: (point, initialText, source) => options.requestEdit?.(point, initialText, source),
      requestDelete: (selection, source) => options.requestDelete?.(selection, source),
      requestContextMenu: (point, selection) => options.requestContextMenu?.(point, selection),
      requestSurfaceFocus: () => {
        if (options.requestSurfaceFocus === undefined) {
          options.root.focus({ preventScroll: true });
        } else options.requestSurfaceFocus();
      },
      requestEnsureVisible(point) {
        options.engine.ensureVisible(point);
        options.onViewportChange?.();
      },
      requestResizePreview() {
        // Resize preview is transient React chrome state.
      },
      requestFormat: format => options.requestFormat?.(format),
      requestError: report,
      requestCancelTransient: () => options.requestCancelTransient?.(),
      requestViewportResize: () => {
        options.engine.recalculateLayout();
        options.onViewportChange?.();
      },
      contextMenuEnabled: options.contextMenuEnabled,
      classifyInteractionTarget(target) {
        if (target === options.root || target === options.surface) return 'surface';
        if (!contains(options.root, target)) return 'outside';
        return contains(options.surface, target) ? 'surface' : 'chrome';
      },
      minColumnWidth: options.minimumColumnWidth,
      ...(typeof ResizeObserver === 'undefined' ? {} : {
        observeRoot: (callback: () => void) => observeRoot(options.surface, callback),
      }),
      setTimer(callback, delay) {
        const id = options.globalTarget.setTimeout(callback, delay);
        return () => options.globalTarget.clearTimeout(id);
      },
    },
  });
}
