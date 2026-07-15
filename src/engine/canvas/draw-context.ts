import type { CssPoint, CssRect } from '../ports';

export interface CanvasStylePort {
  width: string;
  height: string;
}

export interface CanvasSurfacePort {
  width: number;
  height: number;
  readonly style: CanvasStylePort;
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
}

export interface TextMeasurementPort {
  measureText(text: string, font: string): number;
}

export interface DrawTextOptions {
  readonly align: CanvasTextAlign;
  readonly baseline: CanvasTextBaseline;
  readonly color: string;
  readonly font: string;
}

export interface DrawLineOptions {
  readonly color: string;
  readonly style?: string;
  readonly width?: number;
  readonly scale?: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function positiveDpr(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('device pixel ratio must be a positive finite number');
  }
  return value;
}

export class DrawContext {
  readonly canvas: CanvasSurfacePort;
  readonly context: CanvasRenderingContext2D;
  readonly measurement: TextMeasurementPort;
  readonly devicePixelRatio: number;
  private originX = 0;
  private originY = 0;

  constructor(
    canvas: CanvasSurfacePort,
    devicePixelRatio: number,
    measurement: TextMeasurementPort,
  ) {
    const context = canvas.getContext('2d');
    if (context === null) throw new TypeError('Canvas 2D context is unavailable');
    this.canvas = canvas;
    this.context = context;
    this.measurement = measurement;
    this.devicePixelRatio = positiveDpr(devicePixelRatio);
  }

  resize(width: number, height: number): void {
    finite(width, 'canvas width');
    finite(height, 'canvas height');
    if (width < 0 || height < 0) throw new RangeError('canvas size must be non-negative');
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.floor(width * this.devicePixelRatio);
    this.canvas.height = Math.floor(height * this.devicePixelRatio);
    this.originX = 0;
    this.originY = 0;
    // Assigning canvas width/height resets context state, so rebuild the transform every frame.
    this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
  }

  clear(width: number, height: number): void {
    this.context.clearRect(0, 0, width, height);
  }

  save(): void {
    this.context.save();
  }

  restore(): void {
    this.context.restore();
  }

  withClip(
    rect: CssRect,
    paint: () => void,
    translation?: CssPoint,
  ): void {
    this.save();
    this.context.beginPath();
    this.context.rect(
      rect.left - this.originX,
      rect.top - this.originY,
      rect.width,
      rect.height,
    );
    this.context.clip();
    const previousX = this.originX;
    const previousY = this.originY;
    if (translation !== undefined) {
      this.context.translate(translation.x, translation.y);
      this.originX += translation.x;
      this.originY += translation.y;
    }
    try {
      paint();
    } finally {
      this.originX = previousX;
      this.originY = previousY;
      this.restore();
    }
  }

  fillRect(rect: CssRect, color: string): void {
    this.context.fillStyle = color;
    this.context.fillRect(
      rect.left - this.originX,
      rect.top - this.originY,
      rect.width,
      rect.height,
    );
  }

  strokeRect(rect: CssRect, color: string, width = 1): void {
    this.context.strokeStyle = color;
    this.context.lineWidth = width;
    this.context.setLineDash([]);
    this.context.strokeRect(
      rect.left - this.originX,
      rect.top - this.originY,
      rect.width,
      rect.height,
    );
  }

  line(start: CssPoint, end: CssPoint, options: DrawLineOptions): void {
    const scale = options.scale ?? 1;
    const width = options.style === 'medium'
      ? 2 * scale
      : options.style === 'thick'
        ? 3 * scale
        : (options.width ?? 1) * scale;
    this.context.strokeStyle = options.color;
    this.context.lineWidth = width;
    this.context.setLineDash(
      options.style === 'dashed'
        ? [3 * scale, 2 * scale]
        : options.style === 'dotted'
          ? [scale, scale]
          : options.style === 'double'
            ? [2 * scale, 0]
            : [],
    );
    this.context.beginPath();
    this.context.moveTo(start.x - this.originX, start.y - this.originY);
    this.context.lineTo(end.x - this.originX, end.y - this.originY);
    this.context.stroke();
  }

  text(text: string, point: CssPoint, options: DrawTextOptions): void {
    this.context.fillStyle = options.color;
    this.context.font = options.font;
    this.context.textAlign = options.align;
    this.context.textBaseline = options.baseline;
    this.context.fillText(text, point.x - this.originX, point.y - this.originY);
  }

  triangle(points: readonly [CssPoint, CssPoint, CssPoint], color: string): void {
    this.context.save();
    this.context.beginPath();
    this.context.moveTo(points[0].x - this.originX, points[0].y - this.originY);
    this.context.lineTo(points[1].x - this.originX, points[1].y - this.originY);
    this.context.lineTo(points[2].x - this.originX, points[2].y - this.originY);
    this.context.closePath();
    this.context.fillStyle = color;
    this.context.fill();
    this.context.restore();
  }
}
