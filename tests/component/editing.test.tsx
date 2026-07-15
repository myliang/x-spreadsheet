import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet, type TegoSheetHandle, type WorkbookInput } from '../../src';
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

function sizeRoot(root: HTMLElement, width = 500, height = 300): void {
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
  fireEvent(window, new Event('resize'));
}

it('keeps typing local, commits once, creates one undo entry, and preserves callback order', async () => {
  const ref = createRef<TegoSheetHandle>();
  const order: string[] = [];
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ rows: { 0: { cells: { 0: { text: 'old' } } } } }]}
      onChange={() => order.push('change')}
      onCellEdit={() => order.push('cell-edit')}
      onSelectionChange={() => order.push('selection')}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'F2' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });

  fireEvent.change(editor, { target: { value: '=SUM(A1:A2)' } });
  const sheet = ref.current!.getValue()[0]!;
  expect(sheet.rows?.['0']).toMatchObject({ cells: { 0: { text: 'old' } } });
  expect(rendered.getByRole('listbox', { name: /formula suggestions/i })).toBeTruthy();

  fireEvent.keyDown(editor, { key: 'Enter' });
  await waitFor(() => expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull());
  expect(ref.current!.getValue()[0]!.rows?.['0']).toMatchObject({
    cells: { 0: { text: '=SUM(A1:A2)' } },
  });
  expect(order).toEqual(['change', 'cell-edit', 'selection']);

  order.length = 0;
  ref.current!.undo();
  expect(ref.current!.getValue()[0]!.rows?.['0']).toMatchObject({ cells: { 0: { text: 'old' } } });
  expect(order).toEqual(['change']);
  await waitFor(() => expect(
    rendered.getByRole('button', { name: 'Undo' }).hasAttribute('disabled'),
  ).toBe(true));
  const afterFirstUndo = ref.current!.getValue();
  const notifications = order.length;
  ref.current!.undo();
  expect(ref.current!.getValue()).toEqual(afterFirstUndo);
  expect(order).toHaveLength(notifications);
});

it('cancels on Escape and commits exactly once on blur', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onChange = vi.fn();
  const rendered = render(<TegoSheet ref={ref} defaultValue={[{}]} onChange={onChange} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  fireEvent.focusIn(root);

  fireEvent.keyDown(window, { key: 'x' });
  let editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'cancelled' } });
  fireEvent.keyDown(editor, { key: 'Escape' });
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.keyDown(window, { key: 'y' });
  editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'saved' } });
  fireEvent.blur(editor);
  fireEvent.blur(editor);
  expect(onChange).toHaveBeenCalledOnce();
});

it('commits once on Tab and pointer navigation with selection before paint', async () => {
  const ref = createRef<TegoSheetHandle>();
  const order: string[] = [];
  const selections: number[] = [];
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ rows: { len: 2 }, cols: { len: 3 } }]}
      onChange={() => order.push('change')}
      onCellEdit={() => order.push('cell-edit')}
      onSelectionChange={selection => {
        order.push('selection');
        selections.push(selection.active.column);
      }}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'a' });
  let editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'tabbed' } });
  fireEvent.keyDown(editor, { key: 'Tab' });
  expect(order).toEqual(['change', 'cell-edit', 'selection']);
  expect(selections).toEqual([1]);

  order.length = 0;
  selections.length = 0;
  fireEvent.keyDown(window, { key: 'b' });
  editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'pointed' } });
  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 260, clientY: 40 });
  await waitFor(() => expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull());

  expect(order).toEqual(['change', 'cell-edit', 'selection']);
  expect(selections).toEqual([2]);
  expect(ref.current!.getValue()[0]!.rows?.['0']).toMatchObject({
    cells: { 1: { text: 'pointed' } },
  });
});

it('preserves selection, scroll, and active editing across controlled acknowledgement', async () => {
  const ref = createRef<TegoSheetHandle>();
  const value: WorkbookInput = [{ name: 'Controlled', rows: { len: 5 }, cols: { len: 20 } }];
  let sheet: Parameters<TegoSheetHandle['setCellText']>[0]['sheet'] | undefined;
  let checkpoint: WorkbookInput | undefined;
  let selectedColumn = -1;
  const onChange = (next: WorkbookInput) => { checkpoint = next; };
  const onSelectionChange: NonNullable<Parameters<typeof TegoSheet>[0]['onSelectionChange']> = next => {
    sheet = next.sheet;
    selectedColumn = next.active.column;
  };
  const rendered = render(
    <TegoSheet ref={ref} value={value} onChange={onChange} onSelectionChange={onSelectionChange} />,
  );
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root, 300, 200);
  fireEvent.focusIn(root);
  for (let column = 0; column < 8; column += 1) fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(sheet).toBeDefined();
  expect(selectedColumn).toBe(8);
  ref.current!.setCellText({ sheet: sheet!, row: 0, column: 0 }, 'accepted');
  expect(checkpoint).toBeDefined();
  fireEvent.keyDown(window, { key: 'x' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'draft' } });
  const editorHost = editor.closest<HTMLElement>('.tego-sheet__editor')!;
  const preScrollLeft = editorHost.style.left;
  fireEvent.wheel(root, { deltaX: 200, deltaY: 0 });
  await waitFor(() => expect(editorHost.style.left).not.toBe(preScrollLeft));
  const scrolledLeft = editorHost.style.left;

  const acknowledgement = structuredClone(checkpoint!);
  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={acknowledgement}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  const currentEditor = rendered.getByRole('textbox', { name: /cell editor/i }) as HTMLTextAreaElement;
  const currentEditorHost = currentEditor.closest<HTMLElement>('.tego-sheet__editor')!;
  expect(currentEditor).toBe(editor);
  expect(currentEditor.value).toBe('draft');
  expect(currentEditorHost.style.left).toBe(scrolledLeft);
  expect(document.activeElement).toBe(currentEditor);
  expect(selectedColumn).toBe(8);

  fireEvent.keyDown(currentEditor, { key: 'Escape' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(selectedColumn).toBe(9);
  fireEvent.keyDown(window, { key: 'x' });
  expect(await rendered.findByRole('textbox', { name: /cell editor/i })).toBeTruthy();

  rendered.rerender(<TegoSheet ref={ref} value={[{ name: 'Replacement' }]} />);
  await waitFor(() => expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull());

  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'y' });
  expect(await rendered.findByRole('textbox', { name: /cell editor/i })).toBeTruthy();
  rendered.rerender(<TegoSheet ref={ref} value={[{ name: 'Replacement' }]} readOnly />);
  await waitFor(() => expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull());
});

it('keeps the editor anchored to engine geometry through scroll and resize', async () => {
  const rendered = render(<TegoSheet defaultValue={[{ rows: { len: 5 }, cols: { len: 10 } }]} />);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root, 300, 200);
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'F2' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  const host = editor.closest<HTMLElement>('.tego-sheet__editor')!;
  const initialLeft = host.style.left;

  fireEvent.wheel(root, { deltaX: 100, deltaY: 0 });
  await waitFor(() => expect(host.style.left).not.toBe(initialLeft));
  const scrolledLeft = host.style.left;

  sizeRoot(root, 2_000, 1_000);
  await waitFor(() => expect(host.style.left).not.toBe(scrolledLeft));
  expect(rendered.getByRole('textbox', { name: /cell editor/i })).toBe(editor);
});

it('does not apply a stale Tab selection when onChange synchronously replaces controlled data', async () => {
  const selections = vi.fn();
  function Host() {
    const [value, setValue] = useState<WorkbookInput>([{ name: 'Before' }]);
    return (
      <TegoSheet
        value={value}
        onChange={() => flushSync(() => setValue([{ name: 'Replacement' }]))}
        onSelectionChange={selections}
      />
    );
  }
  const rendered = render(<Host />);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  selections.mockClear();
  fireEvent.keyDown(window, { key: 'x' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'draft' } });

  fireEvent.keyDown(editor, { key: 'Tab' });

  await waitFor(() => expect(rendered.getByRole('tab', { name: 'Replacement' })).toBeTruthy());
  expect(selections).not.toHaveBeenCalled();
  expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull();
});

it('does not finish stale Enter selection work after onChange unmounts the sheet', async () => {
  const selections = vi.fn();
  const rendered = render(
    <TegoSheet
      defaultValue={[{}]}
      onChange={() => rendered.unmount()}
      onSelectionChange={selections}
    />,
  );
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  selections.mockClear();
  fireEvent.keyDown(window, { key: 'x' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'draft' } });

  expect(() => fireEvent.keyDown(editor, { key: 'Enter' })).not.toThrow();
  expect(selections).not.toHaveBeenCalled();
  expect(rendered.container.childElementCount).toBe(0);
});

it.each(['onChange', 'onCellEdit'] as const)(
  'closes the editor and preserves the original %s exception after commit',
  async callback => {
    const ref = createRef<TegoSheetHandle>();
    const consumerError = new Error(`${callback} failed`);
    const callbacks = callback === 'onChange'
      ? { onChange: () => { throw consumerError; } }
      : { onCellEdit: () => { throw consumerError; } };
    const rendered = render(<TegoSheet ref={ref} defaultValue={[{}]} {...callbacks} />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
    sizeRoot(root);
    root.focus();
    fireEvent.keyDown(root, { key: 'x' });
    const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
    fireEvent.change(editor, { target: { value: 'committed before callback failure' } });
    const reported: unknown[] = [];
    const capture = (event: ErrorEvent) => {
      reported.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', capture);

    try {
      fireEvent.keyDown(editor, { key: 'Enter' });
    } finally {
      window.removeEventListener('error', capture);
    }

    expect(reported).toEqual([consumerError]);
    expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull();
    expect(ref.current!.getValue()[0]!.rows?.['0']).toMatchObject({
      cells: { 0: { text: 'committed before callback failure' } },
    });
    expect(() => rendered.unmount()).not.toThrow();
  },
);

it('clears with Delete without reporting a paste event', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onPaste = vi.fn();
  const changes: string[] = [];
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ rows: { 0: { cells: { 0: { text: 'erase me' } } } } }]}
      onChange={(_value, change) => changes.push(change.kind)}
      onPaste={onPaste}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'Delete' });

  expect(ref.current!.getValue()[0]!.rows?.['0']).toMatchObject({ cells: { 0: {} } });
  expect(ref.current!.getValue()[0]!.rows?.['0']).not.toHaveProperty('cells.0.text');
  expect(changes).toEqual(['cell']);
  expect(onPaste).not.toHaveBeenCalled();
});

it('does not notify or repaint React selection for an identical engine selection', () => {
  const onSelectionChange = vi.fn();
  const rendered = render(<TegoSheet defaultValue={[{}]} onSelectionChange={onSelectionChange} />);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  fireEvent.focusIn(root);

  fireEvent.keyDown(window, { key: 'ArrowLeft' });
  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 70, clientY: 40 });

  expect(onSelectionChange).not.toHaveBeenCalled();
});
