import { act } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderSheet } from '../helpers/render-sheet';

it('initializes a single blank sheet from an empty object', () => {
  const rendered = renderSheet({ defaultValue: {} });

  expect(rendered.container.querySelector('output')?.getAttribute('data-mode')).toBe(
    'uncontrolled',
  );
  expect(rendered.container.querySelector('output')?.getAttribute('data-sheets')).toBe('1');
  expect(rendered.runtime.epoch.controller.getValue()).toHaveLength(1);
});

it('preserves an empty array as an empty workbook', () => {
  const rendered = renderSheet({ defaultValue: [] });

  expect(rendered.container.querySelector('output')?.getAttribute('data-sheets')).toBe('0');
  expect(rendered.runtime.epoch.controller.getValue()).toEqual([]);
});

it('reads defaultValue only for the controller epoch initialization', () => {
  const rendered = renderSheet({ defaultValue: [{ name: 'Initial' }] });

  rendered.rerenderProps({ defaultValue: [{ name: 'Ignored' }] });

  expect(rendered.runtime.epoch.controller.getValue()[0]?.name).toBe('Initial');
});

it('keeps the controller epoch usable through Strict Mode effect replay', () => {
  const rendered = renderSheet({ defaultValue: [{}] }, { strict: true });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  expect(() => act(() => {
    rendered.runtime.dispatchRef({
      type: 'set-cell-text',
      address: { sheet, row: 0, column: 0 },
      text: 'strict',
    });
  })).not.toThrow();
});
