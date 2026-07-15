import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet } from '../../src';
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

it('reports a recoverable UI failure through the latest callback and default notification', async () => {
  const first = vi.fn();
  const latest = vi.fn();
  const toolbar = (props: import('../../src').ToolbarRenderProps) => (
    <button
      type="button"
      onClick={() => props.execute({ type: 'set-style', patch: { font: { bold: true } } })}
    >
      Force unavailable action
    </button>
  );
  const rendered = render(
    <TegoSheet defaultValue={[{}]} readOnly toolbar={toolbar} onError={first} />,
  );
  await waitFor(() => expect(rendered.getByRole('button', { name: /force unavailable/i })).toBeTruthy());
  rendered.rerender(
    <TegoSheet defaultValue={[{}]} readOnly toolbar={toolbar} onError={latest} />,
  );

  fireEvent.click(rendered.getByRole('button', { name: /force unavailable/i }));
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith(expect.objectContaining({
    code: 'INVALID_COMMAND',
    recoverable: true,
  }));
  expect(rendered.getByRole('status').textContent).toMatch(/unavailable|read-only/i);
});
