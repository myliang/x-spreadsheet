import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TegoSheet } from 'tego-sheet';
import { de, en } from 'tego-sheet/locales';
import 'tego-sheet/styles.css';
import { visualFixture } from '../../fixtures';
import './visual.css';

interface FillRecord {
  readonly fill: string;
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

interface LineRecord {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  readonly stroke: string;
}

interface StrokeRectRecord {
  readonly height: number;
  readonly stroke: string;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

declare global {
  interface Window {
    __tegoVisual: {
      readonly fills: FillRecord[];
      readonly lines: LineRecord[];
      readonly strokeRects: StrokeRectRecord[];
    };
    __tegoVisualReady: boolean;
  }
}

function recordCanvasGeometry(): void {
  const records = { fills: [] as FillRecord[], lines: [] as LineRecord[], strokeRects: [] as StrokeRectRecord[] };
  window.__tegoVisual = records;
  const paths = new WeakMap<CanvasRenderingContext2D, Array<{ x: number; y: number }>>();
  const prototype = CanvasRenderingContext2D.prototype;
  const beginPath = prototype.beginPath;
  const fillRect = prototype.fillRect;
  const lineTo = prototype.lineTo;
  const moveTo = prototype.moveTo;
  const stroke = prototype.stroke;
  const strokeRect = prototype.strokeRect;
  const transformedPoint = (context: CanvasRenderingContext2D, x: number, y: number) => {
    const matrix = context.getTransform();
    const ratio = window.devicePixelRatio;
    return {
      x: (matrix.a * x + matrix.c * y + matrix.e) / ratio,
      y: (matrix.b * x + matrix.d * y + matrix.f) / ratio,
    };
  };

  prototype.beginPath = function() {
    paths.set(this, []);
    beginPath.call(this);
  };
  prototype.moveTo = function(x, y) {
    paths.set(this, [transformedPoint(this, x, y)]);
    moveTo.call(this, x, y);
  };
  prototype.lineTo = function(x, y) {
    const path = paths.get(this) ?? [];
    path.push(transformedPoint(this, x, y));
    paths.set(this, path);
    lineTo.call(this, x, y);
  };
  prototype.fillRect = function(x, y, width, height) {
    const start = transformedPoint(this, x, y);
    const end = transformedPoint(this, x + width, y + height);
    records.fills.push({
      fill: String(this.fillStyle),
      height: end.y - start.y,
      width: end.x - start.x,
      x: start.x,
      y: start.y,
    });
    fillRect.call(this, x, y, width, height);
  };
  prototype.strokeRect = function(x, y, width, height) {
    const start = transformedPoint(this, x, y);
    const end = transformedPoint(this, x + width, y + height);
    records.strokeRects.push({
      height: end.y - start.y,
      stroke: String(this.strokeStyle),
      width: end.x - start.x,
      x: start.x,
      y: start.y,
    });
    strokeRect.call(this, x, y, width, height);
  };
  prototype.stroke = function(this: CanvasRenderingContext2D, path?: Path2D) {
    const points = paths.get(this);
    if (points !== undefined && points.length > 1) {
      records.lines.push({ points: [...points], stroke: String(this.strokeStyle) });
    }
    Reflect.apply(stroke, this, path === undefined ? [] : [path]);
  } as CanvasRenderingContext2D['stroke'];
}

recordCanvasGeometry();
const fixtureName = new URLSearchParams(location.search).get('fixture') ?? 'default-workbook';
const fixture = visualFixture(fixtureName);
const locale = fixture.locale === 'de' ? de : en;
const root = document.querySelector('#root');
if (root === null) throw new Error('Visual harness root is missing');

await Promise.all([
  document.fonts.load('400 13px "Noto Sans Visual"'),
  document.fonts.load('400 13px Arial'),
  document.fonts.load('400 12px "Source Sans Pro"'),
]);
await document.fonts.ready;

createRoot(root).render(
  <StrictMode>
    <main className="visual-harness" data-visual-fixture={fixture.name}>
      <TegoSheet defaultValue={fixture.workbook} locale={locale} />
    </main>
  </StrictMode>,
);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.__tegoVisualReady = true;
  });
});
