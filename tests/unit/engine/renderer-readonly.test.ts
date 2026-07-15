import { describe, expect, it } from 'vitest';
import {
  CanvasEngine,
  createSheetGridModel,
  createViewportMetrics,
} from '../../../src/engine';
import type { SheetData } from '../../../src/core';
import { createCanvasHarness } from '../../helpers/canvas-harness';
import { deepFreeze } from '../../helpers/deep-freeze';
import { buildStyledWorkbook } from '../../helpers/workbook-builders';

describe('read-only Canvas rendering', () => {
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
    expect(harness.operations.filter(operation => operation.name === 'clip')).toHaveLength(4);
    expect(harness.operations.filter(operation => operation.name === 'rect').map(operation => operation.args)).toEqual([
      [60, 25, 90, 30],
      [150, 25, 490, 30],
      [60, 55, 90, 265],
      [150, 55, 490, 265],
    ]);
    expect(harness.operations).toContainEqual({ name: 'fillText', args: ['1,234.00', 145, 40] });
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === '1235'
    ))).toBe(true);
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
    expect(harness.operations).toContainEqual({ name: 'fillText', args: ['1235', 105, 44] });
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
    expect(withoutGrid).toContainEqual({ name: 'set:lineWidth', args: [1] });
    expect(withoutGrid).toContainEqual({ name: 'set:lineWidth', args: [2] });
    expect(withoutGrid).toContainEqual({ name: 'set:lineWidth', args: [3] });
    expect(withoutGrid).toContainEqual({ name: 'setLineDash', args: [[3, 2]] });
    expect(withoutGrid).toContainEqual({ name: 'setLineDash', args: [[1, 1]] });
    expect(
      withoutGrid.filter(operation => operation.name === 'stroke').length
      - withoutBorderOperations.filter(operation => operation.name === 'stroke').length,
    ).toBe(7);
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
});
