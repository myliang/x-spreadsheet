import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TegoSheet,
  type Selection,
  type TegoSheetError,
  type TegoSheetHandle,
  type ValidationResult,
  type WorkbookData,
} from 'tego-sheet';

interface PrintSnapshot {
  readonly css: string;
  readonly pages: number;
  readonly canvases: readonly { readonly width: number; readonly height: number }[];
  readonly texts: readonly string[];
  readonly fills: readonly {
    readonly color: string;
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  }[];
  readonly strokes: number;
}

declare global {
  interface Window {
    __tegoHarness: {
      capture(): WorkbookData;
      mount(): void;
      unmount(): void;
      setCellText(row: number, column: number, text: string): void;
      recalculateLayout(): void;
    };
    __tegoPrintCalls?: number;
    __tegoPrintSnapshot?: PrintSnapshot;
    __tegoClipboard?: { reads: number; writes: readonly string[] };
  }
}

const rows = Object.fromEntries(Array.from({ length: 60 }, (_, row) => [String(row), {
  cells: Object.fromEntries(Array.from({ length: 12 }, (_, column) => [String(column), {
    text: row === 0
      ? ['Name', 'Score', 'Double', 'Kind'][column] ?? `H${column + 1}`
      : column === 0 ? (row % 2 === 0 ? 'even' : 'odd')
        : column === 1 ? String(row)
          : column === 2 ? `=B${row + 1}*2`
            : column === 3 ? (row % 2 === 0 ? 'even' : 'odd')
              : '',
  }])),
}])) as WorkbookData[number]['rows'];

const workbook: WorkbookData = [{
  name: 'Browser',
  rows: { len: 60, ...rows },
  cols: { len: 12 },
  autofilter: { ref: 'A1:D60' },
}];

const alternateWorkbook: WorkbookData = [{
  name: 'Alternate',
  rows: { len: 2, 0: { cells: { 0: { text: 'alternate-only' } } } },
  cols: { len: 2 },
}];

const printWorkbook: WorkbookData = [{
  name: 'Print',
  styles: [{ bgcolor: '#ffeecc', border: { bottom: ['thick', '#ff0000'] } }],
  merges: ['A1:B2'],
  rows: {
    len: 2,
    0: { height: 30, cells: { 0: { text: 'secret-never-print', printable: false, style: 0, merge: [1, 1] } } },
    1: { height: 40 },
  },
  cols: { len: 2, 0: { width: 80 }, 1: { width: 120 } },
}];

function installClipboard(mode: string | null): void {
  const state = { reads: 0, writes: [] as string[] };
  window.__tegoClipboard = state;
  const denied = () => Promise.reject(new DOMException('clipboard blocked', 'NotAllowedError'));
  const bridge = mode === 'deny' ? { readText: denied, writeText: denied } : {
    readText: async () => {
      state.reads += 1;
      return 'pasted\tfrom-browser';
    },
    writeText: async (text: string) => {
      state.writes.push(text);
    },
  };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: bridge });
}

function installPrintProbe(): void {
  const texts: Array<{ readonly canvas: HTMLCanvasElement; readonly text: string }> = [];
  const fills: Array<{
    readonly canvas: HTMLCanvasElement;
    readonly color: string;
    readonly height: number;
    readonly width: number;
    readonly x: number;
    readonly y: number;
  }> = [];
  const strokes: HTMLCanvasElement[] = [];
  const prototype = CanvasRenderingContext2D.prototype;
  const nativeFillText = prototype.fillText;
  const nativeFillRect = prototype.fillRect;
  const nativeStroke = prototype.stroke;
  prototype.fillText = function(text, x, y, maxWidth) {
    texts.push({ canvas: this.canvas, text });
    if (maxWidth === undefined) nativeFillText.call(this, text, x, y);
    else nativeFillText.call(this, text, x, y, maxWidth);
  };
  prototype.fillRect = function(x, y, width, height) {
    fills.push({ canvas: this.canvas, color: String(this.fillStyle), height, width, x, y });
    nativeFillRect.call(this, x, y, width, height);
  };
  prototype.stroke = function(this: CanvasRenderingContext2D, path?: Path2D) {
    strokes.push(this.canvas);
    Reflect.apply(nativeStroke, this, path === undefined ? [] : [path]);
  } as CanvasRenderingContext2D['stroke'];
  window.print = () => {
    window.__tegoPrintCalls = (window.__tegoPrintCalls ?? 0) + 1;
    const host = document.querySelector('[data-tego-print-pages]');
    const canvases = host === null ? [] : [...host.querySelectorAll('canvas')];
    const active = new Set(canvases);
    window.__tegoPrintSnapshot = {
      css: document.querySelector('[data-tego-print-style]')?.textContent ?? '',
      pages: canvases.length,
      canvases: canvases.map(canvas => ({ height: canvas.height, width: canvas.width })),
      texts: texts.filter(item => active.has(item.canvas)).map(item => item.text),
      fills: fills.filter(item => active.has(item.canvas)).map(item => ({
        color: item.color,
        height: item.height,
        width: item.width,
        x: item.x,
        y: item.y,
      })),
      strokes: strokes.filter(canvas => active.has(canvas)).length,
    };
  };
}

const params = new URLSearchParams(location.search);
installClipboard(params.get('clipboard'));
installPrintProbe();

export function ScenarioHost() {
  const sheet = useRef<TegoSheetHandle>(null);
  const selectionRef = useRef<Selection | null>(null);
  const [mounted, setMounted] = useState(params.get('mounted') !== '0');
  const [value, setValue] = useState<WorkbookData>(workbook);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<TegoSheetError | null>(null);
  const [capture, setCapture] = useState<WorkbookData>(workbook);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [zoom, setZoom] = useState(1);
  const [readOnly, setReadOnly] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const takeSnapshot = useCallback(() => {
    const next = sheet.current?.getValue() ?? [];
    setCapture(next);
    return next;
  }, []);
  useEffect(() => {
    window.__tegoHarness = {
      capture: takeSnapshot,
      mount: () => setMounted(true),
      unmount: () => setMounted(false),
      setCellText: (row, column, text) => {
        const sheetId = selectionRef.current?.sheet;
        if (sheetId !== undefined) sheet.current?.setCellText({ sheet: sheetId, row, column }, text);
      },
      recalculateLayout: () => sheet.current?.recalculateLayout(),
    };
  }, [takeSnapshot]);

  const download = () => {
    const blob = new Blob([JSON.stringify(sheet.current?.getValue() ?? [])], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'workbook.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main>
      <nav aria-label="Harness controls">
        <button type="button" onClick={() => setValue(structuredClone(workbook))}>Import workbook</button>
        <button type="button" onClick={() => setValue(structuredClone(alternateWorkbook))}>Load alternate workbook</button>
        <button type="button" onClick={() => setValue(structuredClone(printWorkbook))}>Load print fixture</button>
        <button type="button" onClick={takeSnapshot}>Capture workbook</button>
        <button type="button" onClick={() => setValidation(sheet.current?.validate() ?? null)}>Validate workbook</button>
        <button type="button" onClick={download}>Download workbook</button>
        <button type="button" onClick={() => {
          setZoom(current => current === 1 ? 1.25 : 1);
          requestAnimationFrame(() => sheet.current?.recalculateLayout());
        }}>Toggle zoom</button>
        <button type="button" onClick={() => setReadOnly(current => !current)}>Toggle read only</button>
        <button type="button" onClick={() => setShowGrid(current => !current)}>Toggle grid</button>
        <button type="button" onClick={() => setMounted(false)}>Unmount sheet</button>
        <button type="button" onClick={() => setMounted(true)}>Mount sheet</button>
      </nav>
      <section data-testid="sheet-frame" style={{ height: 620, zoom }}>
        {mounted ? (
          <TegoSheet
            ref={sheet}
            value={value}
            readOnly={readOnly}
            options={{ showGrid }}
            onChange={next => setValue(next)}
            onSelectionChange={next => {
              selectionRef.current = next;
              setSelection(next);
            }}
            onError={setError}
          />
        ) : null}
      </section>
      <output data-testid="selection">{JSON.stringify(selection)}</output>
      <output data-testid="error">{JSON.stringify(error)}</output>
      <output data-testid="capture">{JSON.stringify(capture)}</output>
      <output data-testid="validation">{JSON.stringify(validation)}</output>
    </main>
  );
}
