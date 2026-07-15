import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet, type SheetOptions, type TegoSheetHandle, type ToolbarRenderProps } from '../../src';
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

it('applies mount geometry, default style and autofocus', async () => {
  const selections: number[] = [];
  const toolbar = vi.fn(({ activeStyle }) => <output>{activeStyle.color}</output>);
  const rendered = render(
    <TegoSheet
      defaultValue={[{ name: 'A' }]}
      options={{
        rows: { initialCount: 2, defaultHeight: 30 },
        columns: { initialCount: 2, defaultWidth: 50, minimumWidth: 120 },
        rowHeaderWidth: 20,
        defaultStyle: { color: '#abcdef' },
        autoFocus: true,
      }}
      toolbar={toolbar}
      onSelectionChange={selection => selections.push(selection.active.column)}
    />,
  );
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 300 },
  });
  await waitFor(() => expect(document.activeElement).toBe(root));
  expect(rendered.getByText('#abcdef')).toBeTruthy();
  fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
  expect(selections.at(-1)).toBe(1);
  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 170, clientY: 40 });
  expect(selections.at(-1)).toBe(1);
});

it('reconciles live flags but warns once per changed mount-only option without rewriting data', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const first: SheetOptions = {
    showGrid: true,
    showContextMenu: true,
    rows: { initialCount: 2 },
    defaultStyle: { color: 'red' },
  };
  const rendered = render(<TegoSheet defaultValue={[{ name: 'A' }]} options={first} />);
  await waitFor(() => expect(rendered.container.querySelector('canvas')).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;

  rendered.rerender(
    <TegoSheet
      defaultValue={[{ name: 'ignored' }]}
      options={{
        showGrid: false,
        showContextMenu: false,
        rows: { initialCount: 4 },
        defaultStyle: { color: 'blue' },
      }}
    />,
  );
  await waitFor(() => expect(root.getAttribute('data-grid-visible')).toBe('false'));
  expect(root.getAttribute('data-context-menu-enabled')).toBe('false');
  expect(warn.mock.calls.flat().join('\n')).toContain('options.rows.initialCount');
  expect(warn.mock.calls.flat().join('\n')).toContain('options.defaultStyle');
  const calls = warn.mock.calls.length;
  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      options={{ showGrid: false, showContextMenu: false, rows: { initialCount: 5 }, defaultStyle: {} }}
    />,
  );
  expect(warn).toHaveBeenCalledTimes(calls);
});

it('applies initial counts before canonical defaults for mount, replacement and added sheets', async () => {
  const ref = createRef<TegoSheetHandle>();
  const options = { rows: { initialCount: 0 }, columns: { initialCount: 0 } };
  const rendered = render(<TegoSheet ref={ref} value={[{ name: 'A' }]} options={options} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  expect(ref.current!.getValue()[0]).toMatchObject({ rows: { len: 0 }, cols: { len: 0 } });

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={[{ name: 'explicit', rows: { len: 3 }, cols: { len: 4 } }]}
      options={options}
    />,
  );
  await waitFor(() => expect(ref.current!.getValue()[0]?.name).toBe('explicit'));
  expect(ref.current!.getValue()[0]).toMatchObject({ rows: { len: 3 }, cols: { len: 4 } });

  let added!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    added = ref.current!.addSheet('added');
  });
  expect(ref.current!.getValue().at(-1)).toMatchObject({ rows: { len: 0 }, cols: { len: 0 } });
  expect(() => ref.current!.getCell({ sheet: added, row: 0, column: 0 })).not.toThrow();
});

it('updates live visibility without rebuilding the engine or losing selection', async () => {
  let toolbar!: ToolbarRenderProps;
  const renderer = (value: ToolbarRenderProps) => {
    toolbar = value;
    return null;
  };
  const rendered = render(
    <TegoSheet
      defaultValue={[{ name: 'A', rows: { len: 2 }, cols: { len: 3 } }]}
      options={{ showGrid: true, showContextMenu: true }}
      toolbar={renderer}
    />,
  );
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  await waitFor(() => expect(toolbar.selection).not.toBeNull());
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(toolbar.selection?.active.column).toBe(1);

  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      options={{ showGrid: false, showContextMenu: false }}
      toolbar={renderer}
    />,
  );
  expect(toolbar.selection?.active.column).toBe(1);
  expect(root.getAttribute('data-grid-visible')).toBe('false');
  expect(root.getAttribute('data-context-menu-enabled')).toBe('false');
});

it('rejects invalid mount dimensions even for an empty workbook', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const invalid: readonly SheetOptions[] = [
    { rows: { initialCount: -1 } },
    { rows: { defaultHeight: Number.NaN } },
    { columns: { initialCount: 1.5 } },
    { columns: { defaultWidth: -1 } },
    { columns: { minimumWidth: -1 } },
    { rowHeaderWidth: Number.NaN },
  ];
  for (const options of invalid) {
    expect(() => render(<TegoSheet defaultValue={[]} options={options} />)).toThrowError(
      expect.objectContaining({ code: 'INVALID_COMMAND', recoverable: false }),
    );
  }
});

it('uses minimumWidth only as the interaction resize floor', async () => {
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A', rows: { len: 2 }, cols: { len: 2 } }]}
      options={{
        rowHeaderWidth: 20,
        columns: { defaultWidth: 50, minimumWidth: 120 },
      }}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  Object.defineProperties(root, {
    clientWidth: { configurable: true, value: 500 },
    clientHeight: { configurable: true, value: 300 },
  });
  act(() => ref.current!.recalculateLayout());

  fireEvent.pointerDown(root, { button: 0, buttons: 1, clientX: 70, clientY: 10 });
  fireEvent.pointerMove(window, { buttons: 1, clientX: 75, clientY: 10 });
  fireEvent.pointerUp(window, { button: 0, buttons: 0, clientX: 75, clientY: 10 });

  expect(ref.current!.getValue()[0]?.cols?.[0]).toMatchObject({ width: 120 });
  expect(ref.current!.getValue()[0]?.cols?.[1]).toBeUndefined();
});
