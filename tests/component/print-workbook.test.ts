import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountPrintPages } from '../../src/ui/print-workbook';
import { createCanvasHarness } from '../helpers/canvas-harness';

const sheet = {
  rows: { len: 1, 0: { cells: { 0: { text: 'print' } } } },
  cols: { len: 1 },
};

beforeEach(() => {
  const context = createCanvasHarness().canvas.getContext('2d');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('[data-tego-print-pages], [data-tego-print-style]')
    .forEach(node => node.remove());
});

it('rolls back the style and host when host installation mutates before failing', () => {
  const failure = new Error('host append failed');
  const append = document.body.append.bind(document.body);
  vi.spyOn(document.body, 'append').mockImplementation((...nodes) => {
    append(...nodes);
    throw failure;
  });

  expect(() => mountPrintPages(sheet, { paper: 'A4', orientation: 'portrait' }))
    .toThrow(failure);

  expect(document.querySelector('[data-tego-print-pages]')).toBeNull();
  expect(document.querySelector('[data-tego-print-style]')).toBeNull();
});

it('drains both removals when the first cleanup operation fails', () => {
  const cleanup = mountPrintPages(sheet, { paper: 'A4', orientation: 'portrait' });
  const host = document.querySelector<HTMLElement>('[data-tego-print-pages]')!;
  const style = document.querySelector<HTMLStyleElement>('[data-tego-print-style]')!;
  const failure = new Error('host removal failed');
  vi.spyOn(host, 'remove').mockImplementation(() => {
    throw failure;
  });
  const removeStyle = vi.spyOn(style, 'remove');

  expect(cleanup).toThrow(failure);

  expect(removeStyle).toHaveBeenCalledOnce();
  expect(document.querySelector('[data-tego-print-pages]')).toBe(host);
  expect(document.querySelector('[data-tego-print-style]')).toBeNull();
});

it('aggregates installation and every rollback failure in operation order', () => {
  const installationFailure = new Error('host append failed');
  const hostCleanupFailure = new Error('host removal failed');
  const styleCleanupFailure = new Error('style removal failed');
  const append = document.body.append.bind(document.body);
  vi.spyOn(document.body, 'append').mockImplementation((...nodes) => {
    append(...nodes);
    throw installationFailure;
  });
  vi.spyOn(Element.prototype, 'remove').mockImplementation(function remove(this: Element) {
    if (this.matches('[data-tego-print-pages]')) throw hostCleanupFailure;
    if (this.matches('[data-tego-print-style]')) throw styleCleanupFailure;
  });

  let thrown: unknown;
  try {
    mountPrintPages(sheet, { paper: 'A4', orientation: 'portrait' });
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(AggregateError);
  expect((thrown as AggregateError).errors).toEqual([
    installationFailure,
    hostCleanupFailure,
    styleCleanupFailure,
  ]);
  expect((thrown as Error & { cause?: unknown }).cause).toBe(installationFailure);
});

it('rolls back already hidden host siblings when isolation fails midway', () => {
  const first = document.createElement('main');
  const second = document.createElement('aside');
  document.body.append(first, second);
  const failure = new Error('second sibling refused hidden');
  const setAttribute = second.setAttribute.bind(second);
  vi.spyOn(second, 'setAttribute').mockImplementation((name, value) => {
    if (name === 'hidden') throw failure;
    setAttribute(name, value);
  });

  expect(() => mountPrintPages(sheet, { paper: 'A4', orientation: 'portrait' }))
    .toThrow(failure);

  expect(first.hasAttribute('hidden')).toBe(false);
  expect(second.hasAttribute('hidden')).toBe(false);
  expect(document.querySelector('[data-tego-print-pages]')).toBeNull();
  expect(document.querySelector('[data-tego-print-style]')).toBeNull();
  first.remove();
  second.remove();
});

it('preserves prior host visibility across nested LIFO print mounts', () => {
  const host = document.createElement('main');
  document.body.append(host);
  const cleanupFirst = mountPrintPages(sheet, { paper: 'A4', orientation: 'portrait' });
  const firstPages = document.querySelector<HTMLElement>('[data-tego-print-pages]')!;
  const cleanupSecond = mountPrintPages(sheet, { paper: 'A5', orientation: 'landscape' });

  expect(host.hasAttribute('hidden')).toBe(true);
  expect(firstPages.hasAttribute('hidden')).toBe(true);
  cleanupSecond();
  expect(host.hasAttribute('hidden')).toBe(true);
  expect(firstPages.hasAttribute('hidden')).toBe(false);
  cleanupFirst();
  expect(host.hasAttribute('hidden')).toBe(false);
  host.remove();
});
