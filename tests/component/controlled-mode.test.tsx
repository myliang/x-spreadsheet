import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import {
  createRef,
  startTransition,
  Suspense,
  useLayoutEffect,
  useState,
} from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet } from '../../src';
import type { TegoSheetHandle, WorkbookInput } from '../../src';
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

it('keeps optimistic state across same-reference renders without mutating value', async () => {
  const value: WorkbookInput = [{
    name: 'Controlled',
    extension: { nested: ['caller', false, 0] },
  }];
  const before = structuredClone(value);
  const onChange = vi.fn();
  const onSelectionChange = vi.fn();
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
  const captured = ref.current!;
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  const sheet = onSelectionChange.mock.lastCall![0].sheet;

  act(() => captured.setCellText({ sheet, row: 0, column: 0 }, 'optimistic'));
  expect(captured.getValue()[0]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'optimistic' } },
  });

  rendered.rerender(
    <TegoSheet
      ref={ref}
      value={value}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );

  expect(ref.current).toBe(captured);
  expect(captured.getValue()[0]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'optimistic' } },
  });
  expect(onChange).toHaveBeenCalledOnce();
  expect(value).toEqual(before);
});

it('retains the last valid controlled document and reports each invalid reference once', async () => {
  const valid: WorkbookInput = [{ name: 'Valid' }];
  const invalid = { rows: { len: -1 } } as unknown as WorkbookInput;
  const onError = vi.fn();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(<TegoSheet ref={ref} value={valid} onError={onError} />);
  await waitFor(() => expect(ref.current).not.toBeNull());

  rendered.rerender(<TegoSheet ref={ref} value={invalid} onError={onError} />);
  rendered.rerender(<TegoSheet ref={ref} value={invalid} onError={onError} />);
  rendered.rerender(<TegoSheet ref={ref} value={valid} onError={onError} />);
  rendered.rerender(<TegoSheet ref={ref} value={invalid} onError={onError} />);

  expect(ref.current!.getValue()[0]?.name).toBe('Valid');
  expect(onError).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({
    code: 'INVALID_DATA',
    recoverable: true,
  }));

  const anotherInvalid = { rows: { len: -1 } } as unknown as WorkbookInput;
  rendered.rerender(<TegoSheet ref={ref} value={anotherInvalid} onError={onError} />);
  expect(onError).toHaveBeenCalledTimes(2);
});

it('rejects switching a mounted controlled component to uncontrolled mode', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(<TegoSheet ref={ref} value={[{}]} />);
  await waitFor(() => expect(ref.current).not.toBeNull());

  expect(() => rendered.rerender(<TegoSheet ref={ref} defaultValue={[{}]} />)).toThrowError(
    expect.objectContaining({ code: 'INVALID_COMMAND', recoverable: false }),
  );
});

it('reconciles a value replacement committed before the controller epoch activates', async () => {
  const initial: WorkbookInput = [{ name: 'Initial' }];
  const replacement: WorkbookInput = [{ name: 'Replacement' }];
  const ref = createRef<TegoSheetHandle>();

  function Host() {
    const [value, setValue] = useState(initial);
    useLayoutEffect(() => setValue(replacement), []);
    return <TegoSheet ref={ref} value={value} />;
  }

  render(<Host />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  expect(ref.current!.getValue()[0]?.name).toBe('Replacement');
});

it('reports an invalid value committed before the controller epoch activates once', async () => {
  const initial: WorkbookInput = [{ name: 'Initial' }];
  const invalid = { rows: { len: -1 } } as unknown as WorkbookInput;
  const onError = vi.fn();
  const ref = createRef<TegoSheetHandle>();

  function Host() {
    const [value, setValue] = useState(initial);
    useLayoutEffect(() => setValue(invalid), []);
    return <TegoSheet ref={ref} value={value} onError={onError} />;
  }

  render(<Host />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  expect(ref.current!.getValue()[0]?.name).toBe('Initial');
  expect(onError).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_DATA' }));
});

it('does not reconcile a controlled value from an aborted render', async () => {
  const initial: WorkbookInput = [{ name: 'Committed' }];
  const replacement: WorkbookInput = [{ name: 'Aborted replacement' }];
  const ref = createRef<TegoSheetHandle>();
  const suspended = new Promise<never>(() => undefined);
  let shouldSuspend = false;

  function PendingBoundary() {
    if (shouldSuspend) throw suspended;
    return null;
  }
  function Mounted({ value }: { readonly value: WorkbookInput }) {
    return (
      <Suspense fallback={<output data-suspended="" />}>
        <TegoSheet ref={ref} value={value} />
        <PendingBoundary />
      </Suspense>
    );
  }

  const rendered = render(<Mounted value={initial} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  let sheet!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    sheet = captured.addSheet('Optimistic sheet');
  });
  act(() => captured.setCellText({ sheet, row: 0, column: 0 }, 'optimistic'));

  shouldSuspend = true;
  act(() => {
    startTransition(() => rendered.rerender(<Mounted value={replacement} />));
  });

  expect(ref.current).toBe(captured);
  expect(captured.getValue()).toHaveLength(2);
  expect(captured.getValue()[1]).toMatchObject({
    name: 'Optimistic sheet',
    rows: { 0: { cells: { 0: { text: 'optimistic' } } } },
  });
});
