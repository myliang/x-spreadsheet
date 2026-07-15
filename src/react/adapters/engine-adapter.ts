import {
  parseA1,
  type ControllerSnapshot,
  type Selection,
  type SheetId,
  type SheetOptions,
} from '../../core';
import {
  CanvasEngine,
  clampScroll,
  createSelectionState,
  createSheetGridModel,
  createViewportMetrics,
  normalizeSelection,
  type CanvasRenderSnapshot,
  type InteractionSnapshot,
  type ScrollState,
  type SelectionState,
  type ViewportMetrics,
} from '../../engine';

export interface EngineAdapterOptions {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly sheetOptions?: SheetOptions;
}

export interface EngineAdapter {
  readonly interactionSnapshot: () => InteractionSnapshot | null;
  readonly publicSelection: () => Selection | null;
  readonly readSelection: (selection: Selection) => readonly (readonly string[])[];
  readonly refresh: (snapshot: ControllerSnapshot) => void;
  readonly render: (snapshot: ControllerSnapshot, activeSheet: SheetId | null) => void;
  readonly recalculateLayout: () => void;
  readonly setScroll: (scroll: ScrollState) => void;
  readonly setSelection: (selection: SelectionState) => void;
  readonly dispose: () => void;
}

const MAX_CLIPBOARD_CELLS = 250_000;

function dimensions(root: HTMLElement): { readonly width: number; readonly height: number } {
  const rect = root.getBoundingClientRect();
  return {
    width: Math.max(0, root.clientWidth || rect.width || 0),
    height: Math.max(0, root.clientHeight || rect.height || 0),
  };
}

function clippedFreeze(value: string | undefined): { readonly row: number; readonly column: number } {
  return parseA1(value ?? 'A1');
}

export function createEngineAdapter(options: EngineAdapterOptions): EngineAdapter {
  const engine = new CanvasEngine(options.canvas, {
    defaultStyle: options.sheetOptions?.defaultStyle,
  });
  let latestSnapshot: ControllerSnapshot | null = null;
  let activeSheet: SheetId | null = null;
  let viewport: ViewportMetrics | null = null;
  let selection: SelectionState | null = null;
  let disposed = false;

  const activeIndex = (): number => {
    if (latestSnapshot === null || activeSheet === null) return -1;
    return latestSnapshot.sheets.findIndex(sheet => sheet.id === activeSheet);
  };

  const paint = () => {
    if (disposed || latestSnapshot === null || viewport === null) return;
    const index = activeIndex();
    const sheet = index < 0 ? undefined : latestSnapshot.value[index];
    if (sheet === undefined) return;
    const renderSnapshot: CanvasRenderSnapshot = {
      sheet,
      viewport,
      ...(selection === null ? {} : { selection: selection.range }),
      showGrid: options.sheetOptions?.showGrid,
    };
    engine.render(renderSnapshot);
  };

  const rebuild = () => {
    if (disposed || latestSnapshot === null) return;
    const index = activeIndex();
    const sheet = index < 0 ? undefined : latestSnapshot.value[index];
    if (sheet === undefined) {
      viewport = null;
      selection = null;
      return;
    }
    const model = createSheetGridModel(sheet, {
      defaultRowHeight: options.sheetOptions?.rows?.defaultHeight,
      defaultColumnWidth: options.sheetOptions?.columns?.defaultWidth,
    });
    const previousScroll = viewport?.scroll ?? { x: 0, y: 0 };
    viewport = createViewportMetrics(model, {
      ...dimensions(options.root),
      rowHeaderWidth: options.sheetOptions?.rowHeaderWidth,
      scroll: previousScroll,
      freeze: clippedFreeze(sheet.freeze),
    });
    const clippedScroll = clampScroll(previousScroll, viewport);
    if (clippedScroll.x !== previousScroll.x || clippedScroll.y !== previousScroll.y) {
      viewport = createViewportMetrics(model, { ...viewport, scroll: clippedScroll });
    }
    if (model.rowCount === 0 || model.columnCount === 0) {
      selection = null;
    } else {
      selection = normalizeSelection(
        selection ?? createSelectionState({ row: 0, column: 0 }),
        model,
      );
    }
    paint();
  };

  return {
    interactionSnapshot() {
      if (
        disposed
        || latestSnapshot === null
        || activeSheet === null
        || viewport === null
        || selection === null
      ) return null;
      return {
        viewport,
        selection,
        sheet: activeSheet,
        readOnly: latestSnapshot.readOnly,
        epoch: latestSnapshot,
      };
    },
    publicSelection() {
      if (activeSheet === null || selection === null) return null;
      return {
        sheet: activeSheet,
        range: selection.range,
        active: selection.active,
      };
    },
    readSelection(requested) {
      if (latestSnapshot === null) return [];
      const index = latestSnapshot.sheets.findIndex(sheet => sheet.id === requested.sheet);
      const sheet = index < 0 ? undefined : latestSnapshot.value[index];
      if (sheet === undefined) return [];
      const rows = requested.range.end.row - requested.range.start.row + 1;
      const columns = requested.range.end.column - requested.range.start.column + 1;
      if (rows * columns > MAX_CLIPBOARD_CELLS) return [];
      const output: string[][] = [];
      for (let row = requested.range.start.row; row <= requested.range.end.row; row += 1) {
        const values: string[] = [];
        for (
          let column = requested.range.start.column;
          column <= requested.range.end.column;
          column += 1
        ) {
          const rowData = sheet.rows?.[String(row)];
          const rowRecord = typeof rowData === 'object' && rowData !== null && !Array.isArray(rowData)
            ? rowData as Readonly<Record<string, unknown>>
            : undefined;
          const cells = rowRecord?.cells;
          const cell = typeof cells === 'object' && cells !== null && !Array.isArray(cells)
            ? (cells as Readonly<Record<string, unknown>>)[String(column)]
            : undefined;
          const cellRecord = typeof cell === 'object' && cell !== null && !Array.isArray(cell)
            ? cell as Readonly<Record<string, unknown>>
            : undefined;
          values.push(typeof cellRecord?.text === 'string' ? cellRecord.text : '');
        }
        output.push(values);
      }
      return output;
    },
    refresh(snapshot) {
      if (disposed) return;
      latestSnapshot = snapshot;
      rebuild();
    },
    render(snapshot, sheet) {
      if (disposed) return;
      latestSnapshot = snapshot;
      activeSheet = sheet;
      rebuild();
    },
    recalculateLayout() {
      rebuild();
    },
    setScroll(scroll) {
      if (disposed || viewport === null) return;
      viewport = createViewportMetrics(viewport.model, { ...viewport, scroll });
      paint();
    },
    setSelection(next) {
      if (disposed || viewport === null) return;
      selection = normalizeSelection(next, viewport.model);
      paint();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      latestSnapshot = null;
      viewport = null;
      selection = null;
      engine.dispose();
    },
  };
}
