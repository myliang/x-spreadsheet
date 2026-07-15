import { act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TegoSheetException, type Selection, type TegoSheetError } from '../../src/core';
import { renderSheet } from '../helpers/render-sheet';

it('orders a committed cell callback after checkpoint recording and before selection and paint', () => {
  const order: string[] = [];
  const rendered = renderSheet(
    {
      defaultValue: [{}],
      onChange: () => order.push('change'),
      onCellEdit: () => order.push('cell-edit'),
      onSelectionChange: () => order.push('selection'),
    },
    {
      recordControlledCheckpoint: () => order.push('checkpoint'),
      schedulePaint: () => order.push('paint'),
    },
  );
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;
  const selection: Selection = {
    sheet,
    range: { start: { row: 0, column: 1 }, end: { row: 0, column: 1 } },
    active: { row: 0, column: 1 },
  };

  act(() => {
    rendered.runtime.dispatchUiWithSelection(
      {
        type: 'set-cell-text',
        address: { sheet, row: 0, column: 0 },
        text: 'committed',
      },
      'keyboard',
      selection,
    );
  });

  expect(order).toEqual(['checkpoint', 'change', 'cell-edit', 'selection', 'paint']);
});

it('keeps semantic no-ops silent', () => {
  const onChange = vi.fn();
  const onCellEdit = vi.fn();
  const schedulePaint = vi.fn();
  const rendered = renderSheet(
    { defaultValue: [{}], onChange, onCellEdit },
    { schedulePaint },
  );
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  act(() => {
    rendered.runtime.dispatchUi(
      { type: 'set-cell-text', address: { sheet, row: 0, column: 0 }, text: '' },
      'keyboard',
    );
  });

  expect(onChange).not.toHaveBeenCalled();
  expect(onCellEdit).not.toHaveBeenCalled();
  expect(schedulePaint).not.toHaveBeenCalled();
});

it('reports recoverable UI failures but keeps ref failures synchronous', () => {
  const onError = vi.fn<(error: TegoSheetError) => void>();
  const rendered = renderSheet({ defaultValue: [{}], onError });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;
  const invalid = {
    type: 'set-cell-text' as const,
    address: { sheet, row: -1, column: 0 },
    text: 'invalid',
  };

  act(() => {
    expect(rendered.runtime.dispatchUi(invalid, 'keyboard')).toEqual(
      expect.objectContaining({ status: 'rejected' }),
    );
  });
  expect(onError).toHaveBeenCalledOnce();
  expect(onError.mock.calls[0]![0]).toEqual(
    expect.objectContaining({ code: 'INVALID_COMMAND', recoverable: true }),
  );

  expect(() => rendered.runtime.dispatchRef(invalid, 'ref')).toThrow(TegoSheetException);
  expect(onError).toHaveBeenCalledOnce();
});

it('uses the latest callback props without replacing the dispatcher', () => {
  const first = vi.fn();
  const latest = vi.fn();
  const rendered = renderSheet({ defaultValue: [{}], onChange: first });
  const dispatcher = rendered.runtime.dispatcher;

  rendered.rerenderProps({ defaultValue: [{}], onChange: latest });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;
  act(() => {
    rendered.runtime.dispatchRef(
      { type: 'set-cell-text', address: { sheet, row: 0, column: 0 }, text: 'next' },
      'ref',
    );
  });

  expect(rendered.runtime.dispatcher).toBe(dispatcher);
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
});

it('isolates callback values and updates the external-store snapshot', () => {
  let callbackValue: unknown;
  const rendered = renderSheet({
    defaultValue: [{ name: 'Sheet' }],
    onChange: (value) => {
      callbackValue = value;
      (value as { name?: string }[])[0]!.name = 'Mutated callback';
    },
  });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  act(() => {
    rendered.runtime.dispatchRef(
      { type: 'set-cell-text', address: { sheet, row: 0, column: 0 }, text: 'next' },
      'ref',
    );
  });

  expect(callbackValue).toBeDefined();
  expect(rendered.runtime.epoch.controller.getValue()[0]?.name).toBe('Sheet');
  expect(rendered.container.querySelector('output')?.getAttribute('data-revision')).toBe('1');
});

it('does not swallow exceptions thrown by consumer callbacks', () => {
  const consumerError = new Error('consumer callback failed');
  const rendered = renderSheet({
    defaultValue: [{}],
    onChange: () => {
      throw consumerError;
    },
  });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  expect(() => rendered.runtime.dispatchRef({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'next',
  })).toThrow(consumerError);
});
