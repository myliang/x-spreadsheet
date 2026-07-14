import { describe, expect, it } from 'vitest';
import {
  cellRect,
  createScrollState,
  createSheetGridModel,
  createViewportMetrics,
  hitTest,
  hitTestRegion,
  overlayAnchor,
  rowOffset,
  columnOffset,
  scrollBy,
  scrollTo,
  visibleCellRange,
} from '../../../src/engine';
import type { CellPoint, CellRange, SheetData } from '../../../src/core';
import type { SheetGridSizing } from '../../../src/engine';

const emptyAxisCases: readonly {
  readonly label: string;
  readonly sheet: SheetData;
  readonly sizing: SheetGridSizing;
  readonly hit: CellPoint | null;
  readonly visible: CellRange | null;
}[] = [
  {
    label: 'an all-hidden row axis',
    sheet: { rows: { len: 2, 0: { hide: true }, 1: { hide: true } }, cols: { len: 2 } },
    sizing: {},
    hit: { row: 1, column: 0 },
    visible: null,
  },
  {
    label: 'an all-hidden column axis',
    sheet: { rows: { len: 2 }, cols: { len: 2, 0: { hide: true }, 1: { hide: true } } },
    sizing: {},
    hit: { row: 0, column: 1 },
    visible: null,
  },
  {
    label: 'a zero default row height',
    sheet: { rows: { len: 2 }, cols: { len: 2 } },
    sizing: { defaultRowHeight: 0 },
    hit: null,
    visible: null,
  },
  {
    label: 'a zero default column width',
    sheet: { rows: { len: 2 }, cols: { len: 2 } },
    sizing: { defaultColumnWidth: 0 },
    hit: { row: 0, column: 1 },
    visible: null,
  },
  {
    label: 'an empty row axis',
    sheet: { rows: { len: 0 }, cols: { len: 2 } },
    sizing: {},
    hit: null,
    visible: null,
  },
  {
    label: 'an empty column axis',
    sheet: { rows: { len: 2 }, cols: { len: 0 } },
    sizing: {},
    hit: null,
    visible: null,
  },
];

describe('DOM-free grid geometry', () => {
  it('matches the legacy header-offset hit-test fixture', () => {
    const model = createSheetGridModel({ rows: { len: 10 }, cols: { len: 10 } });
    const metrics = createViewportMetrics(model, { width: 500, height: 300 });

    expect(hitTest({ x: 161, y: 76 }, metrics)).toEqual({ row: 2, column: 1 });
  });

  it('skips hidden rows and columns without swallowing their boundary', () => {
    const sheet: SheetData = {
      rows: {
        len: 5,
        0: { height: 20 },
        1: { hide: true, height: 99 },
        2: { height: 40 },
      },
      cols: {
        len: 5,
        0: { width: 80 },
        1: { hide: true, width: 99 },
        2: { width: 140 },
      },
    };
    const metrics = createViewportMetrics(createSheetGridModel(sheet), {
      width: 400,
      height: 240,
    });

    expect(hitTest({ x: 140, y: 45 }, metrics)).toEqual({ row: 2, column: 2 });
    expect(cellRect({ row: 2, column: 2 }, metrics)).toMatchObject({
      left: 140,
      top: 45,
      width: 140,
      height: 40,
    });
  });

  it('reserves row and column headers and clips hits to the viewport', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 4 }, cols: { len: 4 } }),
      { width: 260, height: 125 },
    );

    expect(hitTest({ x: 59, y: 76 }, metrics)).toBeNull();
    expect(hitTestRegion({ x: 59, y: 76 }, metrics)).toEqual({
      kind: 'row-header',
      row: 2,
    });
    expect(hitTest({ x: 161, y: 24 }, metrics)).toBeNull();
    expect(hitTestRegion({ x: 161, y: 24 }, metrics)).toEqual({
      kind: 'column-header',
      column: 1,
    });
    expect(hitTestRegion({ x: 20, y: 10 }, metrics)).toEqual({ kind: 'corner' });
    expect(hitTest({ x: 260, y: 76 }, metrics)).toBeNull();
    expect(hitTestRegion({ x: 260, y: 76 }, metrics)).toBeNull();
    expect(hitTest({ x: 161, y: 125 }, metrics)).toBeNull();
    expect(visibleCellRange(metrics)).toEqual({
      start: { row: 0, column: 0 },
      end: { row: 3, column: 1 },
    });
  });

  it('applies scrolling to the body and returns clipped overlay anchors', () => {
    const model = createSheetGridModel({ rows: { len: 20 }, cols: { len: 20 } });
    const metrics = createViewportMetrics(model, {
      width: 260,
      height: 125,
      scroll: { x: 80, y: 20 },
    });

    expect(cellRect({ row: 0, column: 0 }, metrics)).toEqual({
      left: -20,
      top: 5,
      width: 100,
      height: 25,
    });
    expect(overlayAnchor({
      start: { row: 0, column: 0 },
      end: { row: 1, column: 1 },
    }, metrics)).toEqual({
      left: 60,
      top: 25,
      width: 120,
      height: 30,
      clipped: true,
    });
    expect(visibleCellRange(metrics)).toEqual({
      start: { row: 0, column: 0 },
      end: { row: 4, column: 2 },
    });
  });

  it('starts the visible range after cells that are fully scrolled away', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 20 }, cols: { len: 20 } }),
      { width: 260, height: 125, scroll: { x: 200, y: 50 } },
    );

    expect(visibleCellRange(metrics)?.start).toEqual({ row: 2, column: 2 });
  });

  it('maps a merged interior hit to its anchor and full rectangle', () => {
    const sheet: SheetData = {
      rows: { len: 8 },
      cols: { len: 8 },
      merges: ['B2:C3'],
    };
    const metrics = createViewportMetrics(createSheetGridModel(sheet), {
      width: 500,
      height: 300,
    });

    expect(hitTest({ x: 261, y: 76 }, metrics)).toEqual({ row: 1, column: 1 });
    expect(cellRect({ row: 2, column: 2 }, metrics)).toEqual({
      left: 160,
      top: 50,
      width: 200,
      height: 50,
    });
  });

  it('keeps legacy zero-size overrides at the defaults while hidden structure is zero-size', () => {
    const model = createSheetGridModel({
      rows: { len: 2, 0: { height: 0 }, 1: { hide: true } },
      cols: { len: 2, 0: { width: 0 }, 1: { hide: true } },
    });

    expect(model.rowHeight(0)).toBe(25);
    expect(model.columnWidth(0)).toBe(100);
    expect(model.rowHeight(1)).toBe(0);
    expect(model.columnWidth(1)).toBe(0);
  });

  it('uses arithmetic geometry for sparse maximum-safe grid lengths', () => {
    const model = createSheetGridModel({
      rows: { len: Number.MAX_SAFE_INTEGER },
      cols: { len: Number.MAX_SAFE_INTEGER },
    });
    const metrics = createViewportMetrics(model, { width: 260, height: 125 });

    expect(hitTest({ x: 61, y: 26 }, metrics)).toEqual({ row: 0, column: 0 });
    expect(visibleCellRange(metrics)).toEqual({
      start: { row: 0, column: 0 },
      end: { row: 3, column: 1 },
    });
    expect(Number.isFinite(rowOffset(Number.MAX_SAFE_INTEGER, model))).toBe(true);
    expect(Number.isFinite(columnOffset(Number.MAX_SAFE_INTEGER, model))).toBe(true);
    expect(() => createSheetGridModel(
      { rows: { len: Number.MAX_SAFE_INTEGER } },
      { defaultRowHeight: Number.MAX_VALUE },
    )).toThrow(/finite extent/);
  });

  it('characterizes blank space after small content as the final legacy cell', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 1 }, cols: { len: 1 } }),
      { width: 500, height: 300 },
    );

    expect(hitTest({ x: 400, y: 200 }, metrics)).toEqual({ row: 0, column: 0 });
  });

  it.each(emptyAxisCases)('characterizes $label', ({ sheet, sizing, hit, visible }) => {
    const metrics = createViewportMetrics(createSheetGridModel(sheet, sizing), {
      width: 500,
      height: 300,
    });

    expect(hitTest({ x: 61, y: 26 }, metrics)).toEqual(hit);
    expect(visibleCellRange(metrics)).toEqual(visible);
  });

  it('keeps scroll state immutable and clamps it to scrollable content', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 10 }, cols: { len: 10 } }),
      { width: 260, height: 125 },
    );
    const initial = createScrollState();
    const moved = scrollBy(initial, { x: 2_000, y: 2_000 }, metrics);

    expect(initial).toEqual({ x: 0, y: 0 });
    expect(moved).toEqual({ x: 800, y: 150 });
  });

  it('snaps scrollbar offsets to the legacy row and column end boundaries', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 10 }, cols: { len: 10 } }),
      { width: 260, height: 125, freeze: { row: 1, column: 1 } },
    );

    expect(scrollTo({ x: 1, y: 1 }, metrics)).toEqual({ x: 100, y: 25 });
    expect(scrollTo({ x: 100, y: 25 }, metrics)).toEqual({ x: 200, y: 50 });
    expect(scrollTo({ x: 0, y: 0 }, metrics)).toEqual({ x: 0, y: 0 });
  });
});
