import { expect, it } from 'vitest';
import { CanvasEngine, createSheetGridModel, createViewportMetrics } from '../../src/engine';
import { createCanvasHarness } from '../helpers/canvas-harness';
import { deepFreeze } from '../helpers/deep-freeze';
import { buildStyledWorkbook } from '../helpers/workbook-builders';

it('[ARCH-4] renders a deeply frozen snapshot without mutating workbook or viewport state', () => {
  const sheet = deepFreeze(buildStyledWorkbook());
  const viewport = deepFreeze(createViewportMetrics(createSheetGridModel(sheet), {
    width: 640,
    height: 320,
    freeze: { row: 1, column: 1 },
    scroll: { x: 25, y: 20 },
  }));
  const snapshot = deepFreeze({
    sheet,
    viewport,
    selection: {
      start: { row: 0, column: 0 },
      end: { row: 2, column: 2 },
    },
  });
  const before = JSON.stringify(snapshot);
  const harness = createCanvasHarness();
  const engine = new CanvasEngine(harness.canvas, {
    animationFrame: harness.animationFrame,
    measurement: harness.measurement,
  });

  engine.render(snapshot);
  harness.animationFrame.flush();

  expect(JSON.stringify(snapshot)).toBe(before);
  expect(harness.operations.some(operation => operation.name === 'fillText')).toBe(true);
  engine.dispose();
});
