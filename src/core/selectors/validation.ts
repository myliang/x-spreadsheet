import { parseA1Range } from '../coordinates/ranges';
import { getCellData } from '../model/cells';
import type { SheetId } from '../types/coordinates';
import type { ValidationIssue, ValidationResult } from '../types/validation';
import type { WorkbookData } from '../types/workbook';
import { validateValue, validationDataToRule } from '../operations/validation';

export const MAX_VALIDATION_CELLS = 250_000;

export interface ValidationWorkbookSource {
  getValue(): WorkbookData;
  getSheetIds(): readonly SheetId[];
}

interface OrderedIssue {
  readonly issue: ValidationIssue;
  readonly ruleIndex: number;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) freezeDeep((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

export function validateWorkbook(source: ValidationWorkbookSource): ValidationResult {
  const workbook = source.getValue();
  const sheetIds = source.getSheetIds();
  const issues: OrderedIssue[] = [];
  let inspected = 0;

  workbook.forEach((sheet, sheetIndex) => {
    const sheetId = sheetIds[sheetIndex];
    if (sheetId === undefined) return;
    (sheet.validations ?? []).forEach((data, ruleIndex) => {
      const rule = validationDataToRule(data);
      if (rule === null) return;
      const seen = new Set<string>();
      for (const raw of data.refs ?? []) {
        let range;
        try {
          range = parseA1Range(raw);
        } catch {
          continue;
        }
        const area = (BigInt(range.end.row) - BigInt(range.start.row) + 1n)
          * (BigInt(range.end.column) - BigInt(range.start.column) + 1n);
        inspected += Number(area > BigInt(MAX_VALIDATION_CELLS) ? BigInt(MAX_VALIDATION_CELLS + 1) : area);
        if (inspected > MAX_VALIDATION_CELLS) {
          throw new RangeError(`validation exceeds the ${MAX_VALIDATION_CELLS}-cell inspection limit`);
        }
        for (let row = range.start.row; row <= range.end.row; row += 1) {
          for (let column = range.start.column; column <= range.end.column; column += 1) {
            const key = `${row}:${column}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const outcome = validateValue(getCellData(sheet, row, column)?.text ?? '', rule);
            if (outcome.valid) continue;
            issues.push({
              ruleIndex,
              issue: {
                sheet: sheetId,
                sheetIndex,
                address: { sheet: sheetId, row, column },
                rule,
                message: outcome.message,
              },
            });
          }
        }
      }
    });
  });

  issues.sort((left, right) => (
    left.issue.sheetIndex - right.issue.sheetIndex
    || left.issue.address.row - right.issue.address.row
    || left.issue.address.column - right.issue.address.column
    || left.ruleIndex - right.ruleIndex
  ));
  return freezeDeep({
    valid: issues.length === 0,
    issues: issues.map(entry => entry.issue),
  });
}
