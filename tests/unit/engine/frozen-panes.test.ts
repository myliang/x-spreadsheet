import { describe, expect, it } from 'vitest';
import {
  cellRect,
  createSheetGridModel,
  createViewportMetrics,
  frozenQuadrants,
  hitTest,
  overlayAnchors,
  rangeRect,
} from '../../../src/engine';

describe('frozen-pane geometry', () => {
  it('@parity:view.frozen-geometry creates the four legacy pane quadrants from resized rows and columns', () => {
    const model = createSheetGridModel({
      rows: { len: 12, 0: { height: 20 }, 1: { height: 30 } },
      cols: {
        len: 8,
        0: { width: 80 },
        1: { width: 120 },
        2: { width: 160 },
      },
    });
    const viewport = createViewportMetrics(model, { width: 700, height: 400 });

    expect(frozenQuadrants({ row: 2, column: 3 }, viewport)).toEqual([
      { kind: 'corner', left: 60, top: 25, width: 360, height: 50 },
      { kind: 'top', left: 420, top: 25, width: 280, height: 50 },
      { kind: 'left', left: 60, top: 75, width: 360, height: 325 },
      { kind: 'body', left: 420, top: 75, width: 280, height: 325 },
    ]);
  });

  it('keeps frozen cells fixed while scrolling and scrolls only body hits', () => {
    const model = createSheetGridModel({ rows: { len: 20 }, cols: { len: 20 } });
    const metrics = createViewportMetrics(model, {
      width: 560,
      height: 325,
      freeze: { row: 1, column: 1 },
      scroll: { x: 200, y: 50 },
    });

    expect(cellRect({ row: 0, column: 0 }, metrics)).toMatchObject({ left: 60, top: 25 });
    expect(cellRect({ row: 1, column: 1 }, metrics)).toMatchObject({ left: -40, top: 0 });
    expect(hitTest({ x: 61, y: 26 }, metrics)).toEqual({ row: 0, column: 0 });
    expect(hitTest({ x: 161, y: 51 }, metrics)).toEqual({ row: 3, column: 3 });
  });

  it('uses legacy closed seams before applying scroll beyond the seam', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 20 }, cols: { len: 20 } }),
      {
        width: 560,
        height: 325,
        freeze: { row: 1, column: 1 },
        scroll: { x: 200, y: 50 },
      },
    );

    expect(hitTest({ x: 160, y: 50 }, metrics)).toEqual({ row: 1, column: 1 });
    expect(hitTest({ x: 160.001, y: 50.001 }, metrics)).toEqual({ row: 3, column: 3 });
  });

  it('splits cross-freeze overlays into at most four clipped pane anchors', () => {
    const metrics = createViewportMetrics(
      createSheetGridModel({ rows: { len: 20 }, cols: { len: 20 } }),
      {
        width: 560,
        height: 325,
        freeze: { row: 1, column: 1 },
        scroll: { x: 50, y: 25 },
      },
    );
    const range = {
      start: { row: 0, column: 0 },
      end: { row: 2, column: 2 },
    };

    expect(rangeRect(range, metrics)).toEqual({
      left: 60,
      top: 25,
      width: 250,
      height: 50,
    });
    expect(overlayAnchors(range, metrics)).toEqual([
      { pane: 'corner', left: 60, top: 25, width: 100, height: 25, clipped: false },
      { pane: 'top', left: 160, top: 25, width: 150, height: 25, clipped: true },
      { pane: 'left', left: 60, top: 50, width: 100, height: 25, clipped: true },
      { pane: 'body', left: 160, top: 50, width: 150, height: 25, clipped: true },
    ]);
    expect(overlayAnchors({
      start: { row: 0, column: 0 },
      end: { row: 0, column: 0 },
    }, metrics)).toEqual([
      { pane: 'corner', left: 60, top: 25, width: 100, height: 25, clipped: false },
    ]);
  });

  it('partitions sorted overlay rows by visual freeze position', () => {
    const model = createSheetGridModel({
      rows: {
        len: 5,
        0: { cells: { 0: { text: 'Value' } } },
        1: { cells: { 0: { text: 'b' } } },
        2: { cells: { 0: { text: 'a' } } },
        3: { cells: { 0: { text: 'c' } } },
        4: { cells: { 0: { text: 'd' } } },
      },
      cols: { len: 2 },
      autofilter: { ref: 'A1:A5', sort: { ci: 0, order: 'asc' } },
    });
    const metrics = createViewportMetrics(model, {
      width: 260,
      height: 150,
      freeze: { row: 2, column: 0 },
    });

    expect(Array.from({ length: 5 }, (_, visual) => model.logicalRowAtVisualIndex(visual)))
      .toEqual([0, 2, 1, 3, 4]);
    expect(overlayAnchors({
      start: { row: 2, column: 0 },
      end: { row: 2, column: 0 },
    }, metrics)).toEqual([
      { pane: 'top', left: 60, top: 50, width: 100, height: 25, clipped: false },
    ]);
    expect(overlayAnchors({
      start: { row: 1, column: 0 },
      end: { row: 2, column: 0 },
    }, metrics)).toEqual([
      { pane: 'top', left: 60, top: 50, width: 100, height: 25, clipped: false },
      { pane: 'body', left: 60, top: 75, width: 100, height: 25, clipped: false },
    ]);
  });

  it('paints only the logical rows in a non-contiguous sorted selection', () => {
    const model = createSheetGridModel({
      rows: {
        len: 7,
        0: { cells: { 0: { text: 'Value' } } },
        1: { cells: { 0: { text: 'd' } } },
        2: { cells: { 0: { text: 'a' } } },
        3: { cells: { 0: { text: 'e' } } },
        4: { cells: { 0: { text: 'c' } } },
        5: { cells: { 0: { text: 'b' } } },
        6: { cells: { 0: { text: 'f' } } },
      },
      cols: { len: 2 },
      autofilter: { ref: 'A1:A7', sort: { ci: 0, order: 'asc' } },
    });
    const metrics = createViewportMetrics(model, {
      width: 260,
      height: 220,
      freeze: { row: 2, column: 0 },
    });

    expect(Array.from({ length: 7 }, (_, visual) => model.logicalRowAtVisualIndex(visual)))
      .toEqual([0, 2, 5, 4, 1, 3, 6]);
    expect(overlayAnchors({
      start: { row: 2, column: 0 },
      end: { row: 4, column: 0 },
    }, metrics)).toEqual([
      { pane: 'top', left: 60, top: 50, width: 100, height: 25, clipped: false },
      { pane: 'body', left: 60, top: 100, width: 100, height: 25, clipped: false },
      { pane: 'body', left: 60, top: 150, width: 100, height: 25, clipped: false },
    ]);
  });

  it('clips oversized frozen panes to the data viewport', () => {
    const model = createSheetGridModel({ rows: { len: 4 }, cols: { len: 4 } });
    const viewport = createViewportMetrics(model, { width: 210, height: 80 });

    expect(frozenQuadrants({ row: 4, column: 4 }, viewport)).toEqual([
      { kind: 'corner', left: 60, top: 25, width: 150, height: 55 },
    ]);
  });
});
