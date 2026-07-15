import type { WorkbookData, WorkbookInput } from '../types/workbook';
import {
  canonicalizeWorkbook,
  type WorkbookInitializationDefaults,
} from './canonicalize-workbook';

export function parseWorkbook(
  input: WorkbookInput,
  defaults: Readonly<WorkbookInitializationDefaults> = {},
): WorkbookData {
  return canonicalizeWorkbook(input, defaults);
}
