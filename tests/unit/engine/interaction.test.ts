import { describe, expect, it, vi } from 'vitest';
import { sheetId, type WorkbookCommand } from '../../../src/core';
import {
  createInteractionManager,
  createRangeSelection,
  createSelectionState,
  createSheetGridModel,
  createViewportMetrics,
  normalizeSelection,
  type GridModelPort,
  type InteractionManagerPorts,
  type InteractionSnapshot,
  type SelectionState,
  type ViewportStateInput,
} from '../../../src/engine';
import { ClipboardHarness, DataTransferHarness } from '../../helpers/clipboard-harness';
import { hiddenRunBefore } from '../../../src/engine/interaction/resize';

class FakeTarget {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  parent: FakeTarget | null = null;
  rect = { left: 10, top: 20 };

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  contains(target: unknown): boolean {
    let current = target as FakeTarget | null;
    while (current !== null) {
      if (current === this) return true;
      current = current.parent;
    }
    return false;
  }

  getBoundingClientRect(): { left: number; top: number } {
    return this.rect;
  }

  emit(type: string, event: Record<string, unknown> = {}): Record<string, unknown> {
    const value = {
      button: 0,
      buttons: 1,
      clientX: 71,
      clientY: 46,
      detail: 1,
      target: this,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      ...event,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(value);
    return value;
  }
}

function hugeHiddenRowModel(count: number, hiddenStart: number) {
  const rowOffset = vi.fn((boundary: number) => Math.min(boundary, hiddenStart) * 25);
  const rowAt = vi.fn((coordinate: number) => {
    if (coordinate < 0 || hiddenStart === 0) return null;
    return Math.min(hiddenStart - 1, Math.floor(coordinate / 25));
  });
  const model: GridModelPort = {
    rowCount: count,
    columnCount: 2,
    merges: [],
    rowHeight: row => row < hiddenStart ? 25 : 0,
    columnWidth: () => 100,
    rowOffset,
    columnOffset: boundary => boundary * 100,
    rowAt,
    columnAt: coordinate => Math.min(1, Math.max(0, Math.floor(coordinate / 100))),
    mergeAt: () => null,
  };
  return { model, rowAt, rowOffset };
}

function setup(
  overrides: Partial<InteractionManagerPorts> = {},
  viewportSize: Readonly<ViewportStateInput> = { width: 700, height: 400 },
  modelOverride?: GridModelPort,
) {
  const root = new FakeTarget();
  const globalTarget = new FakeTarget();
  const clipboard = new ClipboardHarness();
  const model = modelOverride ?? createSheetGridModel({
    rows: { len: 6, 1: { hide: true }, 3: { height: 40 } },
    cols: { len: 6, 1: { hide: true }, 3: { width: 140 } },
    merges: ['A1:B2', 'B2:C3'],
  });
  let snapshot: InteractionSnapshot = {
    viewport: createViewportMetrics(model, viewportSize),
    selection: createSelectionState({ row: 0, column: 0 }),
    sheet: sheetId('sheet-1'),
    readOnly: false,
  };
  const commands: WorkbookCommand[] = [];
  const selections: SelectionState[] = [];
  const errors: unknown[] = [];
  const ports: InteractionManagerPorts = {
    root,
    globalTarget,
    clipboard: clipboard.port,
    getSnapshot: () => snapshot,
    setSelection: selection => {
      selections.push(selection);
      snapshot = { ...snapshot, selection };
    },
    setScroll: scroll => {
      snapshot = {
        ...snapshot,
        viewport: createViewportMetrics(model, { ...snapshot.viewport, scroll }),
      };
    },
    dispatch: command => {
      commands.push(command);
      return { status: 'committed' };
    },
    readSelection: () => [['raw', '=A1'], ['0', '']],
    commitEditor: () => true,
    requestEdit: vi.fn(),
    requestDelete: vi.fn(),
    requestContextMenu: vi.fn(),
    requestEnsureVisible: vi.fn(),
    requestResizePreview: vi.fn(),
    requestFormat: vi.fn(),
    requestError: error => errors.push(error),
    requestCancelTransient: vi.fn(),
    ...overrides,
  };
  const manager = createInteractionManager({ ports });
  return {
    clipboard,
    commands,
    errors,
    globalTarget,
    manager,
    ports,
    root,
    selections,
    snapshot: () => snapshot,
  };
}

describe('InteractionManager pointer and selection behavior', () => {
  it('owns and idempotently removes every root/global listener and blocks disposed callbacks', () => {
    const harness = setup();
    const before = [...harness.root.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0)
      + [...harness.globalTarget.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    expect(before).toBeGreaterThan(0);
    harness.manager.dispose();
    harness.manager.dispose();
    const after = [...harness.root.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0)
      + [...harness.globalTarget.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    harness.root.emit('pointerdown', { clientX: 511, clientY: 196 });
    harness.globalTarget.emit('keydown', { key: 'ArrowRight' });
    expect(after).toBe(0);
    expect(harness.selections).toEqual([]);
  });

  it('owns injected observers and touch timers and makes their late callbacks inert', () => {
    let observer!: () => void;
    let timer!: () => void;
    const disconnect = vi.fn();
    const cancelTimer = vi.fn();
    const resize = vi.fn();
    const harness = setup({
      observeRoot: callback => {
        observer = callback;
        return disconnect;
      },
      requestViewportResize: resize,
      setTimer: callback => {
        timer = callback;
        return cancelTimer;
      },
    });
    const touch = { clientX: 71, clientY: 46 };
    harness.root.emit('touchstart', { touches: [touch] });
    harness.root.emit('touchend', { changedTouches: [touch], touches: [] });
    observer();
    harness.globalTarget.emit('resize');
    expect(resize).toHaveBeenCalledTimes(2);

    harness.manager.dispose();
    observer();
    timer();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(cancelTimer).toHaveBeenCalledOnce();
    expect(resize).toHaveBeenCalledTimes(2);
  });

  it('subtracts the root rect, resolves merges, drags on the global target, and commits first', () => {
    const order: string[] = [];
    const harness = setup({
      commitEditor: () => {
        order.push('commit');
        return true;
      },
      setSelection: selection => order.push(`select:${selection.range.end.row},${selection.range.end.column}`),
    });

    harness.root.emit('pointerdown', { clientX: 71, clientY: 46 });
    harness.globalTarget.emit('pointermove', { clientX: 271, clientY: 121, buttons: 1 });
    harness.globalTarget.emit('pointerup', { buttons: 0 });

    expect(order).toEqual(['commit', 'select:1,1', 'select:3,3']);
    harness.manager.dispose();
  });

  it('creates full row, column, and corner selections while preserving an active cell', () => {
    const harness = setup();

    harness.root.emit('pointerdown', { clientX: 20, clientY: 116 });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'row',
      active: { row: 3, column: 0 },
      range: { start: { row: 3, column: 0 }, end: { row: 3, column: 5 } },
    });
    harness.root.emit('pointerdown', { clientX: 340, clientY: 30 });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'column',
      active: { row: 0, column: 3 },
      range: { start: { row: 0, column: 3 }, end: { row: 5, column: 3 } },
    });
    harness.root.emit('pointerdown', { clientX: 20, clientY: 30 });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'all',
      active: { row: 0, column: 0 },
      range: { start: { row: 0, column: 0 }, end: { row: 5, column: 5 } },
    });
    harness.manager.dispose();
  });

  it('extends header selections across rows and columns during window-level drags', () => {
    const harness = setup();

    harness.root.emit('pointerdown', { clientX: 20, clientY: 46 });
    harness.globalTarget.emit('pointermove', { clientX: 20, clientY: 121, buttons: 1 });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'row',
      anchor: { row: 0, column: 0 },
      focus: { row: 3, column: 5 },
      active: { row: 0, column: 0 },
      range: { start: { row: 0, column: 0 }, end: { row: 3, column: 5 } },
    });
    harness.globalTarget.emit('pointerup', { buttons: 0 });

    harness.root.emit('pointerdown', { clientX: 71, clientY: 30 });
    harness.globalTarget.emit('pointermove', { clientX: 340, clientY: 30, buttons: 1 });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'column',
      anchor: { row: 0, column: 0 },
      focus: { row: 5, column: 3 },
      active: { row: 0, column: 0 },
      range: { start: { row: 0, column: 0 }, end: { row: 5, column: 3 } },
    });
    harness.manager.dispose();
  });

  it('shift-extends header selections from the existing anchor without losing a legal active cell', () => {
    const harness = setup();

    harness.root.emit('pointerdown', { clientX: 20, clientY: 116 });
    harness.globalTarget.emit('pointerup', { buttons: 0 });
    harness.root.emit('pointerdown', { clientX: 20, clientY: 46, shiftKey: true });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'row',
      anchor: { row: 3, column: 0 },
      active: { row: 3, column: 0 },
      range: { start: { row: 0, column: 0 }, end: { row: 3, column: 5 } },
    });

    harness.root.emit('pointerdown', { clientX: 340, clientY: 30 });
    harness.globalTarget.emit('pointerup', { buttons: 0 });
    harness.root.emit('pointerdown', { clientX: 71, clientY: 30, shiftKey: true });
    expect(normalizeSelection(
      harness.snapshot().selection,
      harness.snapshot().viewport.model,
    )).toMatchObject({
      kind: 'column',
      anchor: { row: 0, column: 3 },
      active: { row: 0, column: 3 },
      range: { start: { row: 0, column: 0 }, end: { row: 5, column: 3 } },
    });
    harness.manager.dispose();
  });

  it('shift-extends with the two-pass merge union and right-click only reselects outside', () => {
    const menu = vi.fn();
    const harness = setup({ requestContextMenu: menu });
    harness.root.emit('pointerdown', { clientX: 220, clientY: 80, shiftKey: true });
    expect(harness.snapshot().selection.range).toEqual({
      start: { row: 0, column: 0 },
      end: { row: 2, column: 2 },
    });
    const before = harness.selections.length;
    harness.root.emit('contextmenu', { clientX: 220, clientY: 80, button: 2, buttons: 2 });
    expect(harness.selections).toHaveLength(before);
    harness.root.emit('contextmenu', { clientX: 511, clientY: 196, button: 2, buttons: 2 });
    expect(harness.snapshot().selection.active).toEqual({ row: 5, column: 5 });
    expect(menu).toHaveBeenCalledTimes(2);
    harness.manager.dispose();
  });

  it('requests editing on double click without creating UI DOM', () => {
    const edit = vi.fn();
    const harness = setup({ requestEdit: edit });
    harness.root.emit('dblclick', { clientX: 171, clientY: 46 });
    expect(edit).toHaveBeenCalledWith({ row: 0, column: 2 }, undefined, 'pointer');
    harness.manager.dispose();
  });

  it('normalizes merged interior double clicks to the merge anchor before editing', () => {
    const edit = vi.fn();
    const harness = setup({ requestEdit: edit });
    harness.root.emit('dblclick', { clientX: 220, clientY: 82 });
    expect(harness.snapshot().selection.focus).not.toEqual({ row: 0, column: 0 });
    expect(edit).toHaveBeenCalledWith({ row: 0, column: 0 }, undefined, 'pointer');
    harness.manager.dispose();
  });

  it('preserves explicit selection kind, range, and active cell through normalization', () => {
    const harness = setup();
    const selection = createRangeSelection(
      { row: 2, column: 0 },
      { row: 2, column: 5 },
      { start: { row: 2, column: 0 }, end: { row: 2, column: 5 } },
      'row',
      { row: 2, column: 3 },
    );
    expect(normalizeSelection(selection, harness.snapshot().viewport.model)).toMatchObject({
      kind: 'row',
      active: { row: 2, column: 3 },
      range: { start: { row: 2, column: 0 }, end: { row: 2, column: 5 } },
    });
    harness.manager.dispose();
  });
});

describe('InteractionManager keyboard, wheel, and focus behavior', () => {
  it('is focus scoped, ignores editor/IME targets, and only prevents handled keys', () => {
    const harness = setup();
    const outside = harness.globalTarget.emit('keydown', { key: 'ArrowRight' });
    expect(outside.preventDefault).not.toHaveBeenCalled();
    harness.root.emit('focusin');
    const input = new FakeTarget();
    const ignored = harness.globalTarget.emit('keydown', { key: 'ArrowRight', target: input, targetKind: 'input' });
    const composing = harness.globalTarget.emit('keydown', { key: 'ArrowRight', isComposing: true });
    const processKey = harness.globalTarget.emit('keydown', { key: 'ArrowRight', keyCode: 229 });
    const unknown = harness.globalTarget.emit('keydown', { key: 'AudioVolumeUp' });
    const handled = harness.globalTarget.emit('keydown', { key: 'ArrowRight' });
    expect(ignored.preventDefault).not.toHaveBeenCalled();
    expect(composing.preventDefault).not.toHaveBeenCalled();
    expect(processKey.preventDefault).not.toHaveBeenCalled();
    expect(unknown.preventDefault).not.toHaveBeenCalled();
    expect(handled.preventDefault).toHaveBeenCalledOnce();
    expect(harness.snapshot().selection.active).toEqual({ row: 0, column: 2 });
    harness.manager.dispose();
  });

  it('handles navigation, edge/full-axis selection, edit, delete, history and formats', () => {
    const edit = vi.fn();
    const remove = vi.fn();
    const format = vi.fn();
    const ensure = vi.fn();
    const harness = setup({
      requestEdit: edit,
      requestDelete: remove,
      requestFormat: format,
      requestEnsureVisible: ensure,
    });
    harness.root.emit('focusin');

    harness.globalTarget.emit('keydown', { key: 'ArrowDown', shiftKey: true });
    harness.globalTarget.emit('keydown', { key: 'ArrowRight', ctrlKey: true });
    expect(harness.snapshot().selection.active).toEqual({ row: 0, column: 5 });
    harness.globalTarget.emit('keydown', { key: ' ', ctrlKey: true });
    expect(harness.snapshot().selection.range).toMatchObject({
      start: { row: 0, column: 5 }, end: { row: 5, column: 5 },
    });
    harness.globalTarget.emit('keydown', { key: ' ', shiftKey: true });
    expect(harness.snapshot().selection.range).toMatchObject({
      start: { row: 0, column: 0 }, end: { row: 0, column: 5 },
    });
    harness.globalTarget.emit('keydown', { key: 'F2' });
    harness.globalTarget.emit('keydown', { key: 'q' });
    harness.globalTarget.emit('keydown', { key: 'Delete' });
    harness.globalTarget.emit('keydown', { key: 'z', ctrlKey: true });
    harness.globalTarget.emit('keydown', { key: 'y', metaKey: true });
    harness.globalTarget.emit('keydown', { key: 'b', ctrlKey: true });
    harness.globalTarget.emit('keydown', { key: 'i', metaKey: true });
    harness.globalTarget.emit('keydown', { key: 'u', ctrlKey: true });

    expect(edit).toHaveBeenNthCalledWith(1, { row: 0, column: 5 }, undefined, 'keyboard');
    expect(edit).toHaveBeenNthCalledWith(2, { row: 0, column: 5 }, 'q', 'keyboard');
    expect(remove).toHaveBeenCalledOnce();
    expect(harness.commands.map(command => command.type)).toEqual(['undo', 'redo']);
    expect(format.mock.calls.map(call => call[0])).toEqual(['bold', 'italic', 'underline']);
    expect(ensure).toHaveBeenCalled();
    harness.manager.dispose();
  });

  it('commits before Tab/Enter and leaves failed or edge navigation unconsumed', () => {
    const commit = vi.fn().mockReturnValue(false);
    const harness = setup({ commitEditor: commit });
    harness.root.emit('focusin');
    const event = harness.globalTarget.emit('keydown', { key: 'Tab' });
    expect(commit).toHaveBeenCalledOnce();
    expect(harness.snapshot().selection.active).toEqual({ row: 0, column: 0 });
    expect(event.preventDefault).not.toHaveBeenCalled();

    const ensure = vi.fn();
    const edge = setup({ requestEnsureVisible: ensure });
    edge.root.emit('focusin');
    edge.root.emit('pointerdown', { clientX: 71, clientY: 46 });
    edge.globalTarget.emit('pointerup', { buttons: 0 });
    edge.selections.length = 0;
    ensure.mockClear();
    const arrow = edge.globalTarget.emit('keydown', { key: 'ArrowLeft' });
    const tab = edge.globalTarget.emit('keydown', { key: 'Tab', shiftKey: true });
    const enter = edge.globalTarget.emit('keydown', { key: 'Enter', shiftKey: true });
    expect(arrow.preventDefault).not.toHaveBeenCalled();
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(edge.selections).toEqual([]);
    expect(ensure).not.toHaveBeenCalled();
    edge.manager.dispose();
    harness.manager.dispose();
  });

  it('leaves repeated full-column and full-row selection shortcuts unconsumed', () => {
    const ensure = vi.fn();
    const harness = setup({ requestEnsureVisible: ensure });
    harness.root.emit('focusin');

    harness.globalTarget.emit('keydown', { key: ' ', ctrlKey: true });
    harness.selections.length = 0;
    ensure.mockClear();
    const column = harness.globalTarget.emit('keydown', { key: ' ', ctrlKey: true });
    expect(column.preventDefault).not.toHaveBeenCalled();
    expect(harness.selections).toEqual([]);
    expect(ensure).not.toHaveBeenCalled();

    harness.globalTarget.emit('keydown', { key: ' ', shiftKey: true });
    harness.selections.length = 0;
    ensure.mockClear();
    const row = harness.globalTarget.emit('keydown', { key: ' ', shiftKey: true });
    expect(row.preventDefault).not.toHaveBeenCalled();
    expect(harness.selections).toEqual([]);
    expect(ensure).not.toHaveBeenCalled();
    harness.manager.dispose();
  });

  it('uses dominant wheel axis, skips hidden indexes, clamps/snaps and prevents only consumed scroll', () => {
    const harness = setup({}, { width: 260, height: 125 });
    harness.root.emit('focusin');
    const first = harness.root.emit('wheel', { deltaX: 1, deltaY: 30 });
    expect(harness.snapshot().viewport.scroll.y).toBe(25);
    expect(first.preventDefault).toHaveBeenCalledOnce();
    const second = harness.root.emit('wheel', { deltaX: 40, deltaY: 2 });
    expect(harness.snapshot().viewport.scroll.x).toBe(100);
    expect(second.preventDefault).toHaveBeenCalledOnce();
    for (let index = 0; index < 20; index += 1) harness.root.emit('wheel', { deltaX: 40, deltaY: 0 });
    const atEnd = harness.root.emit('wheel', { deltaX: 40, deltaY: 0 });
    expect(atEnd.preventDefault).not.toHaveBeenCalled();
    harness.manager.dispose();
  });

  it('snaps across consecutive hidden indexes in both directions at exact boundaries', () => {
    const harness = setup({}, { width: 260, height: 75 });
    const beforeStart = harness.root.emit('wheel', { deltaX: 0, deltaY: -1 });
    expect(beforeStart.preventDefault).not.toHaveBeenCalled();

    harness.root.emit('wheel', { deltaX: 0, deltaY: 1 });
    expect(harness.snapshot().viewport.scroll.y).toBe(25);
    harness.root.emit('wheel', { deltaX: 0, deltaY: 1 });
    expect(harness.snapshot().viewport.scroll.y).toBe(50);
    harness.root.emit('wheel', { deltaX: 0, deltaY: -1 });
    expect(harness.snapshot().viewport.scroll.y).toBe(25);
    harness.root.emit('wheel', { deltaX: 0, deltaY: -1 });
    expect(harness.snapshot().viewport.scroll.y).toBe(0);
    harness.manager.dispose();
  });

  it('steps remote maximum-sized axes through bounded index lookups', () => {
    const base = createSheetGridModel({
      rows: { len: Number.MAX_SAFE_INTEGER },
      cols: { len: 2 },
    });
    const rowAt = vi.fn(base.rowAt);
    const rowOffset = vi.fn(base.rowOffset);
    const model: GridModelPort = { ...base, rowAt, rowOffset };
    const initial = 1_000_000_000_000;
    const harness = setup({}, {
      width: 260,
      height: 125,
      scroll: { x: 0, y: initial },
    }, model);

    const forward = harness.root.emit('wheel', { deltaX: 0, deltaY: 1 });
    expect(harness.snapshot().viewport.scroll.y).toBe(initial + 25);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(rowAt.mock.calls.length).toBeLessThanOrEqual(1);
    expect(rowOffset.mock.calls.length).toBeLessThanOrEqual(4);

    rowAt.mockClear();
    rowOffset.mockClear();
    harness.root.emit('wheel', { deltaX: 0, deltaY: -1 });
    expect(harness.snapshot().viewport.scroll.y).toBe(initial);
    expect(rowAt.mock.calls.length).toBeLessThanOrEqual(1);
    expect(rowOffset.mock.calls.length).toBeLessThanOrEqual(4);
    harness.manager.dispose();
  });

  it('keeps exact-boundary wheel stepping isolated between manager instances', () => {
    const first = setup({}, {
      width: 260, height: 75, scroll: { x: 0, y: 25 },
    });
    const second = setup({}, {
      width: 260, height: 75, scroll: { x: 0, y: 50 },
    });

    first.root.emit('wheel', { deltaX: 0, deltaY: 1 });
    second.root.emit('wheel', { deltaX: 0, deltaY: -1 });
    expect(first.snapshot().viewport.scroll.y).toBe(50);
    expect(second.snapshot().viewport.scroll.y).toBe(25);
    first.manager.dispose();
    second.manager.dispose();
  });

  it('isolates two focused instances and blur ends active drags', () => {
    const first = setup();
    const second = setup();
    first.root.emit('focusin');
    second.root.emit('focusin');
    first.globalTarget.emit('pointerdown', { target: second.root });
    first.globalTarget.emit('keydown', { key: 'ArrowRight' });
    second.globalTarget.emit('keydown', { key: 'ArrowRight' });
    expect(first.snapshot().selection.active).toEqual({ row: 0, column: 0 });
    expect(second.snapshot().selection.active).toEqual({ row: 0, column: 2 });
    second.root.emit('pointerdown', { clientX: 71, clientY: 46 });
    second.globalTarget.emit('blur');
    second.globalTarget.emit('pointermove', { clientX: 511, clientY: 196, buttons: 1 });
    expect(second.snapshot().selection.active).toEqual({ row: 0, column: 0 });
    first.manager.dispose();
    second.manager.dispose();
  });

  it('uses global touchstart to transfer keyboard focus between roots sharing one target', () => {
    const shared = new FakeTarget();
    const first = setup({ globalTarget: shared });
    const second = setup({ globalTarget: shared });
    const touch = { clientX: 71, clientY: 46 };
    first.root.emit('focusin');
    second.root.emit('touchstart', { touches: [touch] });
    shared.emit('touchstart', { target: second.root, touches: [touch] });
    shared.emit('keydown', { key: 'ArrowRight' });
    expect(first.snapshot().selection.active).toEqual({ row: 0, column: 0 });
    expect(second.snapshot().selection.active).toEqual({ row: 0, column: 2 });
    first.manager.dispose();
    second.manager.dispose();
  });
});

describe('InteractionManager clipboard, touch, resize and hide behavior', () => {
  it('finds first, massive, and ordinary hidden runs with bounded axis lookups', () => {
    const count = Number.MAX_SAFE_INTEGER;
    const massive = hugeHiddenRowModel(count, 1);
    const massiveViewport = createViewportMetrics(massive.model, { width: 300, height: 200 });
    expect(hiddenRunBefore('row', count, massiveViewport)).toEqual([1, count - 1]);
    expect(massive.rowOffset).toHaveBeenCalledTimes(1);
    expect(massive.rowAt).toHaveBeenCalledTimes(1);

    const initial = hugeHiddenRowModel(count, 0);
    expect(hiddenRunBefore(
      'row',
      count,
      createViewportMetrics(initial.model, { width: 300, height: 200 }),
    )).toEqual([0, count]);
    expect(initial.rowOffset).toHaveBeenCalledTimes(1);
    expect(initial.rowAt).toHaveBeenCalledTimes(1);

    const visibleBase = createSheetGridModel({ rows: { len: 3 }, cols: { len: 2 } });
    const visibleRowOffset = vi.fn(visibleBase.rowOffset);
    const visibleRowAt = vi.fn(visibleBase.rowAt);
    const visible: GridModelPort = {
      ...visibleBase,
      rowOffset: visibleRowOffset,
      rowAt: visibleRowAt,
    };
    expect(hiddenRunBefore(
      'row',
      2,
      createViewportMetrics(visible, { width: 300, height: 200 }),
    )).toBeNull();
    expect(visibleRowOffset).toHaveBeenCalledTimes(1);
    expect(visibleRowAt).toHaveBeenCalledTimes(1);
  });

  it('prefers synchronous DataTransfer copy/paste without touching navigator clipboard', async () => {
    const harness = setup();
    harness.root.emit('focusin');
    const transfer = new DataTransferHarness();
    const event = harness.globalTarget.emit('copy', { clipboardData: transfer });
    await Promise.resolve();
    expect(transfer.getData('text/plain')).toBe('raw\t=A1\n0\t');
    expect(harness.clipboard.writes).toBe(0);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    const external = new DataTransferHarness();
    external.setData('text/plain', '"quoted"\tB\r\nC\tD\r\n');
    harness.globalTarget.emit('paste', { clipboardData: external });
    expect(harness.commands.at(-1)).toMatchObject({
      type: 'paste-external',
      values: [['"quoted"', 'B'], ['C', 'D']],
    });
    expect(harness.clipboard.reads).toBe(0);
    harness.manager.dispose();
  });

  it('leaves clipboard keydown to native events and then handles their DataTransfer payloads', async () => {
    const harness = setup();
    harness.root.emit('focusin');
    for (const key of ['c', 'x', 'v']) {
      const keydown = harness.globalTarget.emit('keydown', { key, ctrlKey: true });
      expect(keydown.preventDefault).not.toHaveBeenCalled();
    }
    expect(harness.clipboard.reads).toBe(0);
    expect(harness.clipboard.writes).toBe(0);

    const transfer = new DataTransferHarness();
    const copy = harness.globalTarget.emit('copy', { clipboardData: transfer });
    await Promise.resolve();
    expect(copy.preventDefault).toHaveBeenCalledOnce();
    expect(transfer.getData('text/plain')).toBe('raw\t=A1\n0\t');
    harness.manager.dispose();
  });

  it('treats an explicitly empty DataTransfer paste as external over stale internal state', async () => {
    const harness = setup();
    await harness.manager.copy(new DataTransferHarness());
    await expect(harness.manager.paste(new DataTransferHarness())).resolves.toBe(true);
    expect(harness.commands.at(-1)).toMatchObject({
      type: 'paste-external', values: [['']],
    });
    harness.manager.dispose();
  });

  it('allows copy but blocks cut/paste in readOnly mode', () => {
    const state: { current?: InteractionSnapshot } = {};
    const harness = setup({
      getSnapshot: () => ({ ...state.current!, readOnly: true }),
    });
    state.current = harness.snapshot();
    harness.root.emit('focusin');
    const copy = harness.globalTarget.emit('copy', { clipboardData: new DataTransferHarness() });
    const cut = harness.globalTarget.emit('cut', { clipboardData: new DataTransferHarness() });
    const paste = harness.globalTarget.emit('paste', { clipboardData: new DataTransferHarness() });
    expect(copy.preventDefault).toHaveBeenCalledOnce();
    expect(cut.preventDefault).not.toHaveBeenCalled();
    expect(paste.preventDefault).not.toHaveBeenCalled();
    expect(harness.commands).toEqual([]);
    harness.manager.dispose();
  });

  it('reports one recoverable CLIPBOARD_DENIED error and ignores late promise completion after dispose', async () => {
    const harness = setup();
    harness.root.emit('focusin');
    harness.clipboard.readError = new Error('denied');
    await harness.manager.paste();
    expect(harness.errors).toHaveLength(1);
    expect(harness.errors[0]).toMatchObject({ code: 'CLIPBOARD_DENIED', recoverable: true });

    let resolve!: (value: string) => void;
    const pending = new Promise<string>(done => { resolve = done; });
    const late = setup({ clipboard: { readText: () => pending, writeText: async () => {} } });
    late.root.emit('focusin');
    const lateRequest = late.manager.paste();
    late.manager.dispose();
    resolve('late');
    await lateRequest;
    expect(late.commands).toEqual([]);

    let reject!: (cause: unknown) => void;
    const lateRejection = setup({
      clipboard: {
        readText: () => new Promise((_, fail) => { reject = fail; }),
        writeText: async () => {},
      },
    });
    const rejected = lateRejection.manager.paste();
    lateRejection.manager.dispose();
    reject(new Error('late denial'));
    await rejected;
    expect(lateRejection.errors).toEqual([]);
    harness.manager.dispose();
  });

  it('keeps the async paste target snapshot, rejects a replaced epoch, and does not relabel callback errors', async () => {
    let resolveFirst!: (value: string) => void;
    const state: { current?: InteractionSnapshot } = {};
    const epoch = {};
    const first = setup({
      getSnapshot: () => state.current!,
      clipboard: {
        readText: () => new Promise(done => { resolveFirst = done; }),
        writeText: async () => {},
      },
    });
    state.current = { ...first.snapshot(), epoch };
    first.root.emit('focusin');
    const request = first.manager.paste();
    state.current = {
      ...state.current,
      selection: createSelectionState({ row: 4, column: 4 }),
    };
    resolveFirst('snapshot');
    await request;
    expect(first.commands.at(-1)).toMatchObject({
      type: 'paste-external',
      target: { active: { row: 0, column: 0 } },
    });
    first.manager.dispose();

    let resolveSecond!: (value: string) => void;
    let replacement!: InteractionSnapshot;
    const second = setup({
      getSnapshot: () => replacement,
      clipboard: {
        readText: () => new Promise(done => { resolveSecond = done; }),
        writeText: async () => {},
      },
    });
    replacement = { ...second.snapshot(), epoch: {} };
    const rejected = second.manager.paste();
    replacement = { ...replacement, epoch: {} };
    resolveSecond('replaced');
    await rejected;
    expect(second.commands).toEqual([]);
    expect(second.errors).toHaveLength(1);
    expect(second.errors[0]).toMatchObject({ code: 'INVALID_COMMAND', recoverable: true });
    second.manager.dispose();

    const callbackError = new Error('consumer callback failed');
    const throwing = setup({
      clipboard: { readText: async () => 'value', writeText: async () => {} },
      dispatch: () => { throw callbackError; },
    });
    await expect(throwing.manager.paste()).rejects.toBe(callbackError);
    expect(throwing.errors).toEqual([]);
    throwing.manager.dispose();

    const errorCallback = new Error('error callback failed');
    const throwingErrorCallback = setup({
      clipboard: {
        readText: async () => { throw new Error('denied'); },
        writeText: async () => {},
      },
      requestError: () => { throw errorCallback; },
    });
    await expect(throwingErrorCallback.manager.paste()).rejects.toBe(errorCallback);
    throwingErrorCallback.manager.dispose();
  });

  it('silently cancels navigator paste when readOnly becomes true during clipboard access', async () => {
    let resolve!: (value: string) => void;
    const state: { current?: InteractionSnapshot } = {};
    const harness = setup({
      getSnapshot: () => state.current!,
      clipboard: {
        readText: () => new Promise(done => { resolve = done; }),
        writeText: async () => {},
      },
    });
    state.current = harness.snapshot();
    const request = harness.manager.paste();
    state.current = { ...state.current, readOnly: true };
    resolve('must not dispatch');

    await expect(request).resolves.toBe(true);
    expect(harness.commands).toEqual([]);
    expect(harness.errors).toEqual([]);
    harness.manager.dispose();
  });

  it('supports tap, double-tap, dominant swipe, threshold, cancel and multitouch', () => {
    let now = 0;
    const edit = vi.fn();
    const harness = setup({ now: () => now, requestEdit: edit }, { width: 260, height: 125 });
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y });
    harness.root.emit('touchstart', { touches: [touch(71, 46)] });
    harness.root.emit('touchend', { changedTouches: [touch(71, 46)], touches: [] });
    now = 200;
    harness.root.emit('touchstart', { touches: [touch(71, 46)] });
    harness.root.emit('touchend', { changedTouches: [touch(71, 46)], touches: [] });
    expect(edit).toHaveBeenCalledOnce();

    harness.root.emit('touchstart', { touches: [touch(200, 100)] });
    harness.root.emit('touchmove', { touches: [touch(189, 98)], changedTouches: [touch(189, 98)] });
    expect(harness.snapshot().viewport.scroll.x).toBeGreaterThan(0);
    const before = harness.snapshot().viewport.scroll;
    harness.root.emit('touchcancel');
    harness.root.emit('touchmove', { touches: [touch(100, 100)], changedTouches: [touch(100, 100)] });
    expect(harness.snapshot().viewport.scroll).toEqual(before);
    harness.root.emit('touchstart', { touches: [touch(1, 1), touch(2, 2)] });
    harness.root.emit('touchend', { changedTouches: [touch(1, 1)], touches: [] });
    expect(edit).toHaveBeenCalledOnce();
    harness.manager.dispose();
  });

  it('normalizes merged interior double taps to the merge anchor before editing', () => {
    let now = 0;
    const edit = vi.fn();
    const harness = setup({ now: () => now, requestEdit: edit });
    const point = { clientX: 220, clientY: 82 };
    harness.root.emit('touchstart', { touches: [point] });
    harness.root.emit('touchend', { changedTouches: [point], touches: [] });
    now = 200;
    harness.root.emit('touchstart', { touches: [point] });
    harness.root.emit('touchend', { changedTouches: [point], touches: [] });
    expect(harness.snapshot().selection.focus).not.toEqual({ row: 0, column: 0 });
    expect(edit).toHaveBeenCalledWith({ row: 0, column: 0 }, undefined, 'touch');
    harness.manager.dispose();
  });

  it('resizes every selected index in one batch command, clamps preview, and cancel does not commit', () => {
    const preview = vi.fn();
    const state: { current?: InteractionSnapshot } = {};
    const harness = setup({
      getSnapshot: () => state.current!,
      requestResizePreview: preview,
      minColumnWidth: 30,
    });
    state.current = {
      ...harness.snapshot(),
      selection: createSelectionState({ row: 0, column: 2 }, { row: 4, column: 4 }),
    };
    harness.root.emit('pointerdown', { clientX: 270, clientY: 30 });
    harness.globalTarget.emit('pointermove', { clientX: 100, clientY: 30, buttons: 1 });
    expect(preview).toHaveBeenLastCalledWith({ axis: 'column', start: 2, count: 3, size: 30 });
    harness.globalTarget.emit('pointerup', { buttons: 0 });
    expect(harness.commands.at(-1)).toEqual({
      type: 'set-column-width', sheet: sheetId('sheet-1'), column: 2, count: 3, width: 30,
    });

    const count = harness.commands.length;
    harness.root.emit('pointerdown', { clientX: 20, clientY: 95 });
    harness.globalTarget.emit('pointercancel');
    expect(harness.commands).toHaveLength(count);
    harness.manager.dispose();
  });

  it('drops a resize commit when readOnly becomes true during the drag', () => {
    let snapshot!: InteractionSnapshot;
    const preview = vi.fn();
    const harness = setup({
      getSnapshot: () => snapshot,
      requestResizePreview: preview,
    });
    snapshot = harness.snapshot();
    harness.root.emit('pointerdown', { clientX: 270, clientY: 30 });
    harness.globalTarget.emit('pointermove', { clientX: 300, clientY: 30, buttons: 1 });
    snapshot = { ...snapshot, readOnly: true };
    harness.globalTarget.emit('pointerup', { buttons: 0 });
    expect(preview).toHaveBeenLastCalledWith(null);
    expect(harness.commands).toEqual([]);
    harness.manager.dispose();
  });

  it('does not start resize or unhide mutations when the active editor refuses to commit', () => {
    const commit = vi.fn().mockReturnValue(false);
    const preview = vi.fn();
    const resize = setup({ commitEditor: commit, requestResizePreview: preview });
    const resizeDown = resize.root.emit('pointerdown', { clientX: 270, clientY: 30 });
    resize.globalTarget.emit('pointermove', { clientX: 320, clientY: 30, buttons: 1 });
    resize.globalTarget.emit('pointerup', { buttons: 0 });
    expect(commit).toHaveBeenCalledOnce();
    expect(resizeDown.preventDefault).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(resize.commands).toEqual([]);
    resize.manager.dispose();

    const model = createSheetGridModel({
      rows: { len: 4, 1: { hide: true }, 2: { hide: true } },
      cols: { len: 4 },
    });
    const unhide = setup({ commitEditor: commit }, { width: 700, height: 400 }, model);
    commit.mockClear();
    const doubleClick = unhide.root.emit('dblclick', { clientX: 20, clientY: 70 });
    expect(commit).toHaveBeenCalledOnce();
    expect(doubleClick.preventDefault).not.toHaveBeenCalled();
    expect(unhide.commands).toEqual([]);
    unhide.manager.dispose();
  });

  it('rejects oversized resize and unhide ranges before preview or dispatch', () => {
    const model = createSheetGridModel({ rows: { len: 300_002 }, cols: { len: 300_002 } });
    const state: { current?: InteractionSnapshot } = {};
    const preview = vi.fn();
    const harness = setup({
      getSnapshot: () => state.current!,
      requestResizePreview: preview,
    }, { width: 700, height: 400 }, model);
    state.current = {
      ...harness.snapshot(),
      selection: createSelectionState({ row: 0, column: 0 }, { row: 0, column: 250_000 }),
    };
    const down = harness.root.emit('pointerdown', { clientX: 170, clientY: 30 });
    harness.globalTarget.emit('pointermove', { clientX: 200, clientY: 30, buttons: 1 });
    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    expect(harness.commands).toEqual([]);
    expect(harness.errors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND', recoverable: true });
    harness.manager.dispose();

    const huge = hugeHiddenRowModel(250_002, 1);
    const unhide = setup({}, { width: 700, height: 400 }, huge.model);
    expect(unhide.manager.unhideBefore('row', 250_002)).toBe(false);
    expect(unhide.commands).toEqual([]);
    expect(unhide.errors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND', recoverable: true });
    unhide.manager.dispose();
  });

  it('hides only full-axis selections and unhides the contiguous preceding hidden run in one command', () => {
    let snapshot!: InteractionSnapshot;
    const harness = setup({ getSnapshot: () => snapshot });
    snapshot = {
      ...harness.snapshot(),
      selection: {
        ...createSelectionState({ row: 1, column: 0 }, { row: 2, column: 5 }),
        active: { row: 1, column: 0 },
      },
    };
    expect(harness.manager.hideSelection()).toBe(true);
    expect(harness.commands.at(-1)).toEqual({
      type: 'set-row-hidden', sheet: sheetId('sheet-1'), row: 1, count: 2, hidden: true,
    });
    snapshot = { ...snapshot, selection: createSelectionState({ row: 1, column: 1 }, { row: 2, column: 2 }) };
    expect(harness.manager.hideSelection()).toBe(false);
    expect(harness.manager.unhideBefore('row', 2)).toBe(true);
    expect(harness.commands.at(-1)).toEqual({
      type: 'set-row-hidden', sheet: sheetId('sheet-1'), row: 1, count: 1, hidden: false,
    });
    harness.manager.dispose();
  });

  it('double-clicks hidden header boundaries to unhide only the preceding contiguous run', () => {
    const edit = vi.fn();
    const model = createSheetGridModel({
      rows: { len: 6, 1: { hide: true }, 2: { hide: true }, 4: { hide: true } },
      cols: { len: 6, 1: { hide: true }, 2: { hide: true }, 4: { hide: true } },
    });
    const harness = setup({ requestEdit: edit }, { width: 700, height: 400 }, model);

    const row = harness.root.emit('dblclick', { clientX: 20, clientY: 70 });
    expect(row.preventDefault).toHaveBeenCalledOnce();
    expect(harness.commands.at(-1)).toEqual({
      type: 'set-row-hidden', sheet: sheetId('sheet-1'), row: 1, count: 2, hidden: false,
    });
    const column = harness.root.emit('dblclick', { clientX: 170, clientY: 30 });
    expect(column.preventDefault).toHaveBeenCalledOnce();
    expect(harness.commands.at(-1)).toEqual({
      type: 'set-column-hidden', sheet: sheetId('sheet-1'), column: 1, count: 2, hidden: false,
    });
    expect(edit).not.toHaveBeenCalled();
    harness.manager.dispose();
  });

  it('unhides an initial hidden run without treating its boundary as a resize handle', () => {
    const preview = vi.fn();
    const model = createSheetGridModel({
      rows: { len: 4 },
      cols: { len: 6, 0: { hide: true }, 1: { hide: true }, 2: { hide: true } },
    });
    const harness = setup(
      { requestResizePreview: preview },
      { width: 700, height: 400 },
      model,
    );

    harness.root.emit('pointerdown', { clientX: 70, clientY: 30 });
    harness.globalTarget.emit('pointermove', { clientX: 100, clientY: 30, buttons: 1 });
    harness.globalTarget.emit('pointerup', { buttons: 0 });
    expect(preview).not.toHaveBeenCalled();
    expect(harness.commands).toEqual([]);

    const event = harness.root.emit('dblclick', { clientX: 70, clientY: 30 });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(harness.commands).toEqual([{
      type: 'set-column-hidden', sheet: sheetId('sheet-1'), column: 0, count: 3, hidden: false,
    }]);
    harness.manager.dispose();
  });

  it('does not dispatch hidden-boundary double-clicks in readOnly mode', () => {
    const state: { current?: InteractionSnapshot } = {};
    const model = createSheetGridModel({
      rows: { len: 4, 1: { hide: true }, 2: { hide: true } },
      cols: { len: 4 },
    });
    const harness = setup({ getSnapshot: () => state.current! }, { width: 700, height: 400 }, model);
    state.current = { ...harness.snapshot(), readOnly: true };
    const event = harness.root.emit('dblclick', { clientX: 20, clientY: 70 });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(harness.commands).toEqual([]);
    harness.manager.dispose();
  });
});
