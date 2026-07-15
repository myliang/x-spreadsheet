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

function removePrintNodes(host: HTMLElement, style: HTMLStyleElement): unknown[] {
  const errors: unknown[] = [];
  for (const node of [host, style]) {
    try {
      node.remove();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

function throwCleanupErrors(errors: readonly unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'Print page cleanup failed');
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
  try {
    document.head.append(style);
    document.body.append(host);
  } catch (error) {
    const cleanupErrors = removePrintNodes(host, style);
    if (cleanupErrors.length === 0) throw error;
    throw new AggregateError(
      [error, ...cleanupErrors],
      'Print page installation and rollback failed',
      { cause: error },
    );
  }
  return () => {
    throwCleanupErrors(removePrintNodes(host, style));
  };
}
