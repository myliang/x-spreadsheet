import { createFormulaEvaluationBudget } from '../../core/formulas/evaluator';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { CellStyle, SheetData } from '../../core/types/workbook';
import { frozenQuadrants } from '../geometry/frozen-pane-geometry';
import type { ViewportMetrics } from '../ports';
import {
  configuredCellDefaultStyle,
  paintCells,
  paintFilterOverlays,
} from './cell-painter';
import { currentDevicePixelRatio, DrawContext } from './draw-context';
import type {
  CanvasSurfacePort,
  TextMeasurementPort,
} from './draw-context';
import {
  createSparseCellScanBudget,
  paintGrid,
  paneCells,
  paneGridIndexes,
} from './grid-painter';
import { paintHeaders } from './header-painter';
import { RenderScheduler } from './render-scheduler';
import type { AnimationFramePort } from './render-scheduler';
import { paintSelection } from './selection-painter';

export type {
  CanvasSurfacePort,
  TextMeasurementPort,
} from './draw-context';
export type { AnimationFramePort } from './render-scheduler';

export interface CanvasRenderSnapshot {
  readonly sheet: Readonly<SheetData>;
  readonly viewport: ViewportMetrics;
  readonly selection?: CellRange;
  readonly invalidCells?: readonly CellPoint[];
  readonly showGrid?: boolean;
}

export interface CanvasEngineOptions {
  readonly animationFrame?: AnimationFramePort;
  readonly defaultStyle?: CellStyle;
  readonly devicePixelRatio?: number;
  readonly measurement?: TextMeasurementPort;
}

function canvasMeasurement(canvas: CanvasSurfacePort): TextMeasurementPort {
  return {
    measureText(text, font) {
      const context = canvas.getContext('2d');
      if (context === null) return text.length * 7;
      context.save();
      context.font = font;
      const width = context.measureText(text).width;
      context.restore();
      return width;
    },
  };
}

export class CanvasEngine {
  private readonly draw: DrawContext;
  private readonly defaultStyle: CellStyle;
  private readonly scheduler: RenderScheduler;
  private latest: CanvasRenderSnapshot | null = null;
  private disposed = false;

  constructor(canvas: CanvasSurfacePort, options: Readonly<CanvasEngineOptions> = {}) {
    this.defaultStyle = configuredCellDefaultStyle(options.defaultStyle);
    this.draw = new DrawContext(
      canvas,
      options.devicePixelRatio ?? currentDevicePixelRatio(),
      options.measurement ?? canvasMeasurement(canvas),
    );
    this.scheduler = new RenderScheduler(options.animationFrame);
  }

  render(snapshot: CanvasRenderSnapshot): void {
    if (this.disposed) return;
    this.latest = snapshot;
    this.scheduler.schedule(() => this.paintLatest());
  }

  private paintLatest(): void {
    const snapshot = this.latest;
    if (snapshot === null || this.disposed) return;
    const { viewport } = snapshot;
    const visibleRows = new Set<number>();
    const visibleColumns = new Set<number>();
    const scanBudget = createSparseCellScanBudget();
    const plans = frozenQuadrants(viewport.freeze, viewport).map(pane => {
      const indexes = paneGridIndexes(pane, viewport);
      const cells = paneCells(viewport, indexes, snapshot.sheet, scanBudget);
      for (const row of indexes.rows) visibleRows.add(row);
      for (const column of indexes.columns) visibleColumns.add(column);
      return { pane, indexes, cells };
    });
    this.draw.resize(viewport.width, viewport.height);
    this.draw.clear(viewport.width, viewport.height);
    const formulaBudget = createFormulaEvaluationBudget(250_000);
    for (const { pane, indexes, cells } of plans) {
      this.draw.withClip(pane, () => {
        if (snapshot.showGrid !== false) paintGrid(this.draw, indexes, viewport);
        paintCells(this.draw, snapshot, cells, formulaBudget, this.defaultStyle);
        paintFilterOverlays(this.draw, snapshot, indexes.rows, indexes.columns);
        paintSelection(this.draw, snapshot.selection, viewport, pane.kind);
      }, {
        x: viewport.rowHeaderWidth
          - (pane.kind === 'top' || pane.kind === 'body' ? viewport.scroll.x : 0),
        y: viewport.columnHeaderHeight
          - (pane.kind === 'left' || pane.kind === 'body' ? viewport.scroll.y : 0),
      });
    }
    paintHeaders(
      this.draw,
      viewport,
      [...visibleRows],
      [...visibleColumns],
      snapshot.selection,
      snapshot.sheet,
    );
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.latest = null;
    this.scheduler.dispose();
  }
}
