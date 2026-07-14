import type { WorkbookData } from '../types/workbook';
import { canonicalizeWorkbook } from './canonicalize-workbook';

export function serializeWorkbook(workbook: WorkbookData): WorkbookData {
  return canonicalizeWorkbook(workbook);
}
