import { act, cleanup, render, waitFor } from '@testing-library/react';
import {
  createRef,
  startTransition,
  StrictMode,
  Suspense,
} from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet, type TegoSheetError, type TegoSheetHandle } from '../../src';
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
  let printStyle = '';
  let printPages = 0;
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    printStyle = document.querySelector('[data-tego-print-style]')?.textContent ?? '';
    printPages = document.querySelectorAll('[data-tego-print-pages] canvas').length;
  });
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
  expect(printStyle).toContain('A4 portrait');
  expect(printPages).toBeGreaterThan(0);
  expect(document.querySelector('[data-tego-print-pages]')).toBeNull();

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

it('reports ref print failures through the latest onError and propagates consumer errors', async () => {
  const ref = createRef<TegoSheetHandle>();
  const first: TegoSheetError[] = [];
  const latest: TegoSheetError[] = [];
  const printFailure = new Error('printer offline');
  vi.spyOn(window, 'print').mockImplementation(() => {
    throw printFailure;
  });
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A' }]}
      onError={error => first.push(error)}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  rendered.rerender(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      onError={error => latest.push(error)}
    />,
  );

  expect(() => ref.current!.print()).not.toThrow();
  expect(first).toEqual([]);
  expect(latest).toEqual([expect.objectContaining({
    code: 'PRINT_FAILED',
    recoverable: true,
    cause: expect.objectContaining({ name: 'Error', message: 'printer offline' }),
  })]);

  const consumerFailure = new Error('consumer onError failed');
  rendered.rerender(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      onError={() => {
        throw consumerFailure;
      }}
    />,
  );
  expect(() => ref.current!.print()).toThrow(consumerFailure);
});

it.each([
  ['empty', []],
  ['non-empty', [{ name: 'A' }]],
] as const)('focuses the %s sheet when its callback ref first receives the handle', (_, value) => {
  let handle: TegoSheetHandle | null = null;
  let focused: Element | null = null;
  const rendered = render(
    <TegoSheet
      defaultValue={value}
      ref={next => {
        if (next === null) return;
        handle = next;
        next.focus();
        focused = document.activeElement;
      }}
    />,
  );
  const root = rendered.container.querySelector('[data-tego-sheet]');

  expect(handle).not.toBeNull();
  expect(focused).toBe(root);
  expect(document.activeElement).toBe(root);
});

it('keeps callback-ref roots isolated across StrictMode teardown and unmount', () => {
  let handle: TegoSheetHandle | null = null;
  const attachments: Array<TegoSheetHandle | null> = [];
  const rendered = render(
    <StrictMode>
      <TegoSheet
        defaultValue={[]}
        ref={next => {
          attachments.push(next);
          if (next === null) return;
          handle = next;
          next.focus();
        }}
      />
    </StrictMode>,
  );
  const root = rendered.container.querySelector('[data-tego-sheet]');
  expect(document.activeElement).toBe(root);

  rendered.unmount();

  expect(attachments.at(-1)).toBeNull();
  expect(() => handle!.focus()).toThrowError(
    expect.objectContaining({ code: 'INVALID_COMMAND' }),
  );
  expect(document.activeElement).not.toBe(root);
});

it('does not attach an imperative root from an aborted render', () => {
  const suspended = new Promise<never>(() => undefined);
  let committedHandle: TegoSheetHandle | null = null;
  let pendingAttachments = 0;

  function SuspendAfterSheet(props: { readonly active: boolean }) {
    if (props.active) throw suspended;
    return null;
  }

  function Host(props: { readonly pending: boolean }) {
    return (
      <Suspense fallback={<output data-suspended="" />}>
        <TegoSheet
          key={props.pending ? 'pending' : 'committed'}
          defaultValue={[{ name: props.pending ? 'Pending' : 'Committed' }]}
          ref={next => {
            if (next === null) return;
            if (props.pending) pendingAttachments += 1;
            else committedHandle = next;
          }}
        />
        <SuspendAfterSheet active={props.pending} />
      </Suspense>
    );
  }

  const rendered = render(<Host pending={false} />);
  const committedRoot = rendered.container.querySelector('[data-tego-sheet]');
  act(() => {
    startTransition(() => rendered.rerender(<Host pending />));
  });
  committedHandle!.focus();

  expect(pendingAttachments).toBe(0);
  expect(rendered.container.querySelector('[data-tego-sheet]')).toBe(committedRoot);
  expect(document.activeElement).toBe(committedRoot);
});
