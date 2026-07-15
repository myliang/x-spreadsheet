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

interface HiddenPrintSibling {
  readonly element: Element;
  readonly wasHidden: boolean;
}

function hidePrintSiblings(): readonly HiddenPrintSibling[] {
  const hidden: HiddenPrintSibling[] = [];
  try {
    for (const element of document.body.children) {
      const sibling = { element, wasHidden: element.hasAttribute('hidden') };
      hidden.push(sibling);
      element.setAttribute('hidden', '');
    }
    return hidden;
  } catch (error) {
    const rollbackErrors = restorePrintSiblings(hidden);
    if (rollbackErrors.length === 0) throw error;
    throw new AggregateError(
      [error, ...rollbackErrors],
      'Print sibling isolation and rollback both failed',
      { cause: error },
    );
  }
}

function restorePrintSiblings(siblings: readonly HiddenPrintSibling[]): unknown[] {
  const errors: unknown[] = [];
  for (const sibling of siblings) {
    if (sibling.wasHidden) continue;
    try {
      sibling.element.removeAttribute('hidden');
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
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
  host.className = 'tego-sheet tego-sheet__print-pages';
  host.setAttribute('data-tego-print-pages', '');
  for (const page of layout.pages) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-page', String(page.index + 1));
    renderPrintPage(layout, page.index, canvas);
    host.append(canvas);
  }
  const style = document.createElement('style');
  style.setAttribute('data-tego-print-style', '');
  style.textContent = `@page { size: ${options.paper} ${options.orientation}; }`;
  // printWorkbook mounts and cleans synchronously. Remembering the prior hidden
  // attribute also makes nested mounts safe when they are released in LIFO order.
  let hiddenSiblings: readonly HiddenPrintSibling[] = [];
  try {
    document.head.append(style);
    hiddenSiblings = hidePrintSiblings();
    document.body.append(host);
  } catch (error) {
    const cleanupErrors = [
      ...removePrintNodes(host, style),
      ...restorePrintSiblings(hiddenSiblings),
    ];
    if (cleanupErrors.length === 0) throw error;
    throw new AggregateError(
      [error, ...cleanupErrors],
      'Print page installation and rollback failed',
      { cause: error },
    );
  }
  return () => {
    throwCleanupErrors([
      ...removePrintNodes(host, style),
      ...restorePrintSiblings(hiddenSiblings),
    ]);
  };
}
