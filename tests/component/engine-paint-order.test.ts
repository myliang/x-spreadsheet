import { afterEach, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../src/core/controller/workbook-controller';
import { createSelectionState } from '../../src/engine';
import { createEngineAdapter } from '../../src/react/adapters/engine-adapter';
import { createEventDispatcher } from '../../src/react/adapters/event-dispatcher';
import { createCanvasHarness } from '../helpers/canvas-harness';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('stages the target selection before callbacks and paints only that target snapshot', () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const root = document.createElement('div');
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 300 },
  });
  const canvas = createCanvasHarness();
  const controller = new WorkbookController({ rows: { len: 2 }, cols: { len: 3 } });
  const sheet = controller.getSheetIds()[0]!;
  const engine = createEngineAdapter({
    root,
    canvas: canvas.canvas as unknown as HTMLCanvasElement,
  });
  engine.render(controller.getSnapshot(), sheet);
  frames.shift()!(0);
  canvas.operations.length = 0;
  const targetState = createSelectionState({ row: 0, column: 1 });
  const target = { sheet, range: targetState.range, active: targetState.active };
  const order: string[] = [];
  const dispatcher = createEventDispatcher({
    controller,
    getCallbacks: () => ({
      onChange: () => order.push('change'),
      onCellEdit: () => order.push('cell-edit'),
      onSelectionChange: () => {
        expect(engine.publicSelection()?.active.column).toBe(1);
        order.push('selection');
      },
    }),
    schedulePaint: () => {
      expect(engine.publicSelection()?.active.column).toBe(1);
      order.push('paint');
      engine.render(controller.getSnapshot(), sheet);
    },
  });

  dispatcher.dispatchUi(
    { type: 'set-cell-text', address: { sheet, row: 0, column: 0 }, text: 'committed' },
    'keyboard',
    {
      selectionAfterCommit: target,
      beforeSelectionNotify: () => { engine.stageSelection(targetState); },
    },
  );
  frames.shift()!(1);

  expect(order).toEqual(['change', 'cell-edit', 'selection', 'paint']);
  const selectionStrokes = canvas.operations.filter(operation => operation.name === 'strokeRect');
  expect(selectionStrokes.at(-1)?.args.slice(0, 4)).toEqual([160, 25, 100, 25]);
  engine.dispose();
});

it('@parity:view.scroll-sync stages offscreen selection and scroll together without scheduling an early paint', () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const root = document.createElement('div');
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 180 },
    clientHeight: { configurable: true, value: 100 },
  });
  const canvas = createCanvasHarness();
  const controller = new WorkbookController({ rows: { len: 2 }, cols: { len: 3 } });
  const sheet = controller.getSheetIds()[0]!;
  const engine = createEngineAdapter({
    root,
    canvas: canvas.canvas as unknown as HTMLCanvasElement,
  });
  engine.render(controller.getSnapshot(), sheet);
  frames.shift()!(0);
  canvas.operations.length = 0;

  const target = createSelectionState({ row: 0, column: 2 });
  engine.stageSelection(target);

  expect(engine.publicSelection()?.active).toEqual({ row: 0, column: 2 });
  expect(engine.interactionSnapshot()!.viewport.scroll.x).toBeGreaterThan(0);
  expect(frames).toEqual([]);
  expect(canvas.operations).toEqual([]);
  engine.dispose();
});

it('suppresses repeated paints for a failed controller snapshot and retries on explicit layout recovery', () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const root = document.createElement('div');
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 180 },
    clientHeight: { configurable: true, value: 100 },
  });
  const canvas = createCanvasHarness();
  const context = canvas.canvas.getContext('2d')!;
  const failure = new Error('paint failed');
  Object.defineProperty(context, 'clearRect', {
    configurable: true,
    value: () => { throw failure; },
  });
  const controller = new WorkbookController({ rows: { len: 2 }, cols: { len: 3 } });
  const sheet = controller.getSheetIds()[0]!;
  const onRenderError = vi.fn();
  const engine = createEngineAdapter({
    root,
    canvas: canvas.canvas as unknown as HTMLCanvasElement,
    onRenderError,
  });
  const snapshot = controller.getSnapshot();

  engine.render(snapshot, sheet);
  expect(() => frames.shift()!(0)).not.toThrow();
  expect(onRenderError).toHaveBeenCalledOnce();
  expect(onRenderError).toHaveBeenCalledWith(failure);

  engine.setSelection(createSelectionState({ row: 0, column: 1 }));
  engine.render(snapshot, sheet);
  expect(frames).toEqual([]);

  Object.defineProperty(context, 'clearRect', {
    configurable: true,
    value: vi.fn(),
  });
  engine.recalculateLayout();
  expect(frames).toHaveLength(1);
  expect(() => frames.shift()!(1)).not.toThrow();
  expect(onRenderError).toHaveBeenCalledOnce();
  engine.dispose();
});
