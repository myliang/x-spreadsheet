import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, useLayoutEffect, useRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  TegoSheet,
  type SheetId,
  type TegoSheetError,
  type TegoSheetHandle,
  type ToolbarRenderProps,
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

it('commits the false-to-true read-only gate before custom child layout commands', async () => {
  const ref = createRef<TegoSheetHandle>();
  const changes = vi.fn();
  const errors: TegoSheetError[] = [];
  const refErrors: unknown[] = [];
  let toolbar!: ToolbarRenderProps;

  function Probe(props: ToolbarRenderProps) {
    const ran = useRef(false);
    useLayoutEffect(() => {
      if (!props.readOnly || ran.current) return;
      ran.current = true;
      const selection = props.selection!;
      try {
        ref.current!.setCellText({ sheet: selection.sheet, row: 0, column: 0 }, 'ref leak');
      } catch (error) {
        refErrors.push(error);
      }
      fireEvent.keyDown(window, { key: 'k' });
      props.execute({ type: 'set-style', patch: { color: 'slot leak' } });
    }, [props]);
    return null;
  }

  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A' }]}
      toolbar={props => {
        toolbar = props;
        return <Probe {...props} />;
      }}
      onChange={changes}
      onError={error => errors.push(error)}
    />,
  );
  await waitFor(() => expect(toolbar.selection).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  const sheet = toolbar.selection!.sheet;

  rendered.rerender(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      readOnly
      toolbar={props => {
        toolbar = props;
        return <Probe {...props} />;
      }}
      onChange={changes}
      onError={error => errors.push(error)}
    />,
  );

  expect(refErrors).toHaveLength(1);
  expect(refErrors[0]).toMatchObject({ code: 'INVALID_COMMAND' });
  expect(changes).not.toHaveBeenCalled();
  expect(errors).toEqual([expect.objectContaining({ code: 'INVALID_COMMAND' })]);
  expect(ref.current!.getCell({ sheet, row: 0, column: 0 })).toBeNull();
  expect(ref.current!.getCellStyle({ sheet, row: 0, column: 0 }).color).toBeUndefined();
});

it('commits the true-to-false read-only gate before custom child layout commands', async () => {
  const ref = createRef<TegoSheetHandle>();
  const refErrors: unknown[] = [];
  const changes = vi.fn();
  let toolbar!: ToolbarRenderProps;

  function Probe(props: ToolbarRenderProps) {
    const ran = useRef(false);
    useLayoutEffect(() => {
      if (props.readOnly || ran.current) return;
      ran.current = true;
      const selection = props.selection!;
      try {
        ref.current!.setCellText({ sheet: selection.sheet, row: 0, column: 0 }, 'allowed');
      } catch (error) {
        refErrors.push(error);
      }
      props.execute({ type: 'set-style', patch: { color: 'green' } });
    }, [props]);
    return null;
  }

  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A' }]}
      readOnly
      toolbar={props => {
        toolbar = props;
        return <Probe {...props} />;
      }}
      onChange={changes}
    />,
  );
  await waitFor(() => expect(toolbar.selection).not.toBeNull());
  const sheet = toolbar.selection!.sheet;

  rendered.rerender(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      readOnly={false}
      toolbar={props => {
        toolbar = props;
        return <Probe {...props} />;
      }}
      onChange={changes}
    />,
  );

  expect(refErrors).toEqual([]);
  expect(ref.current!.getCell({ sheet, row: 0, column: 0 })?.text).toBe('allowed');
  expect(ref.current!.getCellStyle({ sheet, row: 0, column: 0 })).toMatchObject({ color: 'green' });
  expect(changes).toHaveBeenCalledTimes(2);
});
