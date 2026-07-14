import { describe, expect, it } from 'vitest';
import { WorkbookController } from '../../../src/core/controller/workbook-controller';
import { validateValue } from '../../../src/core/operations/validation';
import { validateWorkbook } from '../../../src/core/selectors/validation';
import type { Selection, SheetId } from '../../../src/core/types/coordinates';
import type { ValidationRule } from '../../../src/core/types/validation';

const selected = (sheet: SheetId, row = 0, column = 0): Selection => ({
  sheet,
  range: { start: { row, column }, end: { row, column } },
  active: { row, column },
});

describe('validation operations and workbook selector', () => {
  it.each([
    [{ mode: 'cell', type: 'number', required: true, operator: 'be', value: ['1', '10'] }, '5', true],
    [{ mode: 'cell', type: 'number', required: false, operator: 'nbe', value: ['1', '10'] }, '5', false],
    [{ mode: 'cell', type: 'number', required: false, operator: 'eq', value: '3' }, '3', true],
    [{ mode: 'cell', type: 'number', required: false, operator: 'neq', value: '3' }, '3', false],
    [{ mode: 'cell', type: 'number', required: false, operator: 'lt', value: '3' }, '2', true],
    [{ mode: 'cell', type: 'number', required: false, operator: 'lte', value: '3' }, '3', true],
    [{ mode: 'cell', type: 'number', required: false, operator: 'gt', value: '3' }, '4', true],
    [{ mode: 'cell', type: 'number', required: false, operator: 'gte', value: '3' }, '3', true],
    [{ mode: 'cell', type: 'date', required: false, operator: 'lt', value: '2026-01-02' }, '2026-01-01', true],
    [{ mode: 'cell', type: 'list', required: false, value: 'red,blue' }, 'blue', true],
    [{ mode: 'cell', type: 'phone', required: false }, '13812345678', true],
    [{ mode: 'cell', type: 'email', required: false }, 'w@wXw', true],
  ] as const)('supports every validation type/operator %#', (rule, value, valid) => {
    expect(validateValue(value, rule as ValidationRule).valid).toBe(valid);
  });

  it('handles required and malformed typed values deterministically', () => {
    expect(validateValue(' ', { mode: 'cell', type: 'email', required: true }))
      .toMatchObject({ valid: false, message: 'Value is required' });
    expect(validateValue('', { mode: 'cell', type: 'number', required: false }).valid).toBe(true);
    expect(validateValue('12x', { mode: 'cell', type: 'number', required: false }).valid).toBe(true);
    expect(validateValue('not-a-date', { mode: 'cell', type: 'date', required: false }).valid).toBe(true);
    expect(validateValue('1e3', {
      mode: 'cell', type: 'number', required: false, operator: 'eq', value: '1000',
    }).valid).toBe(true);
    expect(validateValue('me@example.com', { mode: 'cell', type: 'email', required: false }).valid)
      .toBe(false);
    expect(validateValue('w@wXw', { mode: 'cell', type: 'email', required: false }).valid).toBe(true);
  });

  it('preserves legacy date identity behavior for all comparison operators', () => {
    const base = { mode: 'cell', type: 'date', required: false, value: '2026-01-01' } as const;
    expect(validateValue('2026-01-01', { ...base, operator: 'eq' }).valid).toBe(false);
    expect(validateValue('2026-01-01', { ...base, operator: 'neq' }).valid).toBe(true);
    expect(validateValue('2025-12-31', { ...base, operator: 'lt' }).valid).toBe(true);
    expect(validateValue('2026-01-01', { ...base, operator: 'lte' }).valid).toBe(true);
    expect(validateValue('2026-01-02', { ...base, operator: 'gt' }).valid).toBe(true);
    expect(validateValue('2026-01-01', { ...base, operator: 'gte' }).valid).toBe(true);
    expect(validateValue('2026-01-01', {
      ...base, operator: 'be', value: ['2025-01-01', '2027-01-01'],
    }).valid).toBe(true);
    expect(validateValue('2026-01-01', {
      ...base, operator: 'nbe', value: ['2025-01-01', '2027-01-01'],
    }).valid).toBe(false);
  });

  it('keeps legacy nbe invalid-number and invalid-date comparisons false', () => {
    expect(validateValue('not-a-number', {
      mode: 'cell', type: 'number', required: false, operator: 'nbe', value: ['1', '10'],
    }).valid).toBe(false);
    expect(validateValue('not-a-date', {
      mode: 'cell', type: 'date', required: false, operator: 'nbe',
      value: ['2025-01-01', '2027-01-01'],
    }).valid).toBe(false);
  });

  it('sets and removes serialized validation refs without disturbing non-overlapping rules', () => {
    const controller = new WorkbookController({
      rows: { len: 3 }, cols: { len: 3 },
      validations: [{ refs: ['C3'], mode: 'cell', type: 'email', required: false, vendor: 1 }],
    });
    const sheet = controller.getSheetIds()[0]!;
    const rule: ValidationRule = {
      mode: 'cell', type: 'number', required: true, operator: 'gte', value: '0',
    };

    expect(controller.dispatch({ type: 'set-validation', selection: selected(sheet), rule }, 'toolbar'))
      .toMatchObject({ status: 'committed', commit: { change: { kind: 'validation' } } });
    expect(controller.getValue()[0]!.validations).toEqual([
      { refs: ['C3'], mode: 'cell', type: 'email', required: false, vendor: 1 },
      { refs: ['A1'], mode: 'cell', type: 'number', required: true, operator: 'gte', value: '0' },
    ]);
    expect(controller.dispatch({
      type: 'remove-validation', selection: selected(sheet),
    }, 'toolbar').status).toBe('committed');
    expect(controller.getValue()[0]!.validations).toEqual([
      { refs: ['C3'], mode: 'cell', type: 'email', required: false, vendor: 1 },
    ]);
  });

  it('allows validation metadata changes over locked cells while controller read-only still rejects', () => {
    const controller = new WorkbookController({
      rows: { len: 2, 0: { cells: { 0: { text: 'locked', editable: false } } } },
      cols: { len: 2 },
    });
    const sheet = controller.getSheetIds()[0]!;
    expect(controller.dispatch({
      type: 'set-validation',
      selection: selected(sheet),
      rule: { mode: 'cell', type: 'number', required: true },
    }, 'toolbar').status).toBe('committed');
    expect(controller.dispatch({ type: 'remove-validation', selection: selected(sheet) }, 'toolbar').status)
      .toBe('committed');

    controller.setReadOnly(true);
    expect(() => controller.dispatch({
      type: 'set-validation', selection: selected(sheet),
      rule: { mode: 'cell', type: 'number', required: true },
    }, 'toolbar')).toThrowError(expect.objectContaining({ code: 'INVALID_COMMAND' }));
    expect(controller.historySize.undo).toBe(2);
  });

  it('merges refs only for the first equal validator and preserves overlapping different rules', () => {
    const controller = new WorkbookController({
      rows: { len: 4 }, cols: { len: 4 },
      validations: [
        {
          refs: ['A1:A2'], mode: 'cell', type: 'number', required: true,
          operator: 'gte', value: '0', vendorSame: false,
        },
        { refs: ['A1:C1'], mode: 'cell', type: 'email', required: true, vendorOther: 0 },
      ],
    });
    const sheet = controller.getSheetIds()[0]!;
    const range: Selection = {
      sheet,
      range: { start: { row: 0, column: 1 }, end: { row: 1, column: 1 } },
      active: { row: 0, column: 1 },
    };
    controller.dispatch({
      type: 'set-validation', selection: range,
      rule: { mode: 'cell', type: 'number', required: true, operator: 'gte', value: '0' },
    }, 'toolbar');

    expect(controller.getValue()[0]!.validations).toEqual([
      {
        refs: ['A1:A2', 'B1:B2'], mode: 'cell', type: 'number', required: true,
        operator: 'gte', value: '0', vendorSame: false,
      },
      { refs: ['A1:C1'], mode: 'cell', type: 'email', required: true, vendorOther: 0 },
    ]);
    expect(controller.validate().issues.map(issue => [issue.address.row, issue.address.column, issue.rule.type]))
      .toEqual([
        [0, 0, 'number'], [0, 0, 'email'],
        [0, 1, 'number'], [0, 1, 'email'],
        [0, 2, 'email'], [1, 0, 'number'], [1, 1, 'number'],
      ]);
  });

  it('@parity:tools.validation-all-sheets validates hidden cells on every sheet in sheet/row/column/rule order', () => {
    const controller = new WorkbookController([
      {
        name: 'First',
        rows: { len: 3, 1: { hide: true, cells: { 1: { text: 'bad' } } } },
        cols: { len: 3, 1: { hide: true } },
        validations: [
          { refs: ['B2'], mode: 'cell', type: 'number', required: true, operator: 'gte', value: 0 },
          { refs: ['B2'], mode: 'cell', type: 'email', required: true },
          { refs: ['A1'], mode: 'cell', type: 'number', required: true },
        ],
      },
      {
        name: 'Second',
        rows: { len: 2, 0: { cells: { 0: { text: '' } } } },
        cols: { len: 2 },
        validations: [{ refs: ['A1'], mode: 'cell', type: 'list', required: true, value: ['yes'] }],
      },
    ]);

    const result = controller.validate();
    expect(validateWorkbook(controller)).toEqual(result);
    expect(result.valid).toBe(false);
    expect(result.issues.map(issue => [
      issue.sheetIndex, issue.address.row, issue.address.column, issue.rule.type,
    ])).toEqual([
      [0, 0, 0, 'number'],
      [0, 1, 1, 'number'],
      [0, 1, 1, 'email'],
      [1, 0, 0, 'list'],
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.issues)).toBe(true);
  });

  it('@parity:correction.validation-all-sheets inspects sheets added after the initial sheet', () => {
    const controller = new WorkbookController([
      { name: 'Initial', rows: { len: 1 }, cols: { len: 1 } },
      {
        name: 'Later',
        rows: { len: 1 },
        cols: { len: 1 },
        validations: [{ refs: ['A1'], mode: 'cell', type: 'email', required: true }],
      },
    ]);

    expect(controller.validate().issues).toHaveLength(1);
    expect(controller.validate().issues[0]).toMatchObject({ sheetIndex: 1, address: { row: 0, column: 0 } });
  });
});
