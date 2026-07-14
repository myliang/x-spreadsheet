import type { WorkbookInput } from '../types/workbook';
import { canonicalKey } from './canonicalize-workbook';

export function semanticEqual(left: WorkbookInput, right: WorkbookInput): boolean {
  return canonicalKey(left) === canonicalKey(right);
}
