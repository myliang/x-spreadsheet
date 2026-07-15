import { describe, expect, it } from 'vitest';
import type { SheetData } from '../../../src/core';
import {
  CanvasEngine,
  cellRect,
  createSelectionState,
  createSheetGridModel,
  createViewportMetrics,
  hitTest,
  moveSelection,
  rangeRect,
} from '../../../src/engine';
import { findResizeHandle } from '../../../src/engine/interaction/resize';
import { createCanvasHarness } from '../../helpers/canvas-harness';

function sortedSheet(
  order: 'asc' | 'desc',
  values: readonly string[] = ['b', 'a', 'a', ''],
  filterValues?: readonly string[],
): SheetData {
  return {
    rows: {
      len: values.length + 1,
      0: { cells: { 0: { text: 'Value' } } },
      ...Object.fromEntries(values.map((text, index) => [index + 1, {
        cells: { 0: { text } },
      }])),
    },
    cols: { len: 1 },
    autofilter: {
      ref: `A1:A${values.length + 1}`,
      filters: filterValues === undefined
        ? []
        : [{ ci: 0, operator: 'in', value: [...filterValues] }],
      sort: { ci: 0, order },
    },
  };
}

describe('sorted row geometry', () => {
  it('maps stable ascending sort order and empty-last rows without rekeying logical data', () => {
    const model = createSheetGridModel(sortedSheet('asc'));
    const viewport = createViewportMetrics(model, { width: 200, height: 180 });

    expect(Array.from({ length: 5 }, (_, visual) => model.logicalRowAtVisualIndex(visual)))
      .toEqual([0, 2, 3, 1, 4]);
    expect(model.visualIndexOfRow(2)).toBe(1);
    expect(model.visualIndexOfRow(3)).toBe(2);
    expect(model.logicalRowRange(1, 3)).toEqual([1, 3]);
    expect(cellRect({ row: 2, column: 0 }, viewport)).toMatchObject({ top: 50, height: 25 });
    expect(hitTest({ x: 70, y: 62 }, viewport)).toEqual({ row: 2, column: 0 });
    expect(hitTest({ x: 70, y: 87 }, viewport)).toEqual({ row: 3, column: 0 });
  });

  it('maps descending order while retaining stable equal rows and empty-last behavior', () => {
    const model = createSheetGridModel(sortedSheet('desc'));

    expect(Array.from({ length: 5 }, (_, visual) => model.logicalRowAtVisualIndex(visual)))
      .toEqual([0, 1, 2, 3, 4]);
    expect(model.visualIndexOfRow(1)).toBe(1);
    expect(model.visualIndexOfRow(4)).toBe(4);
  });

  it('combines filtering with sorted visual order while filtered logical rows stay zero-height', () => {
    const sheet = sortedSheet('asc', ['b', 'a', 'a', ''], ['a']);
    const model = createSheetGridModel(sheet);
    const viewport = createViewportMetrics(model, { width: 200, height: 180 });

    expect(Array.from({ length: 5 }, (_, visual) => model.logicalRowAtVisualIndex(visual)))
      .toEqual([0, 2, 3, 1, 4]);
    expect(model.rowHeight(1)).toBe(0);
    expect(model.rowHeight(4)).toBe(0);
    expect(hitTest({ x: 70, y: 62 }, viewport)).toEqual({ row: 2, column: 0 });
    expect(hitTest({ x: 70, y: 87 }, viewport)).toEqual({ row: 3, column: 0 });
  });

  it('keeps painting, hit testing, and row resize handles on the same logical row', () => {
    const sheet = sortedSheet('asc');
    const viewport = createViewportMetrics(createSheetGridModel(sheet), {
      width: 200,
      height: 180,
    });
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({ sheet, viewport });
    harness.animationFrame.flush();

    const paintedValues = harness.operations
      .filter(operation => operation.name === 'fillText')
      .filter(operation => ['Value', 'a', 'b'].includes(String(operation.args[0])))
      .map(operation => ({ text: operation.args[0], y: operation.args[2] }));
    expect(paintedValues).toEqual([
      { text: 'Value', y: 37.5 },
      { text: 'a', y: 62.5 },
      { text: 'a', y: 87.5 },
      { text: 'b', y: 112.5 },
    ]);
    expect(hitTest({ x: 70, y: 62 }, viewport)).toEqual({ row: 2, column: 0 });
    expect(findResizeHandle({ x: 30, y: 75 }, viewport)).toMatchObject({
      axis: 'row',
      boundary: 2,
      index: 2,
      size: 25,
    });
  });

  it('moves a single-cell selection through visible rows in visual order', () => {
    const model = createSheetGridModel(sortedSheet('asc'));
    const firstEqual = createSelectionState({ row: 2, column: 0 });
    const secondEqual = moveSelection(firstEqual, 'down', model);
    const nextValue = moveSelection(secondEqual, 'down', model);

    expect(secondEqual.active).toEqual({ row: 3, column: 0 });
    expect(nextValue.active).toEqual({ row: 1, column: 0 });
    expect(moveSelection(firstEqual, 'up', model).active).toEqual({ row: 0, column: 0 });
  });

  it('bounds sorted row ranges across frozen and scrolling panes', () => {
    const model = createSheetGridModel(sortedSheet('asc'));
    const viewport = createViewportMetrics(model, {
      width: 200,
      height: 180,
      freeze: { row: 1, column: 0 },
      scroll: { x: 0, y: 50 },
    });

    expect(rangeRect({
      start: { row: 0, column: 0 },
      end: { row: 2, column: 0 },
    }, viewport)).toMatchObject({ top: 0, height: 75 });
  });

  it('keeps invalid imported sort metadata inert', () => {
    const sheet = structuredClone(sortedSheet('asc'));
    (sheet.autofilter as { ref: string }).ref = 'not-a-range';
    const model = createSheetGridModel(sheet);

    expect(Array.from({ length: 5 }, (_, visual) => model.logicalRowAtVisualIndex(visual)))
      .toEqual([0, 1, 2, 3, 4]);
  });
});
