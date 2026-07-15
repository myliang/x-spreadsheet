import { describe, expect, it } from 'vitest';
import type { SheetData } from '../../../src/core';
import {
  PAPER_SIZES,
  createPrintLayout,
  renderPrintPage,
} from '../../../src/engine';
import { createCanvasHarness } from '../../helpers/canvas-harness';
import { deepFreeze } from '../../helpers/deep-freeze';

describe('print layout', () => {
  it('@parity:output.print-layout supports legacy paper sizes and both orientations', () => {
    const expected = {
      A3: [1122, 1587],
      A4: [793, 1122],
      A5: [559, 793],
      B4: [944, 1334],
      B5: [665, 944],
    } as const;

    for (const name of Object.keys(PAPER_SIZES) as Array<keyof typeof PAPER_SIZES>) {
      const sheet: SheetData = { rows: { len: 1 }, cols: { len: 1 } };
      const portrait = createPrintLayout(sheet, { paperSize: name, orientation: 'portrait' });
      const landscape = createPrintLayout(sheet, { paperSize: name, orientation: 'landscape' });
      expect([portrait.paper.width, portrait.paper.height]).toEqual(expected[name]);
      expect([landscape.paper.width, landscape.paper.height]).toEqual([
        expected[name][1],
        expected[name][0],
      ]);
    }
  });

  it('paginates complete rows after horizontal scaling', () => {
    const sheet: SheetData = {
      rows: {
        len: 6,
        0: { height: 300, cells: { 0: { text: 'one' } } },
        1: { height: 300, cells: { 0: { text: 'two' } } },
        2: { height: 300, cells: { 0: { text: 'three' } } },
        3: { height: 300, cells: { 0: { text: 'four' } } },
        4: { height: 300, cells: { 0: { text: 'five' } } },
        5: { height: 300, cells: { 0: { text: 'six' } } },
      },
      cols: { len: 1, 0: { width: 100 } },
    };

    const layout = createPrintLayout(sheet, {
      paperSize: 'A5',
      orientation: 'portrait',
      padding: 50,
    });

    expect(layout.scale).toBe(1);
    expect(layout.pages.map(page => [page.rowStart, page.rowEnd])).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it('shrinks wide content and keeps legacy strict row-fit page boundaries', () => {
    const sheet: SheetData = {
      rows: {
        len: 3,
        0: { height: 346, cells: { 0: { text: 'one' }, 1: { text: 'wide' } } },
        1: { height: 347, cells: { 0: { text: 'two' } } },
        2: { height: 20, cells: { 0: { text: 'three' }, 1: { text: 'wide-tail' } } },
      },
      cols: { len: 2, 0: { width: 400 }, 1: { width: 400 } },
    };

    const layout = createPrintLayout(sheet, {
      paperSize: 'A5',
      orientation: 'portrait',
      padding: 50,
    });

    expect(layout.scale).toBeCloseTo(459 / 800);
    expect(layout.pages.map(page => [page.rowStart, page.rowEnd])).toEqual([
      [0, 0],
      [1, 2],
    ]);

    const exactBoundary = createPrintLayout({
      rows: {
        len: 2,
        0: { height: 346, cells: { 0: { text: 'one' } } },
        1: { height: 347, cells: { 0: { text: 'two' } } },
      },
      cols: { len: 1, 0: { width: 100 } },
    }, {
      paperSize: 'A5',
      orientation: 'portrait',
      padding: 50,
    });
    expect(exactBoundary.pages).toHaveLength(2);
    expect(exactBoundary.pages.map(page => [page.rowStart, page.rowEnd])).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(exactBoundary.scale).toBe(1);
    expect(exactBoundary.contentLeft).toBe(50 + (459 - 100) / 2);
  });

  it('@parity:correction.printable-cells hides only content and retains merge/style geometry', () => {
    const sheet = deepFreeze<SheetData>({
      styles: [{ bgcolor: '#ffeecc', border: { bottom: ['thick', '#ff0000'] } }],
      merges: ['A1:B2'],
      rows: {
        len: 2,
        0: { height: 30, cells: { 0: { text: 'secret', printable: false, style: 0, merge: [1, 1] } } },
        1: { height: 40 },
      },
      cols: { len: 2, 0: { width: 80 }, 1: { width: 120 } },
    });
    const before = structuredClone(sheet);

    const layout = createPrintLayout(sheet, { paperSize: 'A4', orientation: 'portrait' });
    const anchor = layout.pages[0]?.cells.find(cell => cell.row === 0 && cell.column === 0);

    expect(sheet).toEqual(before);
    expect(anchor).toMatchObject({
      text: '',
      printable: false,
      rect: { width: 200, height: 70 },
      style: { bgcolor: '#ffeecc' },
      merge: {
        start: { row: 0, column: 0 },
        end: { row: 1, column: 1 },
      },
    });

    const harness = createCanvasHarness();
    renderPrintPage(layout, 0, harness.canvas, {
      devicePixelRatio: 1,
      measurement: harness.measurement,
    });
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === 'secret'
    ))).toBe(false);
    expect(harness.operations.some(operation => (
      operation.name === 'set:fillStyle' && operation.args[0] === '#ffeecc'
    ))).toBe(true);
    expect(harness.operations.some(operation => operation.name === 'stroke')).toBe(true);
  });

  it('prints formulas, scaled styles, borders, validation, and editable marks without blank cells', () => {
    const sheet: SheetData = {
      styles: [{
        format: 'number',
        bgcolor: '#ddeeff',
        border: { bottom: ['dashed', '#112233'] },
      }],
      rows: {
        len: 1,
        0: {
          cells: {
            0: { text: '1' },
            1: { text: '=A1+1', style: 0, editable: false },
          },
        },
      },
      cols: { len: 3, 0: { width: 500 }, 1: { width: 500 }, 2: { width: 100 } },
    };
    const layout = createPrintLayout(sheet, {
      paperSize: 'A5',
      orientation: 'portrait',
      invalidCells: [{ row: 0, column: 1 }],
    });
    const formula = layout.pages[0]?.cells.find(cell => cell.column === 1);

    expect(layout.scale).toBeCloseTo(459 / 1000);
    expect(layout.pages[0]?.cells).toHaveLength(2);
    expect(formula).toMatchObject({
      text: '2.00',
      invalid: true,
      editable: false,
      style: { bgcolor: '#ddeeff' },
    });

    const harness = createCanvasHarness();
    renderPrintPage(layout, 0, harness.canvas, {
      measurement: harness.measurement,
    });
    expect(harness.operations.some(operation => (
      operation.name === 'fillText' && operation.args[0] === '2.00'
    ))).toBe(true);
    expect(harness.operations).toContainEqual({
      name: 'set:lineWidth',
      args: [layout.scale],
    });
    expect(harness.operations).toContainEqual({
      name: 'setLineDash',
      args: [[3 * layout.scale, 2 * layout.scale]],
    });
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['rgba(255, 0, 0, .65)'] });
    expect(harness.operations).toContainEqual({ name: 'set:fillStyle', args: ['rgba(0, 255, 0, .85)'] });
    expect(harness.operations.some(operation => operation.name === 'strokeRect')).toBe(false);
    const formulaRect = formula?.rect;
    expect(formulaRect).toBeDefined();
    if (formulaRect !== undefined) {
      const renderedLeft = layout.contentLeft + formulaRect.left * layout.scale;
      const renderedTop = layout.paper.padding + formulaRect.top * layout.scale;
      const contentClip = [
        renderedLeft + layout.scale,
        renderedTop + layout.scale,
        formulaRect.width * layout.scale - 2 * layout.scale,
        formulaRect.height * layout.scale - 2 * layout.scale,
      ];
      expect(harness.operations.filter(operation => operation.name === 'rect').map(operation => operation.args))
        .toContainEqual(contentClip);
      const borderStroke = harness.operations.findIndex(operation => (
        operation.name === 'set:strokeStyle' && operation.args[0] === '#112233'
      ));
      const clip = harness.operations.findIndex(operation => (
        operation.name === 'rect' && operation.args.every((value, index) => value === contentClip[index])
      ));
      const validationMark = harness.operations.findIndex(operation => (
        operation.name === 'set:fillStyle' && operation.args[0] === 'rgba(255, 0, 0, .65)'
      ));
      expect(borderStroke).toBeLessThan(clip);
      expect(validationMark).toBeGreaterThan(clip);
    }
  });

  it('keeps the legacy blank-sheet page without DOM access', () => {
    const layout = createPrintLayout({ rows: { len: 0 }, cols: { len: 0 } }, {
      paperSize: 'B5',
      orientation: 'landscape',
    });

    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0]?.cells).toEqual([]);
  });

  it('uses the highest row last-cell column instead of a global or merge-extended width', () => {
    const layout = createPrintLayout({
      merges: ['A2:F2'],
      rows: {
        len: 2,
        0: { cells: { 5: { text: 'F1 must be outside legacy contentRange' } } },
        1: { cells: { 0: { text: 'A2' } } },
      },
      cols: { len: 6 },
    }, {
      paperSize: 'A4',
      orientation: 'portrait',
    });

    expect(layout.contentWidth).toBe(100);
    expect(layout.pages.flatMap(page => page.cells).map(cell => cell.text)).toEqual(['A2']);
  });
});
