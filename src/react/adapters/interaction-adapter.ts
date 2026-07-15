import type { WorkbookController } from '../../core/controller/workbook-controller';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import {
  TegoSheetException,
  type CellPoint,
  type Selection,
} from '../../core';
import {
  createInteractionManager,
  type ClipboardPort,
  type InteractionDispatchOutcome,
  type InteractionManager,
  type InteractionRootPort,
} from '../../engine';
import type { EventDispatcher } from './event-dispatcher';
import type { EngineAdapter } from './engine-adapter';

export interface InteractionAdapterOptions {
  readonly controller: WorkbookController;
  readonly dispatcher: EventDispatcher;
  readonly engine: EngineAdapter;
  readonly root: HTMLElement;
  readonly globalTarget: Window;
  readonly contextMenuEnabled?: () => boolean;
  readonly minimumColumnWidth?: number;
  readonly onSelectionChange?: (selection: Selection | null) => void;
}

function rootPort(root: HTMLElement): InteractionRootPort {
  return root as unknown as InteractionRootPort;
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
  if (options.engine.interactionSnapshot() === null) return null;
  const report = (error: TegoSheetException) => options.dispatcher.reportUiError(error.error);
  return createInteractionManager({
    ports: {
      root: rootPort(options.root),
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
      setScroll: scroll => options.engine.setScroll(scroll),
      dispatch: (command: WorkbookCommand, source) => committed(
        options.dispatcher.dispatchUi(command, source),
      ),
      readSelection: (selection: Selection) => options.engine.readSelection(selection),
      commitEditor: () => true,
      requestEdit(point: CellPoint, initialText) {
        const snapshot = options.engine.interactionSnapshot();
        if (snapshot === null || initialText === undefined) return;
        options.dispatcher.dispatchUi({
          type: 'set-cell-text',
          address: { sheet: snapshot.sheet, ...point },
          text: initialText,
        }, 'keyboard');
      },
      requestDelete() {
        // The React editor and range-clear transaction are assembled with the chrome layer.
      },
      requestContextMenu() {
        // Context-menu UI is owned by React and is assembled in the chrome task.
      },
      requestEnsureVisible() {
        // The engine retains the current viewport until scroll chrome is assembled.
      },
      requestResizePreview() {
        // Resize preview is transient React chrome state.
      },
      requestFormat() {
        // Formatting controls are assembled with the toolbar.
      },
      requestError: report,
      requestCancelTransient() {
        // No React overlays exist in the Task 15 runtime.
      },
      requestViewportResize: () => options.engine.recalculateLayout(),
      contextMenuEnabled: options.contextMenuEnabled,
      minColumnWidth: options.minimumColumnWidth,
      ...(typeof ResizeObserver === 'undefined' ? {} : {
        observeRoot: (callback: () => void) => observeRoot(options.root, callback),
      }),
      setTimer(callback, delay) {
        const id = options.globalTarget.setTimeout(callback, delay);
        return () => options.globalTarget.clearTimeout(id);
      },
    },
  });
}
