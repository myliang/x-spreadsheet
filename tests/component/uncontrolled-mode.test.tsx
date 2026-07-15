import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, startTransition, Suspense } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet } from '../../src';
import type { TegoSheetHandle } from '../../src';
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
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('owns uncontrolled state, reads defaultValue once, and isolates every returned value', async () => {
  const initial = [{ name: 'Initial' }];
  const onChange = vi.fn();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet ref={ref} defaultValue={initial} onChange={onChange} />,
  );

  await waitFor(() => expect(ref.current).not.toBeNull());
  const sheet = ref.current!.getValue()[0];
  expect(sheet?.name).toBe('Initial');

  initial[0]!.name = 'Caller mutation';
  rendered.rerender(
    <TegoSheet ref={ref} defaultValue={[{ name: 'Ignored rerender' }]} onChange={onChange} />,
  );
  expect(ref.current!.getValue()[0]?.name).toBe('Initial');

  const sheetId = ref.current!.addSheet('Owned');
  ref.current!.setCellText({ sheet: sheetId, row: 0, column: 0 }, 'private');
  const firstRead = ref.current!.getValue() as { name?: string }[];
  firstRead[0]!.name = 'Mutated result';

  expect(ref.current!.getValue().map(value => value.name)).toEqual(['Initial', 'Owned']);
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange.mock.calls[1]![0]).not.toBe(ref.current!.getValue());
});

it('keeps two mounted uncontrolled components isolated', async () => {
  const first = createRef<TegoSheetHandle>();
  const second = createRef<TegoSheetHandle>();
  const onFirstSelection = vi.fn();
  const onSecondSelection = vi.fn();
  const rendered = render(
    <>
      <TegoSheet
        ref={first}
        defaultValue={[{ name: 'First' }]}
        onSelectionChange={onFirstSelection}
      />
      <TegoSheet
        ref={second}
        defaultValue={[{ name: 'Second' }]}
        onSelectionChange={onSecondSelection}
      />
    </>,
  );
  await waitFor(() => {
    expect(first.current).not.toBeNull();
    expect(second.current).not.toBeNull();
  });

  first.current!.addSheet('First only');
  expect(first.current!.getValue().map(sheet => sheet.name)).toEqual(['First', 'First only']);
  expect(second.current!.getValue().map(sheet => sheet.name)).toEqual(['Second']);

  const roots = rendered.container.querySelectorAll<HTMLElement>('[data-tego-sheet]');
  fireEvent.focusIn(roots[0]!);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(roots).toHaveLength(2);
  expect(onFirstSelection).toHaveBeenCalledOnce();
  expect(onSecondSelection).not.toHaveBeenCalled();
});

it('rejects an invalid mount-only active sheet index as a contract error', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);

  expect(() => render(
    <TegoSheet defaultValue={[{ name: 'Only' }]} initialActiveSheetIndex={1} />,
  )).toThrowError(expect.objectContaining({
    code: 'INVALID_COMMAND',
    recoverable: false,
  }));
});

it('validates initialActiveSheetIndex only against the mount workbook', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'A' }, { name: 'B' }]}
      initialActiveSheetIndex={1}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  const initialB = onSelectionChange.mock.lastCall?.[0].sheet;

  expect(() => ref.current!.deleteSheet(initialB)).not.toThrow();
  expect(ref.current!.getValue().map(sheet => sheet.name)).toEqual(['A']);
});

it('selects the next sheet after a middle deletion, then the preceding sheet at the tail', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  const callbackOrder: string[] = [];
  const onChange = vi.fn(() => callbackOrder.push('change'));
  const onActiveSheetChange = vi.fn(() => callbackOrder.push('active'));
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      onActiveSheetChange={onActiveSheetChange}
      onChange={onChange}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  let a!: ReturnType<TegoSheetHandle['addSheet']>;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  let c!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    a = ref.current!.addSheet('A');
  });
  act(() => {
    b = ref.current!.addSheet('B');
    c = ref.current!.addSheet('C');
  });
  callbackOrder.length = 0;
  onChange.mockClear();
  onActiveSheetChange.mockClear();
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;

  act(() => {
    captured.activateSheet(b);
    captured.deleteSheet(b);
  });
  expect(ref.current).toBe(captured);
  expect(callbackOrder).toEqual(['active', 'change']);
  expect(onActiveSheetChange).toHaveBeenCalledOnce();
  expect(onChange).toHaveBeenCalledOnce();
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange.mock.lastCall?.[0].sheet).toBe(c);

  act(() => ref.current!.deleteSheet(c));
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange.mock.lastCall?.[0].sheet).toBe(a);

  act(() => ref.current!.deleteSheet(a));
  expect(ref.current!.getValue()).toEqual([]);
  expect(rendered.container.querySelector('canvas')).toBeNull();
});

it('preserves an active-sheet decision made reentrantly from a delete callback', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  const callbackOrder: string[] = [];
  let reenter = false;
  let a!: ReturnType<TegoSheetHandle['addSheet']>;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  let c!: ReturnType<TegoSheetHandle['addSheet']>;
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      onActiveSheetChange={() => callbackOrder.push('active')}
      onChange={() => {
        callbackOrder.push('change');
        if (reenter) ref.current!.activateSheet(a);
      }}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  act(() => {
    a = captured.addSheet('A');
    b = captured.addSheet('B');
    c = captured.addSheet('C');
    captured.activateSheet(b);
  });
  callbackOrder.length = 0;
  reenter = true;

  act(() => captured.deleteSheet(b));

  expect(ref.current).toBe(captured);
  expect(callbackOrder).toEqual(['change', 'active']);
  expect(captured.getValue().map(sheet => sheet.name)).toEqual(['A', 'C']);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange.mock.lastCall?.[0].sheet).toBe(a);
  expect(onSelectionChange.mock.lastCall?.[0].sheet).not.toBe(c);
});

it('preserves a nested add-and-activate decision made from the first add callback', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  const callbackOrder: string[] = [];
  let nested = false;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      onActiveSheetChange={() => callbackOrder.push('active')}
      onChange={(_value, change) => {
        callbackOrder.push(`change:${change.kind}`);
        if (nested) return;
        nested = true;
        b = ref.current!.addSheet('B');
        ref.current!.activateSheet(b);
      }}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;

  let a!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    a = captured.addSheet('A');
  });

  expect(ref.current).toBe(captured);
  expect(callbackOrder).toEqual(['change:sheet', 'change:sheet', 'active']);
  expect(captured.getValue().map(sheet => sheet.name)).toEqual(['A', 'B']);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange.mock.lastCall?.[0].sheet).toBe(b);
  expect(onSelectionChange.mock.lastCall?.[0].sheet).not.toBe(a);
});

it('treats reentrant activation of the default as a decision before later reentrancy', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  const callbackOrder: string[] = [];
  let nested = false;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      onActiveSheetChange={() => {
        callbackOrder.push('active');
        if (b === undefined) {
          b = ref.current!.addSheet('B');
          ref.current!.activateSheet(b);
        }
      }}
      onChange={(_value, change) => {
        callbackOrder.push('change');
        if (!nested) {
          nested = true;
          ref.current!.activateSheet(change.sheet);
        }
      }}
      onSelectionChange={onSelectionChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;

  let a!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    a = captured.addSheet('A');
  });

  expect(ref.current).toBe(captured);
  expect(callbackOrder).toEqual(['change', 'active', 'change', 'active']);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange.mock.lastCall?.[0].sheet).toBe(b);
  expect(onSelectionChange.mock.lastCall?.[0].sheet).not.toBe(a);
});

it('does not apply a late default after an onChange callback unmounts the sheet', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onChange = vi.fn(() => rendered.unmount());
  const rendered = render(<TegoSheet ref={ref} defaultValue={[]} onChange={onChange} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;

  let added!: ReturnType<TegoSheetHandle['addSheet']>;
  expect(() => {
    act(() => {
      added = captured.addSheet('A');
    });
  }).not.toThrow();

  expect(typeof added).toBe('string');
  expect(onChange).toHaveBeenCalledOnce();
  expect(ref.current).toBeNull();
});

it('does not apply a late replacement after a delete callback unmounts the sheet', async () => {
  const ref = createRef<TegoSheetHandle>();
  let unmountOnChange = false;
  const onChange = vi.fn(() => {
    if (unmountOnChange) rendered.unmount();
  });
  const rendered = render(<TegoSheet ref={ref} defaultValue={[]} onChange={onChange} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    captured.addSheet('A');
    b = captured.addSheet('B');
    captured.activateSheet(b);
  });
  onChange.mockClear();
  unmountOnChange = true;

  expect(() => {
    act(() => captured.deleteSheet(b));
  }).not.toThrow();

  expect(onChange).toHaveBeenCalledOnce();
  expect(ref.current).toBeNull();
});

it('preserves a consumer exception when its onChange callback also unmounts the sheet', async () => {
  const ref = createRef<TegoSheetHandle>();
  const consumerError = new Error('consumer callback failed');
  const onChange = vi.fn(() => {
    rendered.unmount();
    throw consumerError;
  });
  const rendered = render(<TegoSheet ref={ref} defaultValue={[]} onChange={onChange} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;

  expect(() => {
    act(() => captured.addSheet('A'));
  }).toThrow(consumerError);
  expect(onChange).toHaveBeenCalledOnce();
  expect(ref.current).toBeNull();
});

it('selects the preceding sheet when activating and deleting the tail in one batch', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onSelectionChange = vi.fn();
  const rendered = render(
    <TegoSheet ref={ref} defaultValue={[]} onSelectionChange={onSelectionChange} />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  let b!: ReturnType<TegoSheetHandle['addSheet']>;
  let c!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    captured.addSheet('A');
  });
  act(() => {
    b = captured.addSheet('B');
    c = captured.addSheet('C');
  });

  act(() => {
    captured.activateSheet(c);
    captured.deleteSheet(c);
  });
  expect(ref.current).toBe(captured);
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(onSelectionChange.mock.lastCall?.[0].sheet).toBe(b);
});

it('can add and delete the first sheet in one imperative batch', async () => {
  const ref = createRef<TegoSheetHandle>();
  const onChange = vi.fn();
  render(<TegoSheet ref={ref} defaultValue={[]} onChange={onChange} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;

  act(() => {
    const added = captured.addSheet('Temporary');
    captured.deleteSheet(added);
  });

  expect(ref.current).toBe(captured);
  expect(captured.getValue()).toEqual([]);
  expect(onChange).toHaveBeenCalledTimes(2);
  expect(onChange.mock.calls.map(call => call[1].kind)).toEqual(['sheet', 'sheet']);
});

it('does not let an aborted render overwrite the committed handle runtime', async () => {
  const ref = createRef<TegoSheetHandle>();
  const committed = vi.fn();
  const pending = vi.fn();
  const suspended = new Promise<never>(() => undefined);
  let shouldSuspend = false;

  function PendingBoundary() {
    if (shouldSuspend) throw suspended;
    return null;
  }
  function Mounted({ onChange }: { readonly onChange: typeof committed }) {
    return (
      <Suspense fallback={<output data-suspended="" />}>
        <TegoSheet ref={ref} defaultValue={[]} onChange={onChange} />
        <PendingBoundary />
      </Suspense>
    );
  }

  const rendered = render(<Mounted onChange={committed} />);
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  let sheet!: ReturnType<TegoSheetHandle['addSheet']>;
  act(() => {
    sheet = captured.addSheet('Committed');
  });
  committed.mockClear();

  shouldSuspend = true;
  act(() => {
    startTransition(() => rendered.rerender(<Mounted onChange={pending} />));
  });
  act(() => {
    captured.setCellText({ sheet, row: 0, column: 0 }, 'committed runtime');
  });

  expect(ref.current).toBe(captured);
  expect(committed).toHaveBeenCalledOnce();
  expect(pending).not.toHaveBeenCalled();
});

it('keeps one handle object live for the mounted epoch and deactivates captured handles', async () => {
  const firstChange = vi.fn();
  const latestChange = vi.fn();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet ref={ref} defaultValue={[]} onChange={firstChange} />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());
  const captured = ref.current!;
  const a = captured.addSheet('A');
  expect(ref.current).toBe(captured);

  rendered.rerender(
    <TegoSheet
      ref={ref}
      defaultValue={[{ name: 'ignored' }]}
      options={{ defaultStyle: { color: '#123456' } }}
      onChange={latestChange}
    />,
  );
  expect(ref.current).toBe(captured);
  captured.setCellText({ sheet: a, row: 0, column: 0 }, 'latest');
  expect(ref.current).toBe(captured);
  expect(firstChange).toHaveBeenCalledOnce();
  expect(latestChange).toHaveBeenCalledOnce();

  const b = captured.addSheet('B');
  captured.activateSheet(b);
  captured.deleteSheet(b);
  captured.recalculateLayout();
  expect(ref.current).toBe(captured);
  expect(captured.getValue().map(sheet => sheet.name)).toEqual(['A']);

  const changesBeforeUnmount = latestChange.mock.calls.length;
  rendered.unmount();
  expect(ref.current).toBeNull();
  expect(() => captured.setCellText({ sheet: a, row: 0, column: 0 }, 'late')).toThrow(
    /inactive/i,
  );
  expect(() => captured.addSheet('late')).toThrow(/inactive/i);
  expect(latestChange).toHaveBeenCalledTimes(changesBeforeUnmount);
});
