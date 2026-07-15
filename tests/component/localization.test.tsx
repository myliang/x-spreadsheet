import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TegoSheet } from '../../src';
import { de, nl } from '../../src/locales';
import { createCanvasHarness } from '../helpers/canvas-harness';
import { FormulaSuggestions } from '../../src/ui/editor/formula-suggestions';
import { createTranslator } from '../../src/ui/translate';

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

it('renders German format and validation choices without internal option ids', async () => {
  const rendered = render(<TegoSheet defaultValue={[{}]} locale={de} />);
  const format = await rendered.findByRole('combobox', { name: 'Zahlenformat' });
  expect(within(format).getByRole('option', { name: 'Nummer' })).toBeTruthy();
  expect(within(format).queryByRole('option', { name: 'number' })).toBeNull();

  fireEvent.click(rendered.getByRole('button', { name: 'Datenüberprüfung' }));
  const dialog = rendered.getByRole('dialog', { name: 'Datenüberprüfung' });
  const [type, operator] = within(dialog).getAllByRole('combobox');
  expect(within(type!).getByRole('option', { name: 'Liste' })).toBeTruthy();
  expect(within(type!).queryByRole('option', { name: 'list' })).toBeNull();
  expect(within(operator!).getByRole('option', { name: 'zwischen' })).toBeTruthy();
  expect(within(operator!).queryByRole('option', { name: 'be' })).toBeNull();
});

it('renders Dutch format labels and localized formula suggestions', async () => {
  const rendered = render(<TegoSheet defaultValue={[{}]} locale={nl} />);
  const format = await rendered.findByRole('combobox', { name: 'Getalnotatie' });
  expect(within(format).getByRole('option', { name: 'Nummer' })).toBeTruthy();
  expect(within(format).queryByRole('option', { name: 'number' })).toBeNull();

  const formula = render(
    <FormulaSuggestions value="=s" onSelect={() => undefined} t={createTranslator(nl)} />,
  );
  expect(formula.getByRole('option', { name: 'Som' })).toBeTruthy();
  expect(formula.queryByRole('option', { name: 'SUM' })).toBeNull();
});
