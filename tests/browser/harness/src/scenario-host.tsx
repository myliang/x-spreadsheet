import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TegoSheet,
  type Selection,
  type TegoSheetError,
  type TegoSheetHandle,
  type WorkbookData,
} from 'tego-sheet';

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

const params = new URLSearchParams(location.search);
installClipboard(params.get('clipboard'));
window.print = () => {
  window.__tegoPrintCalls = (window.__tegoPrintCalls ?? 0) + 1;
};

export function ScenarioHost() {
  const sheet = useRef<TegoSheetHandle>(null);
  const selectionRef = useRef<Selection | null>(null);
  const [mounted, setMounted] = useState(params.get('mounted') !== '0');
  const [value, setValue] = useState<WorkbookData>(workbook);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<TegoSheetError | null>(null);
  const [capture, setCapture] = useState<WorkbookData>(workbook);
  const [zoom, setZoom] = useState(1);

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
        <button type="button" onClick={() => setValue(workbook)}>Import workbook</button>
        <button type="button" onClick={takeSnapshot}>Capture workbook</button>
        <button type="button" onClick={download}>Download workbook</button>
        <button type="button" onClick={() => {
          setZoom(current => current === 1 ? 1.25 : 1);
          requestAnimationFrame(() => sheet.current?.recalculateLayout());
        }}>Toggle zoom</button>
        <button type="button" onClick={() => setMounted(false)}>Unmount sheet</button>
        <button type="button" onClick={() => setMounted(true)}>Mount sheet</button>
      </nav>
      <section data-testid="sheet-frame" style={{ height: 620, zoom }}>
        {mounted ? (
          <TegoSheet
            ref={sheet}
            value={value}
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
    </main>
  );
}
