import type {
  FreezeState,
  GridModelPort,
  ScrollState,
  ViewportMetrics,
} from '../ports';

export interface ViewportState {
  readonly width: number;
  readonly height: number;
  readonly rowHeaderWidth: number;
  readonly columnHeaderHeight: number;
  readonly scroll: ScrollState;
  readonly freeze: FreezeState;
}

export interface ViewportStateInput {
  readonly width: number;
  readonly height: number;
  readonly rowHeaderWidth?: number;
  readonly columnHeaderHeight?: number;
  readonly scroll?: ScrollState;
  readonly freeze?: FreezeState;
}

function dimension(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number`);
  }
  return value;
}

function offset(value: number, label: string): number {
  return dimension(value, label);
}

function freezeIndex(value: number, count: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return Math.min(value, count);
}

export function createViewportState(
  model: GridModelPort,
  input: Readonly<ViewportStateInput>,
): ViewportState {
  return Object.freeze({
    width: dimension(input.width, 'viewport width'),
    height: dimension(input.height, 'viewport height'),
    rowHeaderWidth: dimension(input.rowHeaderWidth ?? 60, 'row header width'),
    columnHeaderHeight: dimension(input.columnHeaderHeight ?? 25, 'column header height'),
    scroll: Object.freeze({
      x: offset(input.scroll?.x ?? 0, 'horizontal scroll'),
      y: offset(input.scroll?.y ?? 0, 'vertical scroll'),
    }),
    freeze: Object.freeze({
      row: freezeIndex(input.freeze?.row ?? 0, model.rowCount, 'frozen row count'),
      column: freezeIndex(
        input.freeze?.column ?? 0,
        model.columnCount,
        'frozen column count',
      ),
    }),
  });
}

export function createViewportMetrics(
  model: GridModelPort,
  input: Readonly<ViewportStateInput>,
): ViewportMetrics {
  return Object.freeze({ model, ...createViewportState(model, input) });
}

export function resizeViewport(
  viewport: ViewportMetrics,
  size: Readonly<{ width: number; height: number }>,
): ViewportMetrics {
  return createViewportMetrics(viewport.model, { ...viewport, ...size });
}
