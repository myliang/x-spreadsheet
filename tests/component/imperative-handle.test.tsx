import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet, type TegoSheetHandle } from '../../src';
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

it('exposes every approved command and isolated query through one stable handle', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onActiveSheetChange = vi.fn();
  const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A', rows: { len: 2 }, cols: { len: 2 } }]}
      options={{ defaultStyle: { color: '#123456' } }}
      onActiveSheetChange={onActiveSheetChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const handle = ref.current!;
  const firstId = onActiveSheetChange.mock.lastCall?.[0].sheet
    ?? handle.addSheet('temporary');
  if (handle.getValue().length > 1) handle.deleteSheet(firstId);
  const sheet = handle.addSheet('B');

  act(() => {
    handle.setCellText({ sheet, row: 0, column: 0 }, 'value');
    handle.renameSheet(sheet, 'Renamed');
    handle.activateSheet(sheet);
  });
  expect(handle.getCell({ sheet, row: 0, column: 0 })?.text).toBe('value');
  expect(handle.getCellStyle({ sheet, row: 0, column: 0 })).toMatchObject({ color: '#123456' });
  const value = handle.getValue() as Array<{ name?: string }>;
  value[0]!.name = 'caller mutation';
  expect(handle.getValue()[0]?.name).not.toBe('caller mutation');
  expect(handle.validate()).toEqual({ valid: true, issues: [] });

  act(() => handle.undo());
  expect(handle.getValue().at(-1)?.name).toBe('B');
  act(() => handle.redo());
  expect(handle.getValue().at(-1)?.name).toBe('Renamed');
  handle.focus();
  expect(document.activeElement).toBe(rendered.container.querySelector('[data-tego-sheet]'));
  expect(() => handle.recalculateLayout()).not.toThrow();
  handle.print();
  expect(print).toHaveBeenCalledOnce();

  rendered.rerender(
    <TegoSheet ref={ref} defaultValue={[]} options={{ defaultStyle: { color: 'red' } }} />,
  );
  expect(ref.current).toBe(handle);
});

it('invalidates stale sheet IDs and clips active index silently on external replacement', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onChange = vi.fn();
  const onActiveSheetChange = vi.fn();
  const onSelectionChange = vi.fn();
  const first = [{ name: 'A' }, { name: 'B' }];
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={first}
      initialActiveSheetIndex={1}
      onChange={onChange}
      onActiveSheetChange={onActiveSheetChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const stale = ref.current!.addSheet('optimistic');
  onChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={[{ name: 'Replacement' }]}
      initialActiveSheetIndex={99}
      onChange={onChange}
      onActiveSheetChange={onActiveSheetChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current!.getValue()[0]?.name).toBe('Replacement'));
  expect(() => ref.current!.getCell({ sheet: stale, row: 0, column: 0 })).toThrowError(
    expect.objectContaining({ code: 'INVALID_COMMAND' }),
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(onActiveSheetChange).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
});
