import { cleanup, render, waitFor } from '@testing-library/react';
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

it('@parity:locale.switch-language uses live recursive overlays with per-instance isolation', async () => {
  const rendered = render(
    <>
      <TegoSheet
        defaultValue={[{}]}
        locale={{ id: 'de', messages: { toolbar: { undo: 'Rückgängig' } } }}
      />
      <TegoSheet defaultValue={[{}]} />
    </>,
  );
  await waitFor(() => expect(rendered.getByRole('button', { name: 'Rückgängig' })).toBeTruthy());
  expect(rendered.getAllByRole('button', { name: 'Redo' })).toHaveLength(2);
  expect(rendered.getByRole('button', { name: 'Undo' })).toBeTruthy();

  rendered.rerender(
    <TegoSheet
      defaultValue={[{}]}
      locale={{ id: 'fr', messages: { toolbar: { undo: 'Annuler' } } }}
    />,
  );
  expect(rendered.getByRole('button', { name: 'Annuler' })).toBeTruthy();
});
