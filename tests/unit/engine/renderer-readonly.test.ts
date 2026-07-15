import { describe, expect, it } from 'vitest';
import {
  CanvasEngine,
  createSheetGridModel,
  createViewportMetrics,
} from '../../../src/engine';
import type { SheetData } from '../../../src/core';
import {
  hasVisibleRowInRange,
  paneCells,
  paneGridIndexes,
} from '../../../src/engine/canvas/grid-painter';
import { frozenQuadrants } from '../../../src/engine/geometry/frozen-pane-geometry';
import { createCanvasHarness } from '../../helpers/canvas-harness';
import { deepFreeze } from '../../helpers/deep-freeze';
import { buildStyledWorkbook } from '../../helpers/workbook-builders';

describe('read-only Canvas rendering', () => {
  it('does not require pane metadata when enumerating materialized cells', () => {
    expect(paneCells).toHaveLength(3);
  });

  it('renders grid, formatted text, borders, merges, headers, and marks without mutating input', () => {
    const sheet = deepFreeze(buildStyledWorkbook());
    const viewport = deepFreeze(createViewportMetrics(createSheetGridModel(sheet), {
      width: 640,
      height: 320,
      freeze: { row: 1, column: 1 },
    }));
    const snapshot = deepFreeze({
      sheet,
      viewport,
      selection: {
        start: { row: 0, column: 0 },
        end: { row: 2, column: 2 },
      },
      invalidCells: [{ row: 2, column: 4 }],
    });
    const before = JSON.stringify(snapshot);
    const modelFunctions = {
      rowHeight: snapshot.viewport.model.rowHeight,
      columnWidth: snapshot.viewport.model.columnWidth,
      rowOffset: snapshot.viewport.model.rowOffset,
      columnOffset: snapshot.viewport.model.columnOffset,
      rowAt: snapshot.viewport.model.rowAt,
      columnAt: snapshot.viewport.model.columnAt,
      previousVisibleRow: snapshot.viewport.model.previousVisibleRow,
      previousVisibleColumn: snapshot.viewport.model.previousVisibleColumn,
      mergeAt: snapshot.viewport.model.mergeAt,
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      devicePixelRatio: 2,
      measurement: harness.measurement,
    });

    engine.render(snapshot);
    expect(harness.animationFrame.pending).toBe(1);
    harness.animationFrame.flush();

    expect(JSON.stringify(snapshot)).toBe(before);
    expect(snapshot.viewport.model).toMatchObject(modelFunctions);
    expect(harness.canvas.width).toBe(1280);
    expect(harness.canvas.height).toBe(640);
    expect(harness.canvas.style).toEqual({ width: '640px', height: '320px' });
    const paneRects = harness.operations
      .filter(operation => operation.name === 'rect')
      .map(operation => operation.args)
      .filter(args => args[0] === 60 || args[0] === 150);
    expect(paneRects).toEqual([
      [60, 25, 90, 30],
      [150, 25, 490, 30],
      [60, 55, 90, 265],
      [150, 55, 490, 265],
    ]);
    expect(harness.operations).toContainEqual({ name: 'fillText', args: ['1,234.00', 145, 40] });
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === '1235'
    ))).toBe(false);
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === 'screen-only'
    ))).toBe(true);
    expect(harness.operations.some(operation => operation.name === 'stroke')).toBe(true);
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['rgba(255, 0, 0, .65)'] });
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['rgba(0, 255, 0, .85)'] });
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['rgba(0, 0, 0, .45)'] });
    expect(harness.operations).toContainEqual({ name: 'set:strokeStyle', args: ['#4b89ff'] });
    expect(harness.operations.some(operation => operation.name === 'strokeRect')).toBe(true);
    expect(harness.operations.filter(operation => operation.name === 'save')).toHaveLength(
      harness.operations.filter(operation => operation.name === 'restore').length,
    );
  });

  it('coalesces renders to one frame, uses the latest snapshot, and disposes idempotently', () => {
    const firstSheet = buildStyledWorkbook();
    const secondSheet = structuredClone(firstSheet);
    const firstRow = secondSheet.rows?.['0'] as {
      cells?: Record<string, { text?: string }>;
    } | undefined;
    const firstCell = firstRow?.cells?.['0'];
    if (firstCell !== undefined) firstCell.text = '999';
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });
    const viewport = createViewportMetrics(createSheetGridModel(firstSheet), {
      width: 320,
      height: 180,
    });

    engine.render({ sheet: firstSheet, viewport });
    engine.render({ sheet: secondSheet, viewport });
    expect(harness.animationFrame.pending).toBe(1);
    harness.animationFrame.flush();
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === '999.00'
    ))).toBe(true);
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === '1,234.00'
    ))).toBe(false);

    engine.render({ sheet: secondSheet, viewport });
    harness.animationFrame.flush();
    expect(harness.operations.filter(operation => operation.name === 'setTransform')).toEqual([
      { name: 'setTransform', args: [1, 0, 0, 1, 0, 0] },
      { name: 'setTransform', args: [1, 0, 0, 1, 0, 0] },
    ]);
    expect(harness.operations.some(operation => operation.name === 'scale')).toBe(false);

    engine.render({ sheet: firstSheet, viewport });
    expect(harness.animationFrame.pending).toBe(1);
    engine.dispose();
    engine.dispose();
    expect(harness.animationFrame.pending).toBe(0);
    expect(harness.animationFrame.cancelled).toHaveLength(1);
    expect(() => engine.render({ sheet: firstSheet, viewport })).not.toThrow();
    expect(harness.animationFrame.pending).toBe(0);
  });

  it('keeps frozen axes fixed while translating scrollable cell coordinates', () => {
    const sheet = buildStyledWorkbook();
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 640,
        height: 320,
        freeze: { row: 1, column: 1 },
        scroll: { x: 50, y: 25 },
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations).toContainEqual({ name: 'fillText', args: ['1,234.00', 145, 40] });
    expect(harness.operations).not.toContainEqual({ name: 'fillText', args: ['1235', 105, 44] });
    expect(harness.operations.filter(operation => operation.name === 'translate')).toEqual([
      { name: 'translate', args: [60, 25] },
      { name: 'translate', args: [10, 25] },
      { name: 'translate', args: [60, 0] },
      { name: 'translate', args: [10, 0] },
    ]);
  });

  it('suppresses grid strokes and supports every legacy border line style', () => {
    const styles = ['thin', 'medium', 'thick', 'dashed', 'dotted', 'double'].map(style => ({
      border: { bottom: [style, '#112233'] as const },
    }));
    const sheet: SheetData = {
      styles,
      rows: {
        len: 1,
        0: {
          cells: Object.fromEntries(styles.map((_, column) => [column, { text: String(column), style: column }])),
        },
      },
      cols: { len: 6 },
    };
    const render = (showGrid: boolean, source = sheet) => {
      const harness = createCanvasHarness();
      const engine = new CanvasEngine(harness.canvas, {
        animationFrame: harness.animationFrame,
        measurement: harness.measurement,
      });
      engine.render({
        sheet: source,
        showGrid,
        viewport: createViewportMetrics(createSheetGridModel(source), {
          width: 660,
          height: 80,
          rowHeaderWidth: 0,
          columnHeaderHeight: 0,
        }),
      });
      harness.animationFrame.flush();
      return harness.operations;
    };

    const withGrid = render(true);
    const withoutGrid = render(false);
    const withoutBorders: SheetData = {
      rows: {
        len: 1,
        0: {
          cells: Object.fromEntries(styles.map((_, column) => [column, { text: String(column) }])),
        },
      },
      cols: { len: 6 },
    };
    const withoutBorderOperations = render(false, withoutBorders);
    expect(withGrid.filter(operation => operation.name === 'stroke').length).toBeGreaterThan(
      withoutGrid.filter(operation => operation.name === 'stroke').length,
    );
    expect(withoutGrid).toContainEqual({ name: 'set:lineWidth', args: [0.5] });
    expect(withoutGrid).toContainEqual({ name: 'set:lineWidth', args: [1.5] });
    expect(withoutGrid).toContainEqual({ name: 'set:lineWidth', args: [3] });
    expect(withoutGrid).toContainEqual({ name: 'setLineDash', args: [[3, 2]] });
    expect(withoutGrid).toContainEqual({ name: 'setLineDash', args: [[1, 1]] });
    expect(withoutGrid).toContainEqual({ name: 'setLineDash', args: [[2, 0]] });
    expect(
      withoutGrid.filter(operation => operation.name === 'stroke').length
      - withoutBorderOperations.filter(operation => operation.name === 'stroke').length,
    ).toBe(6);
  });

  it('clips long text and marks to cell and merged-cell interiors', () => {
    const sheet: SheetData = {
      merges: ['B1:C1'],
      rows: {
        len: 1,
        0: {
          cells: {
            0: { text: 'a very long unwrapped value', editable: false },
            1: { text: 'merged overflow', merge: [0, 1] },
          },
        },
      },
      cols: { len: 3, 0: { width: 30 }, 1: { width: 30 }, 2: { width: 30 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      invalidCells: [{ row: 0, column: 0 }],
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 90,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    const clips = harness.operations
      .filter(operation => operation.name === 'rect')
      .map(operation => operation.args);
    expect(clips).toContainEqual([0.5, 0.5, 28, 23]);
    expect(clips).toContainEqual([30.5, 0.5, 58, 23]);
    const longText = harness.operations.findIndex(operation => (
      operation.name === 'fillText' && operation.args[0] === 'a very long unwrapped value'
    ));
    const redMark = harness.operations.findIndex(operation => (
      operation.name === 'set:fillStyle' && operation.args[0] === 'rgba(255, 0, 0, .65)'
    ));
    expect(longText).toBeGreaterThan(harness.operations.findIndex(operation => (
      operation.name === 'rect' && operation.args[0] === 0.5 && operation.args[1] === 0.5
    )));
    expect(redMark).toBeGreaterThan(longText);
    expect(harness.operations.slice(redMark).some(operation => operation.name === 'restore')).toBe(true);
  });

  it('threads configured defaults beneath column, row, and cell styles', () => {
    const sheet: SheetData = {
      styles: [
        { bgcolor: '#ccddee', font: { bold: true } },
        { align: 'center', font: { italic: true } },
        { color: '#123456', font: { size: 12 } },
      ],
      rows: { len: 1, 0: { style: 1, cells: { 0: { text: 'styled', style: 2 } } } },
      cols: { len: 1, 0: { style: 0 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
      defaultStyle: {
        bgcolor: '#ffffff',
        align: 'left',
        color: '#000000',
        font: { name: 'Configured', size: 8, bold: false, italic: false },
      },
    });

    engine.render({
      sheet,
      showGrid: false,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 100,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['#ccddee'] });
    expect(harness.operations).toContainEqual({
      name: 'set:font',
      args: ['italic bold 16px Configured'],
    });
    expect(harness.operations).toContainEqual({ name: 'set:textAlign', args: ['center'] });
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['#123456'] });
  });

  it('skips absent coordinates but paints explicit empty cells', () => {
    const sheet: SheetData = {
      styles: [
        { bgcolor: '#column-only' },
        { bgcolor: '#explicit-row' },
      ],
      merges: ['A1:B1'],
      rows: { len: 1, 0: { style: 1, cells: { 2: {} } } },
      cols: { len: 3, 0: { width: 30, style: 0 }, 1: { width: 30 }, 2: { width: 30 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      showGrid: false,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 90,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations.filter(operation => operation.name === 'rect').map(operation => operation.args))
      .toEqual([[0, 0, 90, 25], [60.5, 0.5, 28, 23]]);
    expect(harness.operations).not.toContainEqual({ name: 'set:fillStyle', args: ['#column-only'] });
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['#explicit-row'] });
  });

  it('draws large empty grids with row-plus-column boundary complexity', () => {
    const sheet: SheetData = { rows: { len: 500 }, cols: { len: 500 } };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      devicePixelRatio: 1,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet, {
        defaultColumnWidth: 16,
        defaultRowHeight: 16,
      }), {
        width: 8_000,
        height: 8_000,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    expect(() => harness.animationFrame.flush()).not.toThrow();

    expect(harness.operations.filter(operation => operation.name === 'stroke').length)
      .toBeLessThanOrEqual(2_004);
    expect(harness.operations.filter(operation => operation.name === 'rect').map(operation => operation.args))
      .toEqual([[0, 0, 8_000, 8_000]]);
  });

  it('returns only materialized cells from a large empty sparse pane', () => {
    let numericRowLookups = 0;
    const rows = new Proxy({ len: 500 }, {
      get(target, key, receiver) {
        if (/^(0|[1-9]\d*)$/.test(String(key))) numericRowLookups += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    const sheet = { rows, cols: { len: 500 } } as unknown as SheetData;
    const viewport = createViewportMetrics(createSheetGridModel(sheet), {
      width: 50_000,
      height: 12_500,
      rowHeaderWidth: 0,
      columnHeaderHeight: 0,
    });
    const pane = frozenQuadrants(viewport.freeze, viewport)[0];
    expect(pane).toBeDefined();
    if (pane === undefined) return;
    const indexes = paneGridIndexes(pane, viewport);
    const cells = paneCells(viewport, indexes, sheet);

    expect(indexes.rows).toHaveLength(500);
    expect(indexes.columns).toHaveLength(500);
    expect(cells).toEqual([]);
    expect(numericRowLookups).toBeLessThanOrEqual(indexes.rows.length + indexes.columns.length);
  });

  it('bounds offscreen sparse cell-key scans without materializing every entry', () => {
    const cells: Record<string, object> = {};
    const emptyCell = Object.freeze({});
    for (let column = 1_000; column < 251_001; column += 1) cells[column] = emptyCell;
    const sheet = {
      rows: { len: 1, 0: { cells } },
      cols: { len: 300_000 },
    } as unknown as SheetData;
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      devicePixelRatio: 1,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 100,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });

    expect(() => harness.animationFrame.flush()).toThrow(
      'visible canvas sparse cell scan exceeds the 250000-entry limit',
    );
  });

  it('does not enumerate materialized rows outside the visible sparse pane', () => {
    let numericRowLookups = 0;
    let ownKeyScans = 0;
    const source: Record<string, unknown> = { len: 2_000 };
    for (let row = 501; row < 2_000; row += 1) {
      source[row] = { cells: { 0: { text: `offscreen-${row}` } } };
    }
    const rows = new Proxy(source, {
      get(target, key, receiver) {
        if (/^(0|[1-9]\d*)$/.test(String(key))) numericRowLookups += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        ownKeyScans += 1;
        return Reflect.ownKeys(target);
      },
    }) as unknown as NonNullable<SheetData['rows']>;
    const sheet = { rows, cols: { len: 500 } } as unknown as SheetData;
    const viewport = createViewportMetrics(createSheetGridModel(sheet), {
      width: 50_000,
      height: 12_500,
      rowHeaderWidth: 0,
      columnHeaderHeight: 0,
    });
    const pane = frozenQuadrants(viewport.freeze, viewport)[0];
    expect(pane).toBeDefined();
    if (pane === undefined) return;
    const indexes = paneGridIndexes(pane, viewport);
    numericRowLookups = 0;
    ownKeyScans = 0;

    expect(paneCells(viewport, indexes, sheet)).toEqual([]);
    expect(numericRowLookups).toBeLessThanOrEqual(indexes.rows.length);
    expect(ownKeyScans).toBe(0);
  });

  it('retains an intersecting merge anchor outside a pane coordinate range', () => {
    const sheet: SheetData = {
      merges: ['A1:B1'],
      rows: { len: 1, 0: { cells: { 0: { text: 'merged', merge: [0, 1] } } } },
      cols: { len: 2 },
    };
    const viewport = createViewportMetrics(createSheetGridModel(sheet), {
      width: 200,
      height: 25,
      rowHeaderWidth: 0,
      columnHeaderHeight: 0,
      freeze: { row: 0, column: 1 },
    });
    const pane = frozenQuadrants(viewport.freeze, viewport)
      .find(candidate => candidate.kind === 'body');
    expect(pane).toBeDefined();
    if (pane === undefined) return;
    const indexes = paneGridIndexes(pane, viewport);

    expect(indexes.columns).toEqual([1]);
    expect(paneCells(viewport, indexes, sheet)).toEqual([{ row: 0, column: 0 }]);
  });

  it('checks merge row intersections with logarithmic visible-row probes', () => {
    let probes = 0;
    const rows = new Proxy(
      Array.from({ length: 131_072 }, (_, row) => row * 2),
      {
        get(target, key, receiver) {
          if (/^(0|[1-9]\d*)$/.test(String(key))) probes += 1;
          return Reflect.get(target, key, receiver);
        },
      },
    );

    for (let merge = 0; merge < 1_000; merge += 1) {
      expect(hasVisibleRowInRange(rows, merge * 200 + 1, merge * 200 + 1)).toBe(false);
      expect(hasVisibleRowInRange(rows, merge * 200 + 2, merge * 200 + 2)).toBe(true);
    }
    expect(probes).toBeLessThanOrEqual(38_000);
  });

  it('retains many merges across a large tiny-row viewport', () => {
    const merges = Array.from({ length: 1_000 }, (_, index) => {
      const first = index * 50 + 1;
      return `A${first}:A${first + 1}`;
    });
    const sheet: SheetData = {
      merges,
      rows: { len: 50_000 },
      cols: { len: 1 },
    };
    const viewport = createViewportMetrics(createSheetGridModel(sheet, {
      defaultRowHeight: 0.01,
    }), {
      width: 100,
      height: 500,
      rowHeaderWidth: 0,
      columnHeaderHeight: 0,
    });
    const pane = frozenQuadrants(viewport.freeze, viewport)[0];
    expect(pane).toBeDefined();
    if (pane === undefined) return;
    const indexes = paneGridIndexes(pane, viewport);

    expect(indexes.rows).toHaveLength(50_000);
    expect(paneCells(viewport, indexes, sheet)).toHaveLength(1_000);
  });

  it('keeps sorted selection paint, headers, and fill handle on exact logical rows', () => {
    const sheet: SheetData = {
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
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });
    engine.render({
      sheet,
      selection: { start: { row: 2, column: 0 }, end: { row: 4, column: 0 } },
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 260,
        height: 220,
        freeze: { row: 2, column: 0 },
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations
      .filter(operation => operation.name === 'strokeRect')
      .map(operation => operation.args)).toEqual([
      [60, 50, 100, 25],
      [60, 100, 100, 25],
      [60, 150, 100, 25],
    ]);
    expect(harness.operations).toContainEqual({ name: 'fillRect', args: [155.5, 170.5, 8, 8] });
    const headerHighlights = harness.operations.flatMap((operation, index) => (
      operation.name === 'set:fillStyle'
      && operation.args[0] === 'rgba(75, 137, 255, 0.08)'
      && harness.operations[index + 1]?.name === 'fillRect'
        ? [harness.operations[index + 1]!.args]
        : []
    ));
    expect(headerHighlights).toEqual([
      [-0.5, 49.5, 60, 25],
      [-0.5, 99.5, 60, 25],
      [-0.5, 149.5, 60, 25],
      [59.5, -0.5, 100, 25],
    ]);
  });

  it('bounds frozen axis enumeration at the pane extent for safe-integer grid counts', () => {
    const sheet: SheetData = {
      rows: { len: Number.MAX_SAFE_INTEGER },
      cols: { len: Number.MAX_SAFE_INTEGER },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 100,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
        freeze: { row: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER },
      }),
    });

    expect(() => harness.animationFrame.flush()).not.toThrow();
    expect(harness.operations.filter(operation => operation.name === 'stroke').length)
      .toBeLessThanOrEqual(20);
  });

  it('rejects a visible frozen axis over its explicit enumeration budget', () => {
    const sheet: SheetData = { rows: { len: 250_001 }, cols: { len: 1 } };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet, {
        defaultRowHeight: 1 / 250_001,
      }), {
        width: 100,
        height: 1,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
        freeze: { row: 250_001, column: 0 },
      }),
    });

    expect(() => harness.animationFrame.flush()).toThrow(
      'visible canvas row axis exceeds the 250000-index limit',
    );
  });

  it('keeps the previous frame untouched when pane planning exceeds a resource budget', () => {
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      devicePixelRatio: 1,
      measurement: harness.measurement,
    });
    const validSheet: SheetData = {
      rows: { len: 1, 0: { cells: { 0: { text: 'valid' } } } },
      cols: { len: 1 },
    };
    engine.render({
      sheet: validSheet,
      viewport: createViewportMetrics(createSheetGridModel(validSheet), {
        width: 200,
        height: 50,
      }),
    });
    harness.animationFrame.flush();
    const previous = {
      width: harness.canvas.width,
      height: harness.canvas.height,
      style: { ...harness.canvas.style },
      operations: [...harness.operations],
    };
    const oversizedSheet: SheetData = { rows: { len: 250_001 }, cols: { len: 1 } };

    engine.render({
      sheet: oversizedSheet,
      viewport: createViewportMetrics(createSheetGridModel(oversizedSheet, {
        defaultRowHeight: 1 / 250_001,
      }), {
        width: 100,
        height: 1,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
        freeze: { row: 250_001, column: 0 },
      }),
    });

    expect(() => harness.animationFrame.flush()).toThrow(
      'visible canvas row axis exceeds the 250000-index limit',
    );
    expect(harness.canvas.width).toBe(previous.width);
    expect(harness.canvas.height).toBe(previous.height);
    expect(harness.canvas.style).toEqual(previous.style);
    expect(harness.operations).toEqual(previous.operations);
  });

  it('aligns unique grid boundaries with scrolled cell rectangles', () => {
    const sheet: SheetData = { rows: { len: 4 }, cols: { len: 4 } };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 200,
        height: 50,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
        scroll: { x: 30, y: 10 },
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations).toContainEqual({ name: 'moveTo', args: [69.5, 0.5] });
    expect(harness.operations).toContainEqual({ name: 'lineTo', args: [69.5, 64.5] });
    expect(harness.operations).toContainEqual({ name: 'moveTo', args: [0.5, 14.5] });
    expect(harness.operations).toContainEqual({ name: 'lineTo', args: [269.5, 14.5] });
    expect(harness.operations).not.toContainEqual({ name: 'moveTo', args: [99.5, 0.5] });
    expect(harness.operations).not.toContainEqual({ name: 'moveTo', args: [0.5, 24.5] });
  });

  it.each([
    {
      label: 'vertical merge',
      merge: 'A1:A2',
      span: [1, 0] as const,
      move: [0.5, 24.5],
      line: [199.5, 24.5],
    },
    {
      label: 'horizontal merge',
      merge: 'A1:B1',
      span: [0, 1] as const,
      move: [99.5, 0.5],
      line: [99.5, 49.5],
    },
  ])('keeps singleton grid boundaries outside a $label', ({ merge, span, move, line }) => {
    const sheet: SheetData = {
      merges: [merge],
      rows: { len: 2, 0: { cells: { 0: { text: 'merged', merge: span } } } },
      cols: { len: 2 },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 200,
        height: 50,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations).toContainEqual({ name: 'moveTo', args: move });
    expect(harness.operations).toContainEqual({ name: 'lineTo', args: line });
  });

  it('paints filter dropdowns for blank visible header cells without styling them', () => {
    const sheet: SheetData = {
      autofilter: { ref: 'A1:C1' },
      rows: { len: 1, 0: { cells: { 0: { text: 'materialized' } } } },
      cols: { len: 3, 0: { width: 30 }, 1: { width: 30 }, 2: { width: 30 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      showGrid: false,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 90,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations.filter(operation => (
      operation.name === 'set:fillStyle' && operation.args[0] === 'rgba(0, 0, 0, .45)'
    ))).toHaveLength(3);
    expect(harness.operations.filter(operation => operation.name === 'rect').map(operation => operation.args))
      .toEqual([[0, 0, 90, 25], [0.5, 0.5, 28, 23]]);
  });

  it('uses legacy point sizes, character wrapping, and multiline vertical origins', () => {
    const style = (valign: 'top' | 'middle' | 'bottom') => ({
      valign,
      textwrap: true,
      font: { size: 12 },
    });
    const sheet: SheetData = {
      styles: [style('top'), style('middle'), style('bottom')],
      rows: {
        len: 1,
        0: {
          height: 60,
          cells: {
            0: { text: 'ABCD', style: 0 },
            1: { text: 'ABCD', style: 1 },
            2: { text: 'ABCD', style: 2 },
          },
        },
      },
      cols: { len: 3, 0: { width: 30 }, 1: { width: 30 }, 2: { width: 30 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 90,
        height: 60,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations).toContainEqual({ name: 'set:font', args: ['16px Arial'] });
    expect(harness.operations.filter(operation => operation.name === 'fillText')).toEqual([
      { name: 'fillText', args: ['ABC', 5, 5] },
      { name: 'fillText', args: ['D', 5, 23] },
      { name: 'fillText', args: ['ABC', 35, 21] },
      { name: 'fillText', args: ['D', 35, 39] },
      { name: 'fillText', args: ['ABC', 65, 37] },
      { name: 'fillText', args: ['D', 65, 55] },
      { name: 'fillText', args: ['1', 0, 30] },
      { name: 'fillText', args: ['A', 15, 0] },
      { name: 'fillText', args: ['B', 45, 0] },
      { name: 'fillText', args: ['C', 75, 0] },
    ]);
  });

  it('places underline and strike lines on legacy vertical coordinates', () => {
    const decorationStyle = (
      valign: 'top' | 'middle' | 'bottom',
      decoration: 'underline' | 'strike',
    ) => ({
      valign,
      color: decoration === 'underline' ? '#aa0000' : '#00aa00',
      font: { size: 12 },
      [decoration]: true,
    });
    const sheet: SheetData = {
      styles: [
        decorationStyle('top', 'underline'),
        decorationStyle('middle', 'underline'),
        decorationStyle('bottom', 'underline'),
        decorationStyle('top', 'strike'),
        decorationStyle('middle', 'strike'),
        decorationStyle('bottom', 'strike'),
      ],
      rows: {
        len: 1,
        0: {
          height: 40,
          cells: Object.fromEntries(Array.from({ length: 6 }, (_, column) => [
            column,
            { text: 'A', style: column },
          ])),
        },
      },
      cols: {
        len: 6,
        ...Object.fromEntries(Array.from({ length: 6 }, (_, column) => [column, { width: 30 }])),
      },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });
    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 180,
        height: 40,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    const decorationLines = (color: string) => harness.operations.flatMap((operation, index) => {
      if (operation.name !== 'set:strokeStyle' || operation.args[0] !== color) return [];
      const move = harness.operations.slice(index).find(candidate => candidate.name === 'moveTo');
      const line = harness.operations.slice(index).find(candidate => candidate.name === 'lineTo');
      return move === undefined || line === undefined ? [] : [[move.args, line.args]];
    });
    expect(decorationLines('#aa0000')).toEqual([
      [[4.5, 22.5], [11.5, 22.5]],
      [[34.5, 27.5], [41.5, 27.5]],
      [[64.5, 34.5], [71.5, 34.5]],
    ]);
    expect(decorationLines('#00aa00')).toEqual([
      [[94.5, 14.5], [101.5, 14.5]],
      [[124.5, 19.5], [131.5, 19.5]],
      [[154.5, 26.5], [161.5, 26.5]],
    ]);
  });

  it.each([
    {
      label: 'rows',
      selection: { start: { row: 0, column: 0 }, end: { row: 1, column: 0 } },
      rects: [[60, 25, 100, 25], [60, 50, 100, 25]],
    },
    {
      label: 'columns',
      selection: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } },
      rects: [[60, 25, 100, 25], [160, 25, 100, 25]],
    },
    {
      label: 'both axes',
      selection: { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } },
      rects: [
        [60, 25, 100, 25],
        [160, 25, 100, 25],
        [60, 50, 100, 25],
        [160, 50, 100, 25],
      ],
    },
  ])('paints separate 2px selection fragments across frozen $label', ({ selection, rects }) => {
    const sheet: SheetData = { rows: { len: 4 }, cols: { len: 4 } };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });
    engine.render({
      sheet,
      selection,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 360,
        height: 150,
        freeze: { row: 1, column: 1 },
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations.filter(operation => operation.name === 'strokeRect').map(operation => operation.args)).toEqual(rects);
    expect(harness.operations.filter(operation => (
      operation.name === 'set:fillStyle' && operation.args[0] === 'rgba(75, 137, 255, 0.1)'
    ))).toHaveLength(rects.length);
    expect(harness.operations.filter(operation => (
      operation.name === 'set:lineWidth' && operation.args[0] === 2
    )).length).toBeGreaterThanOrEqual(rects.length);
  });

  it('draws gray header hints after hidden rows and columns', () => {
    const sheet: SheetData = {
      rows: { len: 3, 0: { hide: true }, 1: { height: 30 } },
      cols: { len: 3, 0: { hide: true }, 1: { width: 80 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      measurement: harness.measurement,
    });
    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 260,
        height: 125,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.operations.filter(operation => (
      operation.name === 'set:strokeStyle' && operation.args[0] === '#c6c6c6'
    ))).toHaveLength(2);
    expect(harness.operations).toContainEqual({ name: 'moveTo', args: [4.5, 29.5] });
    expect(harness.operations).toContainEqual({ name: 'lineTo', args: [54.5, 29.5] });
    expect(harness.operations).toContainEqual({ name: 'moveTo', args: [64.5, 4.5] });
    expect(harness.operations).toContainEqual({ name: 'lineTo', args: [64.5, 19.5] });
  });

  it.each([1, 2])('uses DPR %s without reading browser globals', (devicePixelRatio) => {
    const sheet = buildStyledWorkbook();
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      devicePixelRatio,
      measurement: harness.measurement,
    });

    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 257,
        height: 129,
      }),
    });
    harness.animationFrame.flush();
    engine.render({
      sheet,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 257,
        height: 129,
      }),
    });
    harness.animationFrame.flush();

    expect(harness.canvas.width).toBe(257 * devicePixelRatio);
    expect(harness.canvas.height).toBe(129 * devicePixelRatio);
    expect(harness.operations.filter(operation => operation.name === 'setTransform')).toEqual([
      { name: 'setTransform', args: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] },
      { name: 'setTransform', args: [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0] },
    ]);
    expect(harness.operations.some(operation => operation.name === 'scale')).toBe(false);
  });

  it.each([
    {
      dpr: 1,
      width: 0.5,
      start: [0.5, 24.5],
      end: [29.5, 24.5],
      contentRect: [0.5, 0.5, 28, 23],
    },
    {
      dpr: 2,
      width: 0.75,
      start: [0.25, 24.75],
      end: [29.75, 24.75],
      contentRect: [0.75, 0.75, 28, 23],
    },
  ])('aligns thin lines to physical pixels at DPR $dpr', ({
    dpr,
    width,
    start,
    end,
    contentRect,
  }) => {
    const sheet: SheetData = {
      styles: [{ border: { bottom: ['thin', '#135790'] } }],
      rows: { len: 1, 0: { cells: { 0: { style: 0 } } } },
      cols: { len: 1, 0: { width: 30 } },
    };
    const harness = createCanvasHarness();
    const engine = new CanvasEngine(harness.canvas, {
      animationFrame: harness.animationFrame,
      devicePixelRatio: dpr,
      measurement: harness.measurement,
    });
    engine.render({
      sheet,
      showGrid: false,
      viewport: createViewportMetrics(createSheetGridModel(sheet), {
        width: 30,
        height: 25,
        rowHeaderWidth: 0,
        columnHeaderHeight: 0,
      }),
    });
    harness.animationFrame.flush();

    const border = harness.operations.findIndex(operation => (
      operation.name === 'set:strokeStyle' && operation.args[0] === '#135790'
    ));
    expect(harness.operations.slice(border)).toContainEqual({ name: 'set:lineWidth', args: [width] });
    expect(harness.operations.slice(border)).toContainEqual({ name: 'moveTo', args: start });
    expect(harness.operations.slice(border)).toContainEqual({ name: 'lineTo', args: end });
    expect(harness.operations).toContainEqual({ name: 'rect', args: contentRect });
    expect(harness.operations).toContainEqual({ name: 'fillRect', args: contentRect });
    expect(harness.operations).toContainEqual({ name: 'setTransform', args: [dpr, 0, 0, dpr, 0, 0] });
  });
});
