import { act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {
  TegoSheetException,
  type Selection,
  type TegoSheetError,
  type WorkbookInput,
} from '../../src/core';
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

it('does not convert a consumer TegoSheetException into a UI command failure', () => {
  const consumerError = new TegoSheetException({
    code: 'RENDER_FAILED',
    message: 'consumer exception',
    recoverable: true,
  });
  const onError = vi.fn();
  const rendered = renderSheet({
    defaultValue: [{}],
    onChange: () => {
      throw consumerError;
    },
    onError,
  });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  expect(() => rendered.runtime.dispatchUi({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'committed before callback',
  }, 'keyboard')).toThrow(consumerError);
  expect(onError).not.toHaveBeenCalled();
  expect(rendered.runtime.epoch.controller.getCellText({ sheet, row: 0, column: 0 })).toBe(
    'committed before callback',
  );
});

it('does not pre-read internal paste metadata without an onPaste callback', () => {
  const rendered = renderSheet({ defaultValue: [{
    rows: {
      len: 4,
      0: { cells: { 0: { text: 'source' } } },
    },
    cols: { len: 2 },
  }] });
  const controller = rendered.runtime.epoch.controller;
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;
  const getCellText = vi.spyOn(controller, 'getCellText');
  const source: Selection = {
    sheet,
    range: { start: { row: 0, column: 0 }, end: { row: 0, column: 0 } },
    active: { row: 0, column: 0 },
  };
  const target: Selection = {
    sheet,
    range: { start: { row: 2, column: 0 }, end: { row: 2, column: 0 } },
    active: { row: 2, column: 0 },
  };

  act(() => {
    rendered.runtime.dispatchUi({
      type: 'paste-internal', source, target, mode: 'all', cut: false,
    }, 'clipboard');
  });

  expect(getCellText).not.toHaveBeenCalled();
});

it.each([
  { endRow: 250_000, rowCount: 300_002, label: '250001 cells' },
  {
    endRow: Number.MAX_SAFE_INTEGER,
    rowCount: Number.MAX_SAFE_INTEGER,
    label: 'MAX_SAFE coordinates',
  },
])('rejects an oversized internal paste before expanding $label metadata', ({
  endRow,
  rowCount,
}) => {
  const rendered = renderSheet({ defaultValue: [{
    rows: { len: rowCount },
    cols: { len: 1 },
  }], onPaste: vi.fn() });
  const controller = rendered.runtime.epoch.controller;
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;
  const getCellText = vi.spyOn(controller, 'getCellText');
  const source: Selection = {
    sheet,
    range: { start: { row: 0, column: 0 }, end: { row: endRow, column: 0 } },
    active: { row: 0, column: 0 },
  };

  const result = rendered.runtime.dispatchUi({
    type: 'paste-internal', source, target: source, mode: 'all', cut: false,
  }, 'clipboard');

  expect(result.status).toBe('rejected');
  expect(getCellText).not.toHaveBeenCalled();
});

it('uses the committed affected range and pre-cut values for paste callbacks', () => {
  const onPaste = vi.fn();
  const rendered = renderSheet({ defaultValue: [{
    rows: {
      len: 8,
      0: { cells: { 0: { text: 'a' }, 1: { text: 'b' } } },
      1: { cells: { 0: { text: 'c' }, 1: { text: 'd' } } },
    },
    cols: { len: 4 },
  }], onPaste });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;
  const source: Selection = {
    sheet,
    range: { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } },
    active: { row: 0, column: 0 },
  };
  const target: Selection = {
    sheet,
    range: { start: { row: 3, column: 0 }, end: { row: 3, column: 0 } },
    active: { row: 3, column: 0 },
  };

  act(() => {
    rendered.runtime.dispatchUi({
      type: 'paste-internal', source, target, mode: 'all', cut: true,
    }, 'clipboard');
  });
  expect(onPaste.mock.calls[0]![0]).toMatchObject({
    values: [['a', 'b'], ['c', 'd']],
    target: {
      sheet,
      range: { start: { row: 3, column: 0 }, end: { row: 4, column: 1 } },
      active: { row: 3, column: 0 },
    },
  });

  act(() => {
    rendered.runtime.dispatchUi({
      type: 'paste-external',
      target: {
        sheet,
        range: { start: { row: 5, column: 0 }, end: { row: 5, column: 0 } },
        active: { row: 5, column: 0 },
      },
      values: [['1', '2'], ['3', '4']],
    }, 'clipboard');
  });
  expect(onPaste.mock.calls[1]![0].target).toEqual({
    sheet,
    range: { start: { row: 5, column: 0 }, end: { row: 6, column: 1 } },
    active: { row: 5, column: 0 },
  });
});

it('preserves dangerous JSON keys in isolated callback payloads without prototype pollution', () => {
  const input = JSON.parse('[{"name":"Safe","__proto__":{"polluted":true},"constructor":{"tag":"input"}}]') as WorkbookInput;
  let received: unknown;
  const rendered = renderSheet({
    defaultValue: input,
    onChange: value => {
      received = value;
      const sheet = value[0] as unknown as Record<string, unknown>;
      (sheet.__proto__ as Record<string, unknown>).polluted = false;
      (sheet.constructor as unknown as Record<string, unknown>).tag = 'callback';
    },
  });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  act(() => {
    rendered.runtime.dispatchRef({
      type: 'set-cell-text',
      address: { sheet, row: 0, column: 0 },
      text: 'next',
    });
  });

  const payloadSheet = (received as Record<string, unknown>[])[0]!;
  expect(Object.hasOwn(payloadSheet, '__proto__')).toBe(true);
  expect(Object.hasOwn(payloadSheet, 'constructor')).toBe(true);
  expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  const controllerSheet = rendered.runtime.epoch.controller.getValue()[0] as Record<string, unknown>;
  expect((controllerSheet.__proto__ as Record<string, unknown>).polluted).toBe(true);
  expect((controllerSheet.constructor as unknown as Record<string, unknown>).tag).toBe('input');
});

it('clones cyclic Error and DOMException causes without recursion failure', () => {
  const onError = vi.fn();
  const rendered = renderSheet({ defaultValue: [], onError });
  const cause = new Error('cyclic cause');
  Object.defineProperty(cause, 'cause', { enumerable: true, value: cause });

  expect(() => rendered.runtime.dispatcher.reportUiError({
    code: 'RENDER_FAILED',
    message: 'render failed',
    recoverable: true,
    cause,
  })).not.toThrow();
  const clonedCause = onError.mock.calls[0]![0].cause as Error & { cause: unknown };
  expect(clonedCause).not.toBe(cause);
  expect(clonedCause).toMatchObject({ name: 'Error', message: 'cyclic cause' });
  expect(clonedCause.cause).toBe(clonedCause);

  const domCause = new DOMException('clipboard blocked', 'NotAllowedError');
  rendered.runtime.dispatcher.reportUiError({
    code: 'CLIPBOARD_DENIED',
    message: 'denied',
    recoverable: true,
    cause: domCause,
  });
  const clonedDomCause = onError.mock.calls[1]![0].cause as DOMException;
  expect(clonedDomCause).not.toBe(domCause);
  expect(clonedDomCause.name).toBe('NotAllowedError');
  expect(clonedDomCause.message).toBe('clipboard blocked');
});
