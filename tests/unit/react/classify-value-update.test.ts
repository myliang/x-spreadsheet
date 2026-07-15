import { describe, expect, it } from 'vitest';
import { TegoSheetException, type WorkbookInput } from '../../../src/core';
import { classifyValueUpdate } from '../../../src/react/control/classify-value-update';

describe('classifyValueUpdate', () => {
  it('preserves the canonicalization exception and its original cause for invalid values', () => {
    const update = classifyValueUpdate({
      observedValue: null,
      acknowledgedKey: '[]',
      pending: [],
    }, { rows: { len: -1 } } as unknown as WorkbookInput);

    expect(update.kind).toBe('invalid');
    if (update.kind !== 'invalid') return;
    expect(update.error).toMatchObject({
      code: 'INVALID_DATA',
      recoverable: true,
      cause: expect.any(TegoSheetException),
    });
    expect((update.error.cause as TegoSheetException).cause).toMatchObject({
      message: expect.stringContaining('rows.len'),
    });
  });
});
