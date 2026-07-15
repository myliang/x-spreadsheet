import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet } from '../../src';
import type {
  Selection,
  TegoSheetHandle,
  WorkbookChange,
  WorkbookData,
  WorkbookInput,
} from '../../src';
import { TegoSheetException } from '../../src/core';
import { WorkbookController } from '../../src/core/controller/workbook-controller';
import { WorkbookState } from '../../src/core/model/workbook-state';
import { createEngineAdapter } from '../../src/react/adapters/engine-adapter';
import { createCanvasHarness } from '../helpers/canvas-harness';

let nextFrame = 1;
let frames = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  const context = createCanvasHarness().canvas.getContext('2d');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function activeSelection(
  container: HTMLElement,
  onSelectionChange: ReturnType<typeof vi.fn<(selection: Selection) => void>>,
  key = 'ArrowRight',
): Selection {
  const root = container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key });
  return onSelectionChange.mock.lastCall![0];
}

it('@parity:history.command-controls acknowledges the newest checkpoint without replacing IDs, history, or callbacks', async () => {
  const value: WorkbookInput = [{ name: 'A' }];
  const onChange = vi.fn<(value: WorkbookData, change: WorkbookChange) => void>();
  const onCellEdit = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'pending'));
  const projected = structuredClone(onChange.mock.lastCall![0]);
  onChange.mockClear();
  onCellEdit.mockClear();
  onSelectionChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={projected}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(() => ref.current!.getCell({ sheet, row: 0, column: 0 })).not.toThrow();

  act(() => ref.current!.setCellText({ sheet, row: 0, column: 1 }, 'later pending'));
  onChange.mockClear();
  onCellEdit.mockClear();
  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={structuredClone(projected)}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(ref.current!.getCell({ sheet, row: 0, column: 1 })?.text ?? '').toBe('');
  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();

  act(() => ref.current!.undo());
  expect(ref.current!.getCell({ sheet, row: 0, column: 0 })?.text ?? '').toBe('');
  expect(onChange).toHaveBeenCalledOnce();
  expect(onChange.mock.lastCall![1]).toMatchObject({ kind: 'history' });
});

it('acknowledges an intermediate checkpoint and silently replays the pending tail', async () => {
  const value: WorkbookInput = [{ name: 'A' }];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const onCellEdit = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  const base = structuredClone(ref.current!.getValue());
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'first'));
  const first = structuredClone(onChange.mock.lastCall![0]);
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 1 }, 'second'));
  const latest = structuredClone(onChange.mock.lastCall![0]);
  onChange.mockClear();
  onCellEdit.mockClear();
  onSelectionChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={first}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current!.getValue()).toEqual(latest);
  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={structuredClone(first)}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(ref.current!.getValue()).toEqual(first);
  expect(onChange).not.toHaveBeenCalled();

  act(() => ref.current!.undo());
  expect(ref.current!.getValue()).toEqual(base);
});

it('treats a new reference equal to the acknowledged base as an explicit rollback', async () => {
  const value: WorkbookInput = [{ name: 'A' }];
  const onChange = vi.fn();
  const onCellEdit = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'rejected'));
  onChange.mockClear();
  onCellEdit.mockClear();
  onSelectionChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={structuredClone(value)}
      onChange={onChange}
      onCellEdit={onCellEdit}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current!.getValue()[0]?.rows?.[0]).toBeUndefined();
  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
  act(() => ref.current!.undo());
  expect(onChange).not.toHaveBeenCalled();
});

it('replaces genuine external values with new IDs, cleared history, and clipped viewport state', async () => {
  const value: WorkbookInput = [
    { name: 'A', rows: { len: 4 }, cols: { len: 4 } },
  ];
  const onChange = vi.fn();
  const onCellEdit = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const onActiveSheetChange = vi.fn();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      initialActiveSheetIndex={0}
      onActiveSheetChange={onActiveSheetChange}
      onCellEdit={onCellEdit}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  let oldSheet!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    oldSheet = ref.current!.addSheet('B');
    ref.current!.activateSheet(oldSheet);
  });
  activeSelection(rendered.container, onSelectionChange);
  activeSelection(rendered.container, onSelectionChange, 'ArrowDown');
  act(() => ref.current!.setCellText({ sheet: oldSheet, row: 0, column: 0 }, 'pending'));
  onChange.mockClear();
  onCellEdit.mockClear();
  onSelectionChange.mockClear();
  onActiveSheetChange.mockClear();
  const replacement: WorkbookInput = [
    { name: 'R', rows: { len: 2 }, cols: { len: 3 } },
    { name: 'S', rows: { len: 2 }, cols: { len: 3 } },
  ];

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={replacement}
      initialActiveSheetIndex={0}
      onActiveSheetChange={onActiveSheetChange}
      onCellEdit={onCellEdit}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current!.getValue().map(sheet => sheet.name)).toEqual(['R', 'S']);
  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(onActiveSheetChange).not.toHaveBeenCalled();
  expect(() => ref.current!.getCell({ sheet: oldSheet, row: 0, column: 0 })).toThrow(
    /unknown sheet/i,
  );
  act(() => ref.current!.undo());
  expect(onChange).not.toHaveBeenCalled();

  const clipped = activeSelection(rendered.container, onSelectionChange);
  expect(clipped.sheet).not.toBe(oldSheet);
  expect(clipped.active).toEqual({ row: 1, column: 2 });
  act(() => ref.current!.setCellText({
    sheet: clipped.sheet,
    row: 0,
    column: 0,
  }, 'active second sheet'));
  expect(ref.current!.getValue()[1]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'active second sheet' } },
  });
});

it('persists a clipped active index across shrink-expand and empty-expand replacements', async () => {
  const sixSheets = Array.from({ length: 6 }, (_, index) => ({ name: `S${index}` }));
  const twoSheets: WorkbookInput = [{ name: 'R0' }, { name: 'R1' }];
  const expanded = Array.from({ length: 6 }, (_, index) => ({ name: `E${index}` }));
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={sixSheets}
      initialActiveSheetIndex={5}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={twoSheets}
      initialActiveSheetIndex={5}
      onSelectionChange={onSelectionChange}
    />,
  );
  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={expanded}
      initialActiveSheetIndex={5}
      onSelectionChange={onSelectionChange}
    />,
  );
  const retained = activeSelection(rendered.container, onSelectionChange);
  act(() => ref.current!.setCellText({
    sheet: retained.sheet,
    row: 0,
    column: 0,
  }, 'retained clipped index'));
  expect(ref.current!.getValue()[1]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'retained clipped index' } },
  });
  expect(ref.current!.getValue()[5]?.rows?.[0]).toBeUndefined();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={[]}
      initialActiveSheetIndex={5}
      onSelectionChange={onSelectionChange}
    />,
  );
  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={structuredClone(expanded)}
      initialActiveSheetIndex={5}
      onSelectionChange={onSelectionChange}
    />,
  );
  const reset = activeSelection(rendered.container, onSelectionChange);
  act(() => ref.current!.setCellText({
    sheet: reset.sheet,
    row: 0,
    column: 0,
  }, 'empty clips to zero'));
  expect(ref.current!.getValue()[0]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'empty clips to zero' } },
  });
});

it('persists the clipped active index after rollback removes an optimistic sheet', async () => {
  const base: WorkbookInput = [{ name: 'A' }];
  const expanded: WorkbookInput = [{ name: 'E0' }, { name: 'E1' }];
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet ref={ref} value={base} onSelectionChange={onSelectionChange} />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  act(() => {
    const optimistic = ref.current!.addSheet('Optimistic');
    ref.current!.activateSheet(optimistic);
  });

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={structuredClone(base)}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(ref.current!.getValue()).toHaveLength(1);

  rendered.rerender(
    <TegoSheet ref={ref} value={expanded} onSelectionChange={onSelectionChange} />,
  );
  const retained = activeSelection(rendered.container, onSelectionChange);
  act(() => ref.current!.setCellText({
    sheet: retained.sheet,
    row: 0,
    column: 0,
  }, 'rollback stayed clipped'));
  expect(ref.current!.getValue()[0]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'rollback stayed clipped' } },
  });
  expect(ref.current!.getValue()[1]?.rows?.[0]).toBeUndefined();
});

it('persists the clipped active index after replay truncation removes an optimistic sheet', async () => {
  const value: WorkbookInput = [];
  const expanded: WorkbookInput = [{ name: 'E0' }, { name: 'E1' }];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const onError = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  act(() => {
    ref.current!.addSheet('Acknowledged');
  });
  const acknowledged = structuredClone(onChange.mock.lastCall![0]);
  act(() => {
    const optimistic = ref.current!.addSheet('Dropped tail');
    ref.current!.activateSheet(optimistic);
  });

  const originalDispatch = WorkbookController.prototype.dispatch;
  let rejectReplay = true;
  vi.spyOn(WorkbookController.prototype, 'dispatch').mockImplementation(function (
    this: WorkbookController,
    command,
    source,
    options,
  ) {
    if (rejectReplay && options?.notify === false && command.type === 'add-sheet') {
      rejectReplay = false;
      throw new TegoSheetException({
        code: 'INVALID_COMMAND',
        message: 'injected active-sheet replay truncation',
        recoverable: true,
      });
    }
    return originalDispatch.call(this, command, source, options) as never;
  });

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={acknowledged}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(ref.current!.getValue()).toEqual(acknowledged);
  expect(onError).toHaveBeenCalledOnce();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={expanded}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  const retained = activeSelection(rendered.container, onSelectionChange);
  act(() => ref.current!.setCellText({
    sheet: retained.sheet,
    row: 0,
    column: 0,
  }, 'truncation stayed clipped'));
  expect(ref.current!.getValue()[0]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'truncation stayed clipped' } },
  });
  expect(ref.current!.getValue()[1]?.rows?.[0]).toBeUndefined();
});

it('does not overwrite an explicit active-sheet decision made in the replacement commit stack', async () => {
  const initial = Array.from({ length: 6 }, (_, index) => ({ name: `S${index}` }));
  const replacement: WorkbookInput = [{ name: 'R0' }, { name: 'R1' }];
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  let replace!: () => void;

  function Host() {
    const [value, setValue] = useState<WorkbookInput>(initial);
    const [selectExplicit, setSelectExplicit] = useState(false);
    replace = () => {
      setSelectExplicit(true);
      setValue(replacement);
    };
    useLayoutEffect(() => {
      if (!selectExplicit) return;
      const explicit = ref.current!.addSheet('Explicit');
      ref.current!.activateSheet(explicit);
    }, [selectExplicit]);
    return (
      <TegoSheet
        ref={ref}
        value={value}
        initialActiveSheetIndex={5}
        onSelectionChange={onSelectionChange}
      />
    );
  }

  const rendered = render(<Host />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  act(replace);
  const explicit = activeSelection(rendered.container, onSelectionChange);
  act(() => ref.current!.setCellText({
    sheet: explicit.sheet,
    row: 0,
    column: 0,
  }, 'explicit wins'));
  expect(ref.current!.getValue()[2]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'explicit wins' } },
  });
});

it('clamps retained engine scroll when a replacement rebuilds a smaller viewport', () => {
  const controller = new WorkbookController({
    name: 'Large',
    rows: { len: 100 },
    cols: { len: 100 },
  });
  const root = document.createElement('div');
  Object.defineProperties(root, {
    clientHeight: { configurable: true, value: 200 },
    clientWidth: { configurable: true, value: 300 },
  });
  const adapter = createEngineAdapter({
    root,
    canvas: document.createElement('canvas'),
  });
  adapter.render(controller.getSnapshot(), controller.getSheetIds()[0]!);
  adapter.setScroll({ x: 5_000, y: 2_000 });
  expect(adapter.interactionSnapshot()?.viewport.scroll).toEqual({ x: 5_000, y: 2_000 });

  controller.replace({ name: 'Small', rows: { len: 2 }, cols: { len: 2 } });
  adapter.render(controller.getSnapshot(), controller.getSheetIds()[0]!);

  expect(adapter.interactionSnapshot()?.viewport.scroll).toEqual({ x: 0, y: 0 });
  adapter.dispose();
});

it('uses extension-key semantic equality while preserving sparse index significance', async () => {
  const value: WorkbookInput = [{
    name: 'A',
    metadata: { alpha: 1, beta: 2 },
    rows: { len: 4, 1: { cells: { 0: { text: 'indexed' } } } },
  }];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'pending'));
  const projected = structuredClone(onChange.mock.lastCall![0]);
  const equivalent = [{
    ...projected[0],
    metadata: { beta: 2, alpha: 1 },
  }] as WorkbookInput;
  onChange.mockClear();
  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={equivalent}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(onChange).not.toHaveBeenCalled();
  expect(() => ref.current!.getCell({ sheet, row: 0, column: 0 })).not.toThrow();

  const sparseReplacement: WorkbookInput = [{
    name: 'A',
    metadata: { alpha: 1, beta: 2 },
    rows: { len: 4, 2: { cells: { 0: { text: 'indexed' } } } },
  }];
  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={sparseReplacement}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(() => ref.current!.getCell({ sheet, row: 0, column: 0 })).toThrow(/unknown sheet/i);
});

it('replays added sheets with their original IDs before remapping later commands', async () => {
  const value: WorkbookInput = [];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(<TegoSheet ref={ref} value={value} onChange={onChange} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  let a!: ReturnType<TegoSheetHandle['addSheet']>;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    a = ref.current!.addSheet('A');
  });
  const first = structuredClone(onChange.mock.lastCall![0]);
  act(() => {
    b = ref.current!.addSheet('B');
    ref.current!.renameSheet(b, 'B renamed');
    ref.current!.setCellText({ sheet: b, row: 0, column: 0 }, 'tail');
  });
  const latest = structuredClone(onChange.mock.lastCall![0]);
  onChange.mockClear();

  rendered.rerender(<TegoSheet ref={ref} value={first} onChange={onChange} />);

  expect(ref.current!.getValue()).toEqual(latest);
  expect(onChange).not.toHaveBeenCalled();
  expect(() => ref.current!.getCell({ sheet: a, row: 0, column: 0 })).not.toThrow();
  expect(ref.current!.getCell({ sheet: b, row: 0, column: 0 })?.text).toBe('tail');

  rendered.rerender(
    <TegoSheet ref={ref} value={structuredClone(first)} onChange={onChange} />,
  );
  expect(ref.current!.getValue()).toEqual(first);
  expect(() => ref.current!.getCell({ sheet: a, row: 0, column: 0 })).not.toThrow();
  expect(() => ref.current!.getCell({ sheet: b, row: 0, column: 0 })).toThrow(/unknown sheet/i);
});

it('replays an existing optimistic tail even when the acknowledging render becomes read-only', async () => {
  const value: WorkbookInput = [{ name: 'A' }];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const onError = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'first'));
  const first = structuredClone(onChange.mock.lastCall![0]);
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 1 }, 'retained tail'));
  const latest = structuredClone(onChange.mock.lastCall![0]);
  onChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={first}
      readOnly
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current!.getValue()).toEqual(latest);
  expect(onChange).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
  expect(() => ref.current!.setCellText({ sheet, row: 1, column: 0 }, 'blocked')).toThrow(
    /read-only/i,
  );

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={structuredClone(first)}
      readOnly
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(ref.current!.getValue()).toEqual(first);
  expect(onError).not.toHaveBeenCalled();
});

it('truncates an actually invalid replay tail once and reports a recoverable command error', async () => {
  const value: WorkbookInput = [{ name: 'A' }];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const onCellEdit = vi.fn();
  const onError = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onCellEdit={onCellEdit}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  const base = structuredClone(ref.current!.getValue());
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'first'));
  const first = structuredClone(onChange.mock.lastCall![0]);
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 1 }, 'drop me'));
  const originalDispatch = WorkbookController.prototype.dispatch;
  let rejectReplay = true;
  vi.spyOn(WorkbookController.prototype, 'dispatch').mockImplementation(function (
    this: WorkbookController,
    command,
    source,
    options,
  ) {
    if (rejectReplay && options?.notify === false && command.type === 'set-cell-text') {
      rejectReplay = false;
      throw new TegoSheetException({
        code: 'INVALID_COMMAND',
        message: 'injected replay invalidation',
        recoverable: true,
      });
    }
    return originalDispatch.call(this, command, source, options) as never;
  });
  onChange.mockClear();
  onCellEdit.mockClear();
  onSelectionChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={first}
      onCellEdit={onCellEdit}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current!.getValue()).toEqual(first);
  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({
    code: 'INVALID_COMMAND',
    recoverable: true,
  }));

  act(() => ref.current!.undo());
  expect(ref.current!.getValue()).toEqual(base);
  expect(onError).toHaveBeenCalledOnce();
});

it('truncates replay when projected JSON matches but runtime sheet IDs drift', async () => {
  const value: WorkbookInput = [{ name: 'A' }];
  const onChange = vi.fn<(value: WorkbookData) => void>();
  const onError = vi.fn();
  const onSelectionChange = vi.fn<(selection: Selection) => void>();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'first'));
  const first = structuredClone(onChange.mock.lastCall![0]);
  act(() => ref.current!.setCellText({ sheet, row: 0, column: 1 }, 'drop on ID drift'));

  const originalDispatch = WorkbookController.prototype.dispatch;
  let driftReplayIds = true;
  vi.spyOn(WorkbookController.prototype, 'dispatch').mockImplementation(function (
    this: WorkbookController,
    command,
    source,
    options,
  ) {
    const outcome = originalDispatch.call(this, command, source, options);
    if (driftReplayIds && options?.notify === false && outcome.status === 'committed') {
      driftReplayIds = false;
      (this as unknown as { state: WorkbookState }).state = WorkbookState.from(this.getValue());
    }
    return outcome as never;
  });
  onChange.mockClear();
  onSelectionChange.mockClear();

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={first}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current!.getValue()).toEqual(first);
  expect(ref.current!.getCell({ sheet, row: 0, column: 1 })?.text ?? '').toBe('');
  expect(onChange).not.toHaveBeenCalled();
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({
    code: 'INVALID_COMMAND',
    recoverable: true,
  }));

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={first}
      onChange={onChange}
      onError={onError}
      onSelectionChange={onSelectionChange}
    />,
  );
  expect(onError).toHaveBeenCalledOnce();
});

it.each(['rollback', 'replace'] as const)(
  'stops old commit notifications after an onChange flushSync %s decision',
  async decision => {
    const base: WorkbookInput = [{ name: 'A' }];
    const replacement: WorkbookInput = [{ name: 'Replacement' }];
    const onChange = vi.fn();
    const onCellEdit = vi.fn();
    const onSelectionChange = vi.fn<(selection: Selection) => void>();
    const ref = createRef<TegoSheetHandle>();

    function Host() {
      const [value, setValue] = useState(base);
      return (
        <TegoSheet
          ref={ref}
          value={value}
          onChange={() => {
            onChange();
            flushSync(() => setValue(structuredClone(
              decision === 'rollback' ? base : replacement,
            )));
          }}
          onCellEdit={onCellEdit}
          onSelectionChange={onSelectionChange}
        />
      );
    }

    const rendered = render(<Host />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    const sheet = activeSelection(rendered.container, onSelectionChange).sheet;
    onSelectionChange.mockClear();

    act(() => ref.current!.setCellText({ sheet, row: 0, column: 0 }, 'superseded'));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onCellEdit).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(ref.current!.getValue()[0]?.name).toBe(
      decision === 'rollback' ? 'A' : 'Replacement',
    );
    expect(ref.current!.getValue()[0]?.rows?.[0]).toBeUndefined();
  },
);
