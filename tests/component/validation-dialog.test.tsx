import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ValidationDialog } from '../../src/ui/dialogs/validation-dialog';

const t = (_path: string, fallback: string) => fallback;

afterEach(cleanup);

it('blocks an empty list rule and shows inline validation feedback', () => {
  const onSave = vi.fn();
  const rendered = render(
    <ValidationDialog onClose={vi.fn()} onRemove={vi.fn()} onSave={onSave} t={t} />,
  );

  const dialog = rendered.getByRole('dialog', { name: /data validation/i });
  const save = within(dialog).getByRole('button', { name: /^save$/i });
  const value = within(dialog).getByRole('textbox', { name: /value/i });

  expect(save.hasAttribute('disabled')).toBe(true);
  expect(within(dialog).getByRole('status').textContent).toMatch(/list value/i);

  fireEvent.change(value, { target: { value: '   ' } });
  expect(save.hasAttribute('disabled')).toBe(true);

  fireEvent.change(value, { target: { value: 'Alpha, Beta' } });
  expect(save.hasAttribute('disabled')).toBe(false);
  fireEvent.click(save);

  expect(onSave).toHaveBeenCalledWith({
    mode: 'cell',
    type: 'list',
    required: false,
    value: 'Alpha, Beta',
  });
});

it('requires exactly two nonblank values for between operators', () => {
  const onSave = vi.fn();
  const rendered = render(
    <ValidationDialog onClose={vi.fn()} onRemove={vi.fn()} onSave={onSave} t={t} />,
  );
  const dialog = rendered.getByRole('dialog', { name: /data validation/i });
  const type = dialog.querySelector<HTMLSelectElement>('select[name="type"]')!;
  const operator = within(dialog).getByRole('combobox', { name: /operator/i });
  const value = within(dialog).getByRole('textbox', { name: /value/i });
  const save = within(dialog).getByRole('button', { name: /^save$/i });

  fireEvent.change(type, { target: { value: 'number' } });
  expect(save.hasAttribute('disabled')).toBe(false);

  fireEvent.change(operator, { target: { value: 'be' } });
  for (const invalid of ['1', '1,', ',2', '1,2,3']) {
    fireEvent.change(value, { target: { value: invalid } });
    expect(save.hasAttribute('disabled')).toBe(true);
    expect(within(dialog).getByRole('status').textContent).toMatch(/exactly two/i);
  }

  fireEvent.change(value, { target: { value: ' 1 , 2 ' } });
  expect(save.hasAttribute('disabled')).toBe(false);
  fireEvent.click(save);

  expect(onSave).toHaveBeenCalledWith({
    mode: 'cell',
    type: 'number',
    required: false,
    operator: 'be',
    value: ['1', '2'],
  });
});

it('blocks blank scalar comparisons while keeping value-free rules valid', () => {
  const onSave = vi.fn();
  const rendered = render(
    <ValidationDialog onClose={vi.fn()} onRemove={vi.fn()} onSave={onSave} t={t} />,
  );
  const dialog = rendered.getByRole('dialog', { name: /data validation/i });
  const type = dialog.querySelector<HTMLSelectElement>('select[name="type"]')!;
  const operator = within(dialog).getByRole('combobox', { name: /operator/i });
  const value = within(dialog).getByRole('textbox', { name: /value/i });
  const save = within(dialog).getByRole('button', { name: /^save$/i });

  fireEvent.change(type, { target: { value: 'email' } });
  expect(save.hasAttribute('disabled')).toBe(false);

  fireEvent.change(operator, { target: { value: 'eq' } });
  expect(save.hasAttribute('disabled')).toBe(true);
  expect(within(dialog).getByRole('status').textContent).toMatch(/comparison value/i);

  fireEvent.change(value, { target: { value: 'example@example.com' } });
  expect(save.hasAttribute('disabled')).toBe(false);
  fireEvent.click(save);

  expect(onSave).toHaveBeenCalledWith({
    mode: 'cell',
    type: 'email',
    required: false,
    operator: 'eq',
    value: 'example@example.com',
  });
});
