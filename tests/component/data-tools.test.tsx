import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet, type SheetId, type TegoSheetHandle } from '../../src';
import { createCanvasHarness } from '../helpers/canvas-harness';

beforeEach(() => {
  const context = createCanvasHarness().canvas.getContext('2d');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('runs validation, filter, sort, print, and tab operations through default React chrome', async () => {
  const ref = createRef<TegoSheetHandle>();
  let printStyle = '';
  let printPages = 0;
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    printStyle = document.querySelector('[data-tego-print-style]')?.textContent ?? '';
    printPages = document.querySelectorAll('[data-tego-print-pages] canvas').length;
  });
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{
        name: 'Data',
        rows: {
          len: 3,
          0: { cells: { 0: { text: 'Name' } } },
          1: { cells: { 0: { text: 'Alpha' } } },
        },
        cols: { len: 2 },
      }]}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 300 },
  });
  fireEvent(window, new Event('resize'));

  fireEvent.contextMenu(root, { clientX: 70, clientY: 40 });
  let contextMenu = rendered.getByRole('menu', { name: /cell actions/i });
  fireEvent.click(within(contextMenu).getByRole('menuitem', { name: /data validation/i }));
  expect(rendered.queryByRole('menu', { name: /cell actions/i })).toBeNull();
  const validation = rendered.getByRole('dialog', { name: /data validation/i });
  fireEvent.change(validation.querySelector('select[name="type"]')!, { target: { value: 'number' } });
  fireEvent.click(rendered.getByRole('button', { name: /^save$/i }));
  expect(ref.current!.getValue()[0]!.validations).toHaveLength(1);
  fireEvent.click(rendered.getByRole('button', { name: /data validation/i }));
  fireEvent.click(rendered.getByRole('button', { name: /remove validation/i }));
  expect(ref.current!.getValue()[0]!.validations ?? []).toHaveLength(0);

  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
  fireEvent.contextMenu(root, { clientX: 70, clientY: 40 });
  contextMenu = rendered.getByRole('menu', { name: /cell actions/i });
  fireEvent.click(within(contextMenu).getByRole('menuitem', { name: /^filter$/i }));
  expect(rendered.queryByRole('menu', { name: /cell actions/i })).toBeNull();
  const filter = rendered.getByRole('dialog', { name: /^filter$/i });
  expect(within(filter).getByLabelText('Alpha')).toBeTruthy();
  expect(within(filter).getByLabelText('Empty')).toBeTruthy();
  expect(within(filter).queryByLabelText('Name')).toBeNull();
  fireEvent.click(rendered.getByRole('button', { name: /apply filter/i }));
  expect(ref.current!.getValue()[0]!.autofilter?.ref).toBeDefined();

  fireEvent.click(rendered.getByRole('button', { name: /print/i }));
  const printDialog = rendered.getByRole('dialog', { name: /print/i });
  const printOptions = within(printDialog).getAllByRole('combobox');
  fireEvent.change(printOptions[0]!, { target: { value: 'A3' } });
  fireEvent.change(printOptions[1]!, { target: { value: 'landscape' } });
  fireEvent.click(printDialog.querySelector('button')!);
  expect(print).toHaveBeenCalledOnce();
  expect(printStyle).toContain('A3 landscape');
  expect(printPages).toBeGreaterThan(0);
  expect(document.querySelector('[data-tego-print-pages]')).toBeNull();

  fireEvent.click(rendered.getByRole('button', { name: /add sheet/i }));
  await waitFor(() => expect(rendered.getAllByRole('tab')).toHaveLength(2));
});

it('clears transient chrome when authority changes', async () => {
  const first = [{ name: 'A' }, { name: 'B' }];
  const rendered = render(<TegoSheet value={first} />);
  const paint = rendered.getByRole('button', { name: /paint format/i });

  fireEvent.click(paint);
  fireEvent.click(rendered.getByRole('button', { name: /data validation/i }));
  expect(rendered.getByRole('dialog', { name: /data validation/i })).toBeTruthy();
  expect(paint.getAttribute('aria-pressed')).toBe('true');

  rendered.rerender(<TegoSheet value={first} readOnly />);
  await waitFor(() => expect(rendered.queryByRole('dialog', { name: /data validation/i })).toBeNull());
  expect(paint.getAttribute('aria-pressed')).toBe('false');

  rendered.rerender(<TegoSheet value={first} />);
  fireEvent.click(rendered.getByRole('button', { name: /^filter$/i }));
  expect(rendered.getByRole('dialog', { name: /^filter$/i })).toBeTruthy();
  fireEvent.click(rendered.getAllByRole('tab')[1]!);
  await waitFor(() => expect(rendered.queryByRole('dialog', { name: /^filter$/i })).toBeNull());

  fireEvent.click(rendered.getByRole('button', { name: /print/i }));
  expect(rendered.getByRole('dialog', { name: /print/i })).toBeTruthy();
  rendered.rerender(<TegoSheet value={[{ name: 'Replacement' }]} />);
  await waitFor(() => expect(rendered.queryByRole('dialog', { name: /print/i })).toBeNull());
});

it('disables every mutating default control in read-only mode', async () => {
  const rendered = render(<TegoSheet defaultValue={[{}]} readOnly />);
  await waitFor(() => expect(rendered.getByRole('button', { name: /bold/i }).hasAttribute('disabled')).toBe(true));
  expect(rendered.getByRole('button', { name: /add sheet/i }).hasAttribute('disabled')).toBe(true);
  expect(rendered.getByRole('button', { name: /data validation/i }).hasAttribute('disabled')).toBe(true);
  expect(rendered.getByRole('button', { name: /^filter$/i }).hasAttribute('disabled')).toBe(true);
});

it('arms paint format and applies it to the next engine selection', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onChange = vi.fn();
  let sheet!: SheetId;
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{
        rows: { len: 1, 0: { cells: { 0: { text: 'source', style: 0 }, 1: { text: 'target' } } } },
        cols: { len: 2 },
        styles: [{ color: '#ff0000' }],
      }]}
      onChange={onChange}
      onSelectionChange={selection => { sheet = selection.sheet; }}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 300 },
  });
  fireEvent(window, new Event('resize'));
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });

  fireEvent.click(rendered.getByRole('button', { name: /paint format/i }));
  expect(rendered.getByRole('button', { name: /paint format/i }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 170, clientY: 40 });

  await waitFor(() => expect(ref.current!.getCellStyle({ sheet, row: 0, column: 1 }).color).toBe('#ff0000'));
  expect(onChange).toHaveBeenCalledOnce();
  expect(rendered.getByRole('button', { name: /paint format/i }).getAttribute('aria-pressed')).toBe('false');
});
