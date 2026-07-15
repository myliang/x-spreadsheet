import type { CellStyle, SheetData } from '../core';
import {
  createPrintLayout,
  renderPrintPage,
  type PaperOrientation,
  type PaperSizeName,
} from '../engine';

export interface PrintWorkbookOptions {
  readonly orientation: PaperOrientation;
  readonly paper: PaperSizeName;
}

export function mountPrintPages(
  sheet: SheetData,
  options: PrintWorkbookOptions,
  defaultStyle?: CellStyle,
): () => void {
  const layout = createPrintLayout(sheet, {
    paperSize: options.paper,
    orientation: options.orientation,
    defaultStyle,
  });
  const host = document.createElement('div');
  host.className = 'tego-sheet__print-pages';
  host.setAttribute('data-tego-print-pages', '');
  for (const page of layout.pages) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-page', String(page.index + 1));
    renderPrintPage(layout, page.index, canvas);
    host.append(canvas);
  }
  const style = document.createElement('style');
  style.setAttribute('data-tego-print-style', '');
  style.textContent = `@page { size: ${options.paper} ${options.orientation}; }\n@media print { body > *:not([data-tego-print-pages]) { display: none !important; } }`;
  document.head.append(style);
  document.body.append(host);
  return () => {
    host.remove();
    style.remove();
  };
}
