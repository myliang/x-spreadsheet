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

interface PrintSnapshot {
  readonly css: string;
  readonly fills: readonly FillRecord[];
  readonly pages: readonly { readonly height: number; readonly width: number }[];
  readonly strokes: number;
  readonly texts: readonly string[];
}

declare global {
  interface Window {
    __tegoVisual: {
      readonly fills: FillRecord[];
      readonly installCaretMask: () => void;
      readonly lines: LineRecord[];
      readonly strokeRects: StrokeRectRecord[];
      printSnapshot: PrintSnapshot | null;
    };
    __tegoVisualReady: boolean;
  }
}

function recordCanvasGeometry(): void {
  const installCaretMask = () => {
    document.querySelector('[data-visual-mask="blinking-caret"]')?.remove();
    const editor = document.querySelector<HTMLTextAreaElement>('.tego-sheet__editor textarea');
    if (editor === null) throw new Error('Cell editor is not mounted');
    const bounds = editor.getBoundingClientRect();
    const styles = getComputedStyle(editor);
    const paddingLeft = Number.parseFloat(styles.paddingLeft);
    const paddingTop = Number.parseFloat(styles.paddingTop);
    const lineHeight = Number.parseFloat(styles.lineHeight);
    const mask = document.createElement('span');
    mask.setAttribute('data-visual-mask', 'blinking-caret');
    mask.style.position = 'fixed';
    mask.style.left = `${bounds.left + paddingLeft}px`;
    mask.style.top = `${bounds.top + paddingTop}px`;
    mask.style.width = '2px';
    mask.style.height = `${lineHeight}px`;
    mask.style.pointerEvents = 'none';
    document.body.append(mask);
  };
  const records = {
    fills: [] as FillRecord[],
    installCaretMask,
    lines: [] as LineRecord[],
    printSnapshot: null as PrintSnapshot | null,
    strokeRects: [] as StrokeRectRecord[],
  };
  window.__tegoVisual = records;
  const paths = new WeakMap<CanvasRenderingContext2D, Array<{ x: number; y: number }>>();
  const fillsByCanvas = new WeakMap<HTMLCanvasElement, FillRecord[]>();
  const linesByCanvas = new WeakMap<HTMLCanvasElement, LineRecord[]>();
  const textsByCanvas = new WeakMap<HTMLCanvasElement, string[]>();
  const prototype = CanvasRenderingContext2D.prototype;
  const beginPath = prototype.beginPath;
  const fillRect = prototype.fillRect;
  const fillText = prototype.fillText;
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
    const record = {
      fill: String(this.fillStyle),
      height: end.y - start.y,
      width: end.x - start.x,
      x: start.x,
      y: start.y,
    };
    records.fills.push(record);
    const canvasRecords = fillsByCanvas.get(this.canvas) ?? [];
    canvasRecords.push(record);
    fillsByCanvas.set(this.canvas, canvasRecords);
    fillRect.call(this, x, y, width, height);
  };
  prototype.fillText = function(text, x, y, maxWidth) {
    const canvasRecords = textsByCanvas.get(this.canvas) ?? [];
    canvasRecords.push(String(text));
    textsByCanvas.set(this.canvas, canvasRecords);
    if (maxWidth === undefined) fillText.call(this, text, x, y);
    else fillText.call(this, text, x, y, maxWidth);
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
      const record = { points: [...points], stroke: String(this.strokeStyle) };
      records.lines.push(record);
      const canvasRecords = linesByCanvas.get(this.canvas) ?? [];
      canvasRecords.push(record);
      linesByCanvas.set(this.canvas, canvasRecords);
    }
    Reflect.apply(stroke, this, path === undefined ? [] : [path]);
  } as CanvasRenderingContext2D['stroke'];

  window.print = () => {
    const sourceHost = document.querySelector('[data-tego-print-pages]');
    if (sourceHost === null) throw new Error('Print pages were not mounted before window.print');
    const canvases = [...sourceHost.querySelectorAll('canvas')];
    document.querySelector('[data-visual-print-preview]')?.remove();
    const preview = document.createElement('section');
    preview.setAttribute('data-visual-print-preview', '');

    for (const [index, source] of canvases.entries()) {
      const page = document.createElement('canvas');
      page.width = source.width;
      page.height = source.height;
      page.style.width = source.style.width;
      page.style.height = source.style.height;
      page.setAttribute('data-visual-print-page', String(index + 1));
      page.getContext('2d')?.drawImage(source, 0, 0);
      preview.append(page);

      if (index === 0) {
        const scale = source.width / Number.parseFloat(source.style.width);
        const crop = document.createElement('canvas');
        crop.width = Math.round(410 * scale);
        crop.height = Math.round(90 * scale);
        crop.style.width = '410px';
        crop.style.height = '90px';
        crop.setAttribute('data-visual-print-crop', 'printable-cells');
        crop.getContext('2d')?.drawImage(
          source,
          40 * scale,
          40 * scale,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height,
        );
        preview.append(crop);
      }
    }

    records.printSnapshot = {
      css: document.querySelector('[data-tego-print-style]')?.textContent ?? '',
      fills: canvases.flatMap(canvas => fillsByCanvas.get(canvas) ?? []),
      pages: canvases.map(canvas => ({ height: canvas.height, width: canvas.width })),
      strokes: canvases.reduce((count, canvas) => count + (linesByCanvas.get(canvas)?.length ?? 0), 0),
      texts: canvases.flatMap(canvas => textsByCanvas.get(canvas) ?? []),
    };
    document.body.append(preview);
  };
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
