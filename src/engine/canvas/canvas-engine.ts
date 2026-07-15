import { createFormulaEvaluationBudget } from '../../core/formulas/evaluator';
import type { CellPoint, CellRange } from '../../core/types/coordinates';
import type { SheetData } from '../../core/types/workbook';
import { frozenQuadrants } from '../geometry/frozen-pane-geometry';
import type { ViewportMetrics } from '../ports';
import { paintCells } from './cell-painter';
import { DrawContext } from './draw-context';
import type {
  CanvasSurfacePort,
  TextMeasurementPort,
} from './draw-context';
import { paintGrid, paneCells } from './grid-painter';
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
  readonly devicePixelRatio?: number;
  readonly measurement?: TextMeasurementPort;
}

function currentDevicePixelRatio(): number {
  const value = globalThis.devicePixelRatio;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 1;
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
  private readonly scheduler: RenderScheduler;
  private latest: CanvasRenderSnapshot | null = null;
  private disposed = false;

  constructor(canvas: CanvasSurfacePort, options: Readonly<CanvasEngineOptions> = {}) {
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
    this.draw.resize(viewport.width, viewport.height);
    this.draw.clear(viewport.width, viewport.height);
    const allCells = new Map<string, CellPoint>();
    const formulaBudget = createFormulaEvaluationBudget(250_000);
    for (const pane of frozenQuadrants(viewport.freeze, viewport)) {
      const cells = paneCells(pane, viewport);
      for (const point of cells) allCells.set(`${point.row}:${point.column}`, point);
      this.draw.withClip(pane, () => {
        if (snapshot.showGrid !== false) paintGrid(this.draw, cells, viewport);
        paintCells(this.draw, snapshot, cells, formulaBudget);
        paintSelection(this.draw, snapshot.selection, viewport);
      }, {
        x: viewport.rowHeaderWidth
          - (pane.kind === 'top' || pane.kind === 'body' ? viewport.scroll.x : 0),
        y: viewport.columnHeaderHeight
          - (pane.kind === 'left' || pane.kind === 'body' ? viewport.scroll.y : 0),
      });
    }
    paintHeaders(this.draw, viewport, [...allCells.values()], snapshot.selection);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.latest = null;
    this.scheduler.dispose();
  }
}
