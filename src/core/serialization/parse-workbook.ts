import type { WorkbookData, WorkbookInput } from '../types/workbook';
import { canonicalizeWorkbook } from './canonicalize-workbook';

export function parseWorkbook(input: WorkbookInput): WorkbookData {
  return canonicalizeWorkbook(input);
}
