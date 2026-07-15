import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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

it('keeps viewing, selection, navigation and copy available while rejecting every ref mutation', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  let sheet!: SheetId;
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A', rows: { 0: { cells: { 0: { text: 'copy me' } } } } }]}
      readOnly
      onSelectionChange={event => {
        sheet = event.sheet;
        onSelectionChange(event);
      }}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange).toHaveBeenCalledOnce();
  expect(ref.current!.getValue()[0]?.name).toBe('A');
  expect(ref.current!.getCell({ sheet, row: 0, column: 0 })?.text).toBe('copy me');

  const clipboard = { setData: vi.fn(), getData: vi.fn(() => '') };
  fireEvent.copy(window, { clipboardData: clipboard });
  await waitFor(() => expect(clipboard.setData).toHaveBeenCalledWith('text/plain', expect.any(String)));

  const commands = [
    () => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'blocked'),
    () => ref.current!.addSheet('blocked'),
    () => ref.current!.deleteSheet(sheet),
    () => ref.current!.renameSheet(sheet, 'blocked'),
    () => ref.current!.undo(),
    () => ref.current!.redo(),
  ];
  for (const command of commands) {
    expect(command).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
  }
  expect(() => ref.current!.activateSheet(sheet)).not.toThrow();
  expect(() => ref.current!.validate()).not.toThrow();
  act(() => rendered.rerender(
    <TegoSheet ref={ref} defaultValue={[]} readOnly={false} onSelectionChange={onSelectionChange} />,
  ));
  expect(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'allowed')).not.toThrow();
});
