import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet } from '../../src';
import type { TegoSheetHandle } from '../../src';
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

it('treats an empty object as one blank sheet', async () => {
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(<TegoSheet ref={ref} defaultValue={{}} />);
  await waitFor(() => expect(ref.current).not.toBeNull());

  expect(ref.current!.getValue()).toHaveLength(1);
  expect(rendered.container.querySelector('canvas')).not.toBeNull();
  expect(rendered.getByRole('button', { name: /add sheet/i })).not.toBeNull();
});

it('preserves an empty array and lets an editable user add the first sheet', async () => {
  const onChange = vi.fn();
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      initialActiveSheetIndex={99}
      onChange={onChange}
    />,
  );
  await waitFor(() => expect(ref.current).not.toBeNull());

  expect(ref.current!.getValue()).toEqual([]);
  expect(rendered.container.querySelector('canvas')).toBeNull();
  fireEvent.click(rendered.getByRole('button', { name: /add sheet/i }));

  expect(ref.current!.getValue()).toHaveLength(1);
  expect(onChange).toHaveBeenCalledOnce();
  await waitFor(() => expect(rendered.container.querySelector('canvas')).not.toBeNull());
  expect(requestAnimationFrame).toHaveBeenCalled();
});

it('disables print in the default and custom toolbar while no active sheet exists', async () => {
  let disabledActions: ReadonlySet<string> | undefined;
  const rendered = render(<TegoSheet defaultValue={[]} />);
  await waitFor(() => expect(rendered.getByRole('button', { name: /print/i })).toBeTruthy());
  expect(rendered.getByRole('button', { name: /print/i }).hasAttribute('disabled')).toBe(true);

  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      toolbar={props => {
        disabledActions = props.disabledActions;
        return null;
      }}
    />,
  );
  await waitFor(() => expect(disabledActions?.has('print')).toBe(true));
});

it('disposes the canvas runtime when deleting the final sheet', async () => {
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(<TegoSheet ref={ref} defaultValue={[]} />);
  await waitFor(() => expect(ref.current).not.toBeNull());

  const sheet = ref.current!.addSheet('Temporary');
  await waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled());
  ref.current!.deleteSheet(sheet);

  await waitFor(() => expect(rendered.container.querySelector('canvas')).toBeNull());
  expect(cancelAnimationFrame).toHaveBeenCalled();
  expect(ref.current!.getValue()).toEqual([]);
});

it('renders no mutation affordance for a read-only empty workbook', async () => {
  const ref = createRef<TegoSheetHandle>();
  const rendered = render(<TegoSheet ref={ref} defaultValue={[]} readOnly />);
  await waitFor(() => expect(ref.current).not.toBeNull());

  expect(rendered.getByText(/empty workbook/i)).not.toBeNull();
  expect(rendered.queryByRole('button', { name: /add sheet/i })).toBeNull();
  expect(() => ref.current!.addSheet()).toThrow(/read-only/i);
  expect(ref.current!.getValue()).toEqual([]);
});
