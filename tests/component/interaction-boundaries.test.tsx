import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  TegoSheet,
  type Selection,
  type TegoSheetHandle,
  type WorkbookChange,
} from '../../src';
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

function sizeRoot(root: HTMLElement): void {
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 300 },
  });
  fireEvent(window, new Event('resize'));
}

function renderBoundarySheet() {
  const ref = createRef<TegoSheetHandle>();
  const changes: WorkbookChange[] = [];
  const selections: Selection[] = [];
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{
        rows: {
          len: 2,
          0: { cells: { 0: { text: 'old' }, 1: { text: 'other' } } },
          1: { cells: { 1: { text: 'bottom' } } },
        },
        cols: { len: 2 },
      }]}
      onChange={(_value, change) => changes.push(change)}
      onSelectionChange={selection => selections.push(selection)}
    />,
  );
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  sizeRoot(root);
  return { changes, ref, rendered, root, selections };
}

it('does not let toolbar pointer/focus events pre-commit the editor or navigate the grid', async () => {
  const { changes, ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'x' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  fireEvent.change(editor, { target: { value: 'draft' } });
  const bold = rendered.getByRole('button', { name: /^bold$/i });
  selections.length = 0;

  fireEvent.pointerDown(bold, { button: 0, buttons: 1, clientX: 170, clientY: 40 });

  expect(rendered.getByRole('textbox', { name: /cell editor/i })).toBe(editor);
  expect(changes).toEqual([]);
  expect(selections).toEqual([]);

  fireEvent.blur(editor, { relatedTarget: bold });
  fireEvent.focusIn(bold);
  fireEvent.keyDown(bold, { key: 'ArrowRight' });
  fireEvent.click(bold);

  expect(selections).toEqual([]);
  expect(changes.map(change => change.kind)).toEqual(['cell', 'style']);
  expect(ref.current!.getValue()[0]).toMatchObject({
    rows: { 0: { cells: { 0: { text: 'draft' } } } },
    styles: [{ font: { bold: true } }],
  });
});

it('keeps editor pointer and Enter handling inside the editor transaction', async () => {
  const { changes, ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'x' });
  const editor = await rendered.findByRole('textbox', { name: /cell editor/i });
  selections.length = 0;

  fireEvent.pointerDown(editor, { button: 0, buttons: 1, clientX: 170, clientY: 40 });
  fireEvent.focusIn(editor);
  fireEvent.change(editor, { target: { value: 'entered' } });

  expect(rendered.getByRole('textbox', { name: /cell editor/i })).toBe(editor);
  expect(changes).toEqual([]);
  expect(selections).toEqual([]);

  fireEvent.keyDown(editor, { key: 'Enter' });

  await waitFor(() => expect(rendered.queryByRole('textbox', { name: /cell editor/i })).toBeNull());
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ kind: 'cell' });
  expect(selections).toHaveLength(1);
  expect(selections[0]!.active).toEqual({ row: 1, column: 0 });
  expect(ref.current!.getValue()[0]).toMatchObject({
    rows: { 0: { cells: { 0: { text: 'entered' } } } },
  });
});

it('keeps context-menu pointer and keyboard events out of grid selection', async () => {
  const { changes, ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 70, clientY: 40 });
  fireEvent.contextMenu(root, { clientX: 70, clientY: 40 });
  const menu = rendered.getByRole('menu', { name: /cell actions/i });
  const disableExport = within(menu).getByRole('menuitem', { name: /disable export/i });
  selections.length = 0;

  fireEvent.pointerDown(disableExport, { button: 0, buttons: 1, clientX: 170, clientY: 40 });
  fireEvent.focusIn(disableExport);
  fireEvent.keyDown(disableExport, { key: 'ArrowRight' });

  expect(selections).toEqual([]);
  fireEvent.click(disableExport);
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ kind: 'cell', source: 'context-menu' });
  expect(ref.current!.getValue()[0]).toMatchObject({
    rows: { 0: { cells: {
      0: { text: 'old', printable: false },
      1: { text: 'other' },
    } } },
  });
});

it('keeps root and canvas targets on the explicit grid interaction surface', async () => {
  const { ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  const canvas = rendered.container.querySelector<HTMLCanvasElement>('canvas')!;

  fireEvent.focusIn(canvas);
  fireEvent.keyDown(canvas, { key: 'ArrowRight' });
  expect(selections.at(-1)?.active).toEqual({ row: 0, column: 1 });

  fireEvent.focusIn(root);
  fireEvent.keyDown(root, { key: 'ArrowLeft' });
  expect(selections.at(-1)?.active).toEqual({ row: 0, column: 0 });
});

it('restores DOM and keyboard ownership when the canvas is pressed after toolbar focus', async () => {
  const { ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  const canvas = rendered.container.querySelector<HTMLCanvasElement>('canvas')!;
  const bold = rendered.getByRole('button', { name: /^bold$/i });
  const focusRoot = vi.spyOn(root, 'focus');
  bold.focus();
  expect(document.activeElement).toBe(bold);
  selections.length = 0;

  fireEvent.pointerDown(canvas, { button: 0, buttons: 1, clientX: 70, clientY: 40 });

  expect(focusRoot).toHaveBeenCalledOnce();
  expect(focusRoot).toHaveBeenCalledWith({ preventScroll: true });
  expect(document.activeElement).toBe(root);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(selections).toHaveLength(1);
  expect(selections[0]!.active).toEqual({ row: 0, column: 1 });
});

it('closes a focused context menu and restores grid keys when the canvas is pressed', async () => {
  const { ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  const canvas = rendered.container.querySelector<HTMLCanvasElement>('canvas')!;
  const focusRoot = vi.spyOn(root, 'focus');
  fireEvent.contextMenu(root, { clientX: 70, clientY: 40 });
  const menu = rendered.getByRole('menu', { name: /cell actions/i });
  expect(document.activeElement).toBe(menu);
  selections.length = 0;

  fireEvent.pointerDown(canvas, { button: 0, buttons: 1, clientX: 70, clientY: 40 });

  expect(focusRoot).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(root);
  expect(rendered.queryByRole('menu', { name: /cell actions/i })).toBeNull();
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(selections).toHaveLength(1);
  expect(selections[0]!.active).toEqual({ row: 0, column: 1 });
});

it.each(['Escape', 'action'] as const)(
  'restores grid focus after context-menu %s close',
  async close => {
    const { ref, rendered, root, selections } = renderBoundarySheet();
    await waitFor(() => expect(ref.current).not.toBeNull());
    fireEvent.contextMenu(root, { clientX: 70, clientY: 40 });
    const menu = rendered.getByRole('menu', { name: /cell actions/i });
    expect(document.activeElement).toBe(menu);

    if (close === 'Escape') fireEvent.keyDown(menu, { key: 'Escape' });
    else fireEvent.click(within(menu).getByRole('menuitem', { name: /disable export/i }));

    expect(rendered.queryByRole('menu', { name: /cell actions/i })).toBeNull();
    expect(document.activeElement).toBe(root);
    selections.length = 0;
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(selections).toHaveLength(1);
    expect(selections[0]!.active).toEqual({ row: 0, column: 1 });
  },
);

it('restores grid focus after a canvas tap', async () => {
  const { ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  const canvas = rendered.container.querySelector<HTMLCanvasElement>('canvas')!;
  const bold = rendered.getByRole('button', { name: /^bold$/i });
  bold.focus();
  selections.length = 0;
  const touch = { clientX: 70, clientY: 40 };

  fireEvent.touchStart(canvas, { touches: [touch] });
  fireEvent.touchEnd(canvas, { changedTouches: [touch], touches: [] });

  expect(document.activeElement).toBe(root);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(selections).toHaveLength(1);
  expect(selections[0]!.active).toEqual({ row: 0, column: 1 });
});

it('restores grid focus without implicitly closing an explicit modal dialog', async () => {
  const { ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  const canvas = rendered.container.querySelector<HTMLCanvasElement>('canvas')!;
  fireEvent.click(rendered.getByRole('button', { name: /data validation/i }));
  const dialog = rendered.getByRole('dialog', { name: /data validation/i });
  const type = dialog.querySelector<HTMLSelectElement>('select[name="type"]')!;
  type.focus();
  expect(document.activeElement).toBe(type);
  selections.length = 0;

  fireEvent.pointerDown(canvas, { button: 0, buttons: 1, clientX: 70, clientY: 40 });

  expect(document.activeElement).toBe(root);
  expect(rendered.getByRole('dialog', { name: /data validation/i })).toBe(dialog);
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(selections).toHaveLength(1);
  expect(selections[0]!.active).toEqual({ row: 0, column: 1 });
});

it('restores grid focus after explicitly closing a dialog', async () => {
  const { ref, rendered, root, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  fireEvent.click(rendered.getByRole('button', { name: /data validation/i }));
  const dialog = rendered.getByRole('dialog', { name: /data validation/i });
  const type = dialog.querySelector<HTMLSelectElement>('select[name="type"]')!;
  type.focus();
  expect(document.activeElement).toBe(type);

  fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

  expect(rendered.queryByRole('dialog', { name: /data validation/i })).toBeNull();
  expect(document.activeElement).toBe(root);
  selections.length = 0;
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
  expect(selections).toHaveLength(1);
  expect(selections[0]!.active).toEqual({ row: 0, column: 1 });
});

it('keeps dialog controls out of grid selection and applies their action once', async () => {
  const { changes, ref, rendered, selections } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());
  fireEvent.click(rendered.getByRole('button', { name: /data validation/i }));
  const dialog = rendered.getByRole('dialog', { name: /data validation/i });
  const type = dialog.querySelector<HTMLSelectElement>('select[name="type"]')!;
  selections.length = 0;

  fireEvent.pointerDown(type, { button: 0, buttons: 1, clientX: 170, clientY: 40 });
  fireEvent.focusIn(type);
  fireEvent.change(type, { target: { value: 'number' } });
  expect(selections).toEqual([]);

  const save = within(dialog).getByRole('button', { name: /^save$/i });
  fireEvent.pointerDown(save, { button: 0, buttons: 1, clientX: 170, clientY: 40 });
  fireEvent.focusIn(save);
  fireEvent.click(save);

  expect(selections).toEqual([]);
  expect(changes).toHaveLength(1);
  expect(changes[0]).toMatchObject({ kind: 'validation', source: 'toolbar' });
  expect(ref.current!.getValue()[0]!.validations).toEqual([
    expect.objectContaining({ refs: ['A1'], type: 'number' }),
  ]);
});

it('isolates source and opening selection across interleaved filter and validation dialogs', async () => {
  const { changes, ref, rendered, root } = renderBoundarySheet();
  await waitFor(() => expect(ref.current).not.toBeNull());

  fireEvent.contextMenu(root, { clientX: 70, clientY: 40 });
  fireEvent.click(within(rendered.getByRole('menu', { name: /cell actions/i }))
    .getByRole('menuitem', { name: /data validation/i }));
  const validation = rendered.getByRole('dialog', { name: /data validation/i });
  fireEvent.change(validation.querySelector('select[name="type"]')!, {
    target: { value: 'number' },
  });

  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 170, clientY: 40 });
  fireEvent.pointerMove(window, { buttons: 1, clientX: 170, clientY: 70 });
  fireEvent.pointerUp(window);
  fireEvent.click(rendered.getByRole('button', { name: /^filter$/i }));
  const filter = rendered.getByRole('dialog', { name: /^filter$/i });
  expect(within(filter).getByLabelText('bottom')).toBeTruthy();

  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 70, clientY: 70 });
  fireEvent.pointerUp(window);
  fireEvent.click(within(validation).getByRole('button', { name: /^save$/i }));
  fireEvent.click(within(filter).getByRole('button', { name: /apply filter/i }));

  expect(changes).toHaveLength(2);
  expect(changes[0]).toMatchObject({ kind: 'validation', source: 'context-menu' });
  expect(changes[1]).toMatchObject({ kind: 'filter', source: 'toolbar' });
  expect(ref.current!.getValue()[0]).toMatchObject({
    validations: [expect.objectContaining({ refs: ['A1'], type: 'number' })],
    autofilter: expect.objectContaining({
      ref: 'B1:B2',
      filters: [expect.objectContaining({ ci: 1 })],
    }),
  });
});
