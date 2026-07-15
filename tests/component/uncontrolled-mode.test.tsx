import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
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
