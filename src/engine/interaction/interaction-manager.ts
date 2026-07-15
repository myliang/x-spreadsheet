import type { WorkbookCommand } from '../../core/commands/workbook-command';
import { invalidCommand } from '../../core/commands/validate-command';
import { MAX_STRUCTURE_AXIS_CHANGES } from '../../core/operations/structure';
import type { ChangeSource } from '../../core/types/changes';
import type { CellPoint, Selection, SheetId } from '../../core/types/coordinates';
import { TegoSheetException } from '../../core/errors/tego-sheet-exception';
import { parseClipboardMatrix } from '../../core/operations/clipboard';
import { clampScroll, scrollBy } from '../viewport/scroll-state';
import {
  createRangeSelection,
  createSelectionState,
  extendSelection,
  moveSelection,
  normalizeSelection,
  type SelectionState,
} from '../viewport/selection-state';
import type { ScrollState, ViewportMetrics } from '../ports';
import {
  clipboardDenied,
  matrixToTsv,
  type ClipboardPort,
  type DataTransferPort,
  type InternalClipboardState,
} from './clipboard';
import { isEditableEventTarget, isPrintableKey, navigationKey } from './keyboard';
import {
  extendToRegion,
  localPoint,
  regionAtClientPoint,
  selectionContains,
  selectionForRegion,
} from './pointer';
import { ResourceRegistry, type EventTargetPort } from './resource-registry';
import {
  findResizeBoundary,
  findResizeHandle,
  hiddenRunBefore,
  resizeRange,
  type ResizeAxis,
  type ResizeHandle,
} from './resize';
import { TouchGesture, type TouchPointPort } from './touch';

export interface InteractionRootPort extends EventTargetPort {
  contains(target: unknown): boolean;
  getBoundingClientRect(): { readonly left: number; readonly top: number };
}

export interface InteractionSnapshot {
  readonly viewport: ViewportMetrics;
  readonly selection: SelectionState;
  readonly sheet: SheetId;
  readonly readOnly: boolean;
  readonly epoch?: unknown;
}

export interface InteractionDispatchOutcome {
  readonly status: 'committed' | 'noop';
}

export type FormatRequest = 'bold' | 'italic' | 'underline';

export interface ResizePreview {
  readonly axis: ResizeAxis;
  readonly start: number;
  readonly count: number;
  readonly size: number;
}

export interface InteractionManagerPorts {
  readonly root: InteractionRootPort;
  readonly globalTarget: EventTargetPort;
  readonly clipboard?: ClipboardPort;
  readonly getSnapshot: () => InteractionSnapshot;
  readonly setSelection: (selection: SelectionState, source: 'keyboard' | 'pointer' | 'touch') => void;
  readonly setScroll: (scroll: ScrollState, source: 'pointer' | 'touch') => void;
  readonly dispatch: (command: WorkbookCommand, source: ChangeSource) => InteractionDispatchOutcome;
  readonly readSelection: (selection: Selection) => readonly (readonly string[])[];
  readonly commitEditor: () => boolean;
  readonly requestEdit: (point: CellPoint, initialText: string | undefined, source: 'keyboard' | 'pointer' | 'touch') => void;
  readonly requestDelete: (selection: Selection, source: 'keyboard') => void;
  readonly requestContextMenu: (point: Readonly<{ x: number; y: number }>, selection: Selection) => void;
  readonly requestEnsureVisible: (point: CellPoint) => void;
  readonly requestResizePreview: (preview: ResizePreview | null) => void;
  readonly requestFormat: (format: FormatRequest) => void;
  readonly requestError: (error: TegoSheetException) => void;
  readonly requestCancelTransient: () => void;
  readonly requestViewportResize?: () => void;
  readonly observeRoot?: (callback: () => void) => () => void;
  readonly setTimer?: (callback: () => void, delay: number) => () => void;
  readonly now?: () => number;
  readonly minRowHeight?: number;
  readonly minColumnWidth?: number;
}

export interface InteractionManagerOptions {
  readonly ports: InteractionManagerPorts;
  readonly registry?: ResourceRegistry;
}

interface PointerDrag {
  readonly mode: 'selection';
}

interface ResizeDrag {
  readonly mode: 'resize';
  readonly handle: ResizeHandle;
  readonly start: number;
  readonly range: readonly [start: number, count: number];
  size: number;
}

type DragState = PointerDrag | ResizeDrag;

interface InteractionEventLike {
  readonly altKey?: boolean;
  readonly button: number;
  readonly buttons: number;
  readonly changedTouches?: readonly TouchPointPort[];
  readonly clientX: number;
  readonly clientY: number;
  readonly clipboardData?: DataTransferPort;
  readonly ctrlKey?: boolean;
  readonly deltaX?: number;
  readonly deltaY?: number;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
  readonly key?: string;
  readonly metaKey?: boolean;
  readonly relatedTarget?: unknown;
  readonly shiftKey?: boolean;
  readonly target: unknown;
  readonly targetKind?: string;
  readonly touches?: readonly TouchPointPort[];
  preventDefault?(): void;
  stopPropagation?(): void;
}

function eventLike(event: unknown): InteractionEventLike {
  return event as InteractionEventLike;
}

function samePoint(left: CellPoint, right: CellPoint): boolean {
  return left.row === right.row && left.column === right.column;
}

function sameSelection(left: SelectionState, right: SelectionState): boolean {
  return left.kind === right.kind
    && samePoint(left.anchor, right.anchor)
    && samePoint(left.focus, right.focus)
    && samePoint(left.active, right.active)
    && samePoint(left.range.start, right.range.start)
    && samePoint(left.range.end, right.range.end);
}

function publicSelection(snapshot: InteractionSnapshot): Selection {
  return Object.freeze({
    sheet: snapshot.sheet,
    range: snapshot.selection.range,
    active: snapshot.selection.active,
  });
}

function replacedPasteSnapshot(): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message: 'Clipboard paste target was replaced before clipboard access completed',
    recoverable: true,
  });
}

function appendCleanupError(errors: unknown[], error: unknown): void {
  if (error instanceof AggregateError) errors.push(...error.errors);
  else errors.push(error);
}

function currentTargetInside(root: InteractionRootPort, event: InteractionEventLike): boolean {
  return root.contains(event.target);
}

function previousFloat(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value === 0) return -Number.MIN_VALUE;
  const floatBits = new DataView(new ArrayBuffer(8));
  floatBits.setFloat64(0, value);
  const bits = floatBits.getBigUint64(0);
  floatBits.setBigUint64(0, value > 0 ? bits - 1n : bits + 1n);
  return floatBits.getFloat64(0);
}

export class InteractionManager {
  private readonly ports: InteractionManagerPorts;
  private readonly registry: ResourceRegistry;
  private readonly touch: TouchGesture;
  private focused = false;
  private drag: DragState | null = null;
  private internalClipboard: InternalClipboardState | null = null;

  constructor(options: InteractionManagerOptions) {
    this.ports = options.ports;
    this.registry = options.registry ?? new ResourceRegistry();
    this.touch = new TouchGesture({
      now: this.ports.now ?? (() => Date.now()),
      tap: (point, double) => this.tap(point, double),
      swipe: delta => this.scrollContinuous(delta, 'touch'),
      ...(this.ports.setTimer === undefined ? {} : {
        schedule: (callback: () => void, delay: number): (() => void) => (
          this.scheduleTimer(callback, delay)
        ),
      }),
    });
    try {
      this.bind();
      if (this.ports.observeRoot !== undefined) {
        const callback = this.registry.guard(() => this.ports.requestViewportResize?.());
        this.registry.observer(this.ports.observeRoot(callback));
      }
    } catch (cause) {
      const errors: unknown[] = [cause];
      try {
        this.touch.dispose();
      } catch (error) {
        appendCleanupError(errors, error);
      }
      try {
        this.registry.dispose();
      } catch (error) {
        appendCleanupError(errors, error);
      }
      if (errors.length === 1) throw cause;
      throw new AggregateError(errors, 'Failed to initialize interactions', { cause });
    }
  }

  get active(): boolean {
    return this.registry.active;
  }

  focus(): void {
    if (this.active) this.focused = true;
  }

  blur(): void {
    this.focused = false;
    this.cancelDrag();
  }

  async copy(dataTransfer?: DataTransferPort, cut = false): Promise<boolean> {
    if (!this.active) return false;
    const snapshot = this.ports.getSnapshot();
    if (cut && snapshot.readOnly) return false;
    const selection = publicSelection(snapshot);
    const text = matrixToTsv(this.ports.readSelection(selection));
    this.internalClipboard = Object.freeze({ selection, cut, text });
    if (dataTransfer !== undefined) {
      dataTransfer.clearData?.();
      dataTransfer.setData('text/plain', text);
      return true;
    }
    if (this.ports.clipboard !== undefined) {
      try {
        await this.ports.clipboard.writeText(text);
      } catch (cause) {
        if (this.active) this.ports.requestError(clipboardDenied(cause));
      }
    }
    return true;
  }

  async paste(dataTransfer?: DataTransferPort): Promise<boolean> {
    if (!this.active) return false;
    const snapshot = this.ports.getSnapshot();
    if (snapshot.readOnly) return false;
    const target = publicSelection(snapshot);
    if (dataTransfer !== undefined) {
      this.dispatchExternalPaste(dataTransfer.getData('text/plain'), target);
      return true;
    }
    if (this.internalClipboard !== null) {
      const state = this.internalClipboard;
      const outcome = this.ports.dispatch({
        type: 'paste-internal',
        source: state.selection,
        target,
        mode: 'all',
        cut: state.cut,
      }, 'clipboard');
      if (state.cut && outcome.status === 'committed') this.internalClipboard = null;
      return true;
    }
    if (this.ports.clipboard === undefined) return false;
    const epoch = snapshot.epoch;
    let text: string;
    try {
      text = await this.ports.clipboard.readText();
    } catch (cause) {
      if (this.active) this.ports.requestError(clipboardDenied(cause));
      return true;
    }
    if (!this.active) return true;
    const current = this.ports.getSnapshot();
    if (current.readOnly) return true;
    if (current.sheet !== snapshot.sheet || current.epoch !== epoch) {
      this.ports.requestError(replacedPasteSnapshot());
      return true;
    }
    this.dispatchExternalPaste(text, target);
    return true;
  }

  hideSelection(): boolean {
    if (!this.active) return false;
    const snapshot = this.ports.getSnapshot();
    if (snapshot.readOnly) return false;
    const { selection, viewport, sheet } = snapshot;
    if (selection.kind === 'row'
      || (selection.range.start.column === 0
        && selection.range.end.column === viewport.model.columnCount - 1)) {
      this.ports.dispatch({
        type: 'set-row-hidden',
        sheet,
        row: selection.range.start.row,
        count: selection.range.end.row - selection.range.start.row + 1,
        hidden: true,
      }, 'pointer');
      return true;
    }
    if (selection.kind === 'column'
      || (selection.range.start.row === 0
        && selection.range.end.row === viewport.model.rowCount - 1)) {
      this.ports.dispatch({
        type: 'set-column-hidden',
        sheet,
        column: selection.range.start.column,
        count: selection.range.end.column - selection.range.start.column + 1,
        hidden: true,
      }, 'pointer');
      return true;
    }
    return false;
  }

  unhideBefore(axis: ResizeAxis, boundary: number): boolean {
    if (!this.active) return false;
    const snapshot = this.ports.getSnapshot();
    if (snapshot.readOnly) return false;
    const run = hiddenRunBefore(axis, boundary, snapshot.viewport);
    if (run === null) return false;
    const [start, count] = run;
    if (count > MAX_STRUCTURE_AXIS_CHANGES) {
      this.ports.requestError(invalidCommand(
        `structure workload exceeds the ${MAX_STRUCTURE_AXIS_CHANGES}-index operation limit`,
      ));
      return false;
    }
    this.ports.dispatch(axis === 'row' ? {
      type: 'set-row-hidden', sheet: snapshot.sheet, row: start, count, hidden: false,
    } : {
      type: 'set-column-hidden', sheet: snapshot.sheet, column: start, count, hidden: false,
    }, 'pointer');
    return true;
  }

  dispose(): void {
    if (!this.active) return;
    this.focused = false;
    const errors: unknown[] = [];
    try {
      this.cancelDrag();
    } catch (error) {
      appendCleanupError(errors, error);
    }
    try {
      this.touch.dispose();
    } catch (error) {
      appendCleanupError(errors, error);
    }
    try {
      this.registry.dispose();
    } catch (error) {
      appendCleanupError(errors, error);
    }
    if (errors.length > 0) throw new AggregateError(errors, 'Failed to dispose interactions');
  }

  private bind(): void {
    const { root, globalTarget } = this.ports;
    this.registry.listen(root, 'focusin', () => { this.focused = true; });
    this.registry.listen(root, 'focusout', value => {
      const event = eventLike(value);
      if (!root.contains(event.relatedTarget)) this.blur();
    });
    this.registry.listen(root, 'pointerdown', event => this.pointerDown(eventLike(event)));
    this.registry.listen(root, 'dblclick', event => this.doubleClick(eventLike(event)));
    this.registry.listen(root, 'contextmenu', event => this.contextMenu(eventLike(event)));
    this.registry.listen(root, 'wheel', event => this.wheel(eventLike(event)));
    this.registry.listen(root, 'touchstart', value => {
      const event = eventLike(value);
      this.focused = true;
      this.touch.startGesture(event.touches ?? []);
    });
    this.registry.listen(root, 'touchmove', value => {
      const event = eventLike(value);
      if (this.touch.moveGesture(event.touches ?? []) === true) event.preventDefault?.();
    });
    this.registry.listen(root, 'touchend', value => {
      const event = eventLike(value);
      this.touch.endGesture(event.changedTouches ?? [], event.touches ?? []);
    });
    this.registry.listen(root, 'touchcancel', () => this.touch.cancel());
    this.registry.listen(globalTarget, 'pointerdown', value => {
      const event = eventLike(value);
      if (!currentTargetInside(root, event)) this.blur();
    });
    this.registry.listen(globalTarget, 'touchstart', value => {
      const event = eventLike(value);
      if (!currentTargetInside(root, event)) this.blur();
    });
    this.registry.listen(globalTarget, 'pointermove', event => this.pointerMove(eventLike(event)));
    this.registry.listen(globalTarget, 'pointerup', () => this.pointerUp());
    this.registry.listen(globalTarget, 'pointercancel', () => this.cancelDrag());
    this.registry.listen(globalTarget, 'blur', () => this.blur());
    this.registry.listen(globalTarget, 'resize', () => this.ports.requestViewportResize?.());
    this.registry.listen(globalTarget, 'keydown', event => this.keyDown(eventLike(event)));
    this.registry.listen(globalTarget, 'copy', event => this.clipboardEvent(eventLike(event), false));
    this.registry.listen(globalTarget, 'cut', event => this.clipboardEvent(eventLike(event), true));
    this.registry.listen(globalTarget, 'paste', event => this.pasteEvent(eventLike(event)));
  }

  private setSelection(selection: SelectionState, source: 'keyboard' | 'pointer' | 'touch'): boolean {
    if (!this.active) return false;
    const current = this.ports.getSnapshot().selection;
    if (sameSelection(current, selection)) return false;
    this.ports.setSelection(selection, source);
    this.ports.requestEnsureVisible(selection.active);
    return true;
  }

  private pointerDown(event: InteractionEventLike): void {
    if (event.button !== 0 && event.buttons !== 1) return;
    this.focused = true;
    const snapshot = this.ports.getSnapshot();
    const point = localPoint(event, this.ports.root);
    const handle = findResizeHandle(point, snapshot.viewport);
    if (handle !== null && !snapshot.readOnly) {
      if (!this.ports.commitEditor()) return;
      const range = resizeRange(handle, snapshot.selection);
      if (range[1] > MAX_STRUCTURE_AXIS_CHANGES) {
        this.ports.requestError(invalidCommand(
          `structure workload exceeds the ${MAX_STRUCTURE_AXIS_CHANGES}-index operation limit`,
        ));
        return;
      }
      this.drag = {
        mode: 'resize',
        handle,
        start: handle.axis === 'row' ? point.y : point.x,
        range,
        size: handle.size,
      };
      event.preventDefault?.();
      return;
    }
    const region = regionAtClientPoint(event, this.ports.root, snapshot.viewport);
    if (region === null || !this.ports.commitEditor()) return;
    const selection = event.shiftKey === true
      ? extendToRegion(snapshot.selection, region, snapshot.viewport)
      : selectionForRegion(region, snapshot.viewport);
    this.setSelection(selection, 'pointer');
    this.drag = { mode: 'selection' };
    event.preventDefault?.();
  }

  private pointerMove(event: InteractionEventLike): void {
    if (this.drag === null || event.buttons === 0) return;
    const snapshot = this.ports.getSnapshot();
    if (this.drag.mode === 'selection') {
      const region = regionAtClientPoint(event, this.ports.root, snapshot.viewport);
      if (region !== null) {
        this.setSelection(extendToRegion(snapshot.selection, region, snapshot.viewport), 'pointer');
      }
      return;
    }
    const point = localPoint(event, this.ports.root);
    const position = this.drag.handle.axis === 'row' ? point.y : point.x;
    const minimum = this.drag.handle.axis === 'row'
      ? this.ports.minRowHeight ?? 5
      : this.ports.minColumnWidth ?? 20;
    this.drag.size = Math.max(minimum, this.drag.handle.size + position - this.drag.start);
    const [start, count] = this.drag.range;
    this.ports.requestResizePreview({
      axis: this.drag.handle.axis,
      start,
      count,
      size: this.drag.size,
    });
  }

  private pointerUp(): void {
    if (this.drag?.mode !== 'resize') {
      this.drag = null;
      return;
    }
    const drag = this.drag;
    this.drag = null;
    this.ports.requestResizePreview(null);
    const snapshot = this.ports.getSnapshot();
    if (snapshot.readOnly) return;
    const [start, count] = drag.range;
    this.ports.dispatch(drag.handle.axis === 'row' ? {
      type: 'set-row-height', sheet: snapshot.sheet, row: start, count, height: drag.size,
    } : {
      type: 'set-column-width', sheet: snapshot.sheet, column: start, count, width: drag.size,
    }, 'pointer');
  }

  private cancelDrag(): void {
    const drag = this.drag;
    this.drag = null;
    if (drag === null) return;
    const errors: unknown[] = [];
    if (drag.mode === 'resize') {
      try {
        this.ports.requestResizePreview(null);
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      this.ports.requestCancelTransient();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) throw new AggregateError(errors, 'Failed to cancel transient interactions');
  }

  private doubleClick(event: InteractionEventLike): void {
    const snapshot = this.ports.getSnapshot();
    if (snapshot.readOnly) return;
    const boundary = findResizeBoundary(localPoint(event, this.ports.root), snapshot.viewport);
    if (boundary !== null) {
      if (!this.ports.commitEditor()) return;
      if (this.unhideBefore(boundary.axis, boundary.boundary)) {
        event.preventDefault?.();
        return;
      }
    }
    const region = regionAtClientPoint(event, this.ports.root, snapshot.viewport);
    if (region?.kind !== 'cell' || !this.ports.commitEditor()) return;
    const selection = selectionForRegion(region, snapshot.viewport);
    this.setSelection(selection, 'pointer');
    this.ports.requestEdit(selection.active, undefined, 'pointer');
    event.preventDefault?.();
  }

  private contextMenu(event: InteractionEventLike): void {
    const snapshot = this.ports.getSnapshot();
    const region = regionAtClientPoint(event, this.ports.root, snapshot.viewport);
    if (region === null || !this.ports.commitEditor()) return;
    if (region.kind === 'cell' && !selectionContains(snapshot.selection, region.cell)) {
      this.setSelection(selectionForRegion(region, snapshot.viewport), 'pointer');
    } else if (region.kind !== 'cell') {
      this.setSelection(selectionForRegion(region, snapshot.viewport), 'pointer');
    }
    const current = this.ports.getSnapshot();
    this.ports.requestContextMenu(localPoint(event, this.ports.root), publicSelection(current));
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  private keyDown(event: InteractionEventLike): void {
    if (!this.focused || isEditableEventTarget(event)) return;
    const snapshot = this.ports.getSnapshot();
    const modifier = event.ctrlKey === true || event.metaKey === true;
    const key = String(event.key ?? '');
    const lower = key.toLowerCase();
    let handled = false;
    const direction = navigationKey(key);
    if (direction !== null) {
      if (this.ports.commitEditor()) {
        const next = modifier
          ? this.edgeSelection(snapshot, direction, event.shiftKey === true)
          : event.shiftKey === true
            ? extendSelection(snapshot.selection, this.adjacentFocus(snapshot, direction), snapshot.viewport.model)
            : moveSelection(snapshot.selection, direction, snapshot.viewport.model);
        handled = this.setSelection(next, 'keyboard');
      }
    } else if (modifier && key === ' ') {
      const active = snapshot.selection.active;
      handled = this.setSelection(createRangeSelection(active, active, {
        start: { row: 0, column: active.column },
        end: { row: snapshot.viewport.model.rowCount - 1, column: active.column },
      }, 'column'), 'keyboard');
    } else if (!modifier && event.shiftKey === true && key === ' ') {
      const active = snapshot.selection.active;
      handled = this.setSelection(createRangeSelection(active, active, {
        start: { row: active.row, column: 0 },
        end: { row: active.row, column: snapshot.viewport.model.columnCount - 1 },
      }, 'row'), 'keyboard');
    } else if (key === 'Tab' || key === 'Enter') {
      if (this.ports.commitEditor()) {
        const move = key === 'Tab'
          ? event.shiftKey ? 'left' : 'right'
          : event.shiftKey ? 'up' : 'down';
        handled = this.setSelection(
          moveSelection(snapshot.selection, move, snapshot.viewport.model),
          'keyboard',
        );
      }
    } else if (key === 'Delete' || key === 'Backspace') {
      if (!snapshot.readOnly) this.ports.requestDelete(publicSelection(snapshot), 'keyboard');
      handled = !snapshot.readOnly;
    } else if (key === 'Escape') {
      this.internalClipboard = null;
      this.ports.requestCancelTransient();
      handled = true;
    } else if (key === 'F2') {
      if (!snapshot.readOnly) this.ports.requestEdit(snapshot.selection.active, undefined, 'keyboard');
      handled = !snapshot.readOnly;
    } else if (modifier && lower === 'z') {
      if (!snapshot.readOnly) this.ports.dispatch({ type: event.shiftKey ? 'redo' : 'undo' }, 'keyboard');
      handled = !snapshot.readOnly;
    } else if (modifier && lower === 'y') {
      if (!snapshot.readOnly) this.ports.dispatch({ type: 'redo' }, 'keyboard');
      handled = !snapshot.readOnly;
    } else if (modifier && (lower === 'b' || lower === 'i' || lower === 'u')) {
      if (!snapshot.readOnly) {
        this.ports.requestFormat(lower === 'b' ? 'bold' : lower === 'i' ? 'italic' : 'underline');
      }
      handled = !snapshot.readOnly;
    } else if (modifier && lower === 'a') {
      const active = snapshot.selection.active;
      handled = this.setSelection(createRangeSelection(active, active, {
        start: { row: 0, column: 0 },
        end: {
          row: snapshot.viewport.model.rowCount - 1,
          column: snapshot.viewport.model.columnCount - 1,
        },
      }, 'all'), 'keyboard');
    } else if (isPrintableKey(event)) {
      if (!snapshot.readOnly) this.ports.requestEdit(snapshot.selection.active, key, 'keyboard');
      handled = !snapshot.readOnly;
    }
    if (handled) event.preventDefault?.();
  }

  private adjacentFocus(snapshot: InteractionSnapshot, direction: 'up' | 'down' | 'left' | 'right'): CellPoint {
    const focus = snapshot.selection.focus;
    return {
      row: Math.min(snapshot.viewport.model.rowCount - 1, Math.max(0,
        focus.row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0))),
      column: Math.min(snapshot.viewport.model.columnCount - 1, Math.max(0,
        focus.column + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0))),
    };
  }

  private edgeSelection(
    snapshot: InteractionSnapshot,
    direction: 'up' | 'down' | 'left' | 'right',
    extend: boolean,
  ): SelectionState {
    const point = {
      row: direction === 'up' ? 0
        : direction === 'down' ? snapshot.viewport.model.rowCount - 1
          : snapshot.selection.active.row,
      column: direction === 'left' ? 0
        : direction === 'right' ? snapshot.viewport.model.columnCount - 1
          : snapshot.selection.active.column,
    };
    return extend
      ? extendSelection(snapshot.selection, point, snapshot.viewport.model)
      : normalizeSelection(createSelectionState(point), snapshot.viewport.model);
  }

  private wheel(event: InteractionEventLike): void {
    const deltaX = Number(event.deltaX ?? 0);
    const deltaY = Number(event.deltaY ?? 0);
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    const delta = Math.abs(deltaX) > Math.abs(deltaY)
      ? { x: Math.sign(deltaX), y: 0 }
      : { x: 0, y: Math.sign(deltaY) };
    if ((delta.x !== 0 || delta.y !== 0) && this.scrollStep(delta)) event.preventDefault?.();
  }

  private scrollStep(direction: Readonly<{ x: number; y: number }>): boolean {
    const snapshot = this.ports.getSnapshot();
    const current = snapshot.viewport.scroll;
    const next = {
      x: direction.x === 0 ? current.x : this.axisStep('column', current.x, direction.x, snapshot.viewport),
      y: direction.y === 0 ? current.y : this.axisStep('row', current.y, direction.y, snapshot.viewport),
    };
    const clamped = clampScroll(next, snapshot.viewport);
    if (clamped.x === current.x && clamped.y === current.y) return false;
    this.ports.setScroll(clamped, 'pointer');
    return true;
  }

  private axisStep(axis: ResizeAxis, scroll: number, direction: number, viewport: ViewportMetrics): number {
    const model = viewport.model;
    const frozen = axis === 'row' ? viewport.freeze.row : viewport.freeze.column;
    const count = axis === 'row' ? model.rowCount : model.columnCount;
    const offset = axis === 'row' ? model.rowOffset : model.columnOffset;
    const indexAt = axis === 'row' ? model.rowAt : model.columnAt;
    const start = offset(frozen);
    if (count === 0) return scroll;
    if (direction > 0) {
      const index = indexAt(start + scroll);
      return index === null ? scroll : Math.max(0, offset(Math.min(count, index + 1)) - start);
    }
    if (scroll <= 0) return 0;
    const index = indexAt(previousFloat(start + scroll));
    return index === null || index < frozen ? 0 : Math.max(0, offset(index) - start);
  }

  private scrollContinuous(delta: Readonly<{ x: number; y: number }>, source: 'touch'): boolean {
    const snapshot = this.ports.getSnapshot();
    const next = scrollBy(snapshot.viewport.scroll, delta, snapshot.viewport);
    if (next.x === snapshot.viewport.scroll.x && next.y === snapshot.viewport.scroll.y) return false;
    this.ports.setScroll(next, source);
    return true;
  }

  private tap(point: TouchPointPort, double: boolean): void {
    const snapshot = this.ports.getSnapshot();
    const region = regionAtClientPoint(point, this.ports.root, snapshot.viewport);
    if (region === null || !this.ports.commitEditor()) return;
    const selection = selectionForRegion(region, snapshot.viewport);
    this.setSelection(selection, 'touch');
    if (double && region.kind === 'cell' && !snapshot.readOnly) {
      this.ports.requestEdit(selection.active, undefined, 'touch');
    }
  }

  private clipboardEvent(event: InteractionEventLike, cut: boolean): void {
    if (!this.focused) return;
    if (cut && this.ports.getSnapshot().readOnly) return;
    void this.copy(event.clipboardData, cut);
    event.preventDefault?.();
  }

  private pasteEvent(event: InteractionEventLike): void {
    if (!this.focused || this.ports.getSnapshot().readOnly) return;
    void this.paste(event.clipboardData);
    event.preventDefault?.();
  }

  private dispatchExternalPaste(text: string, target: Selection): void {
    this.ports.dispatch({
      type: 'paste-external',
      target,
      values: parseClipboardMatrix(text),
    }, 'clipboard');
  }

  private scheduleTimer(callback: () => void, delay: number): () => void {
    if (this.ports.setTimer === undefined) return () => {};
    let release = (): void => {};
    const cancel = this.ports.setTimer(this.registry.guard(() => {
      release();
      callback();
    }), delay);
    release = this.registry.timer(cancel);
    return release;
  }
}

export function createInteractionManager(options: InteractionManagerOptions): InteractionManager {
  return new InteractionManager(options);
}
