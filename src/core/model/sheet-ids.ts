import type { SheetId } from '../types/coordinates';
import { sheetId } from '../types/coordinates';

let nextSheetId = 1;

export function createSheetId(): SheetId {
  const value = nextSheetId;
  nextSheetId += 1;
  return sheetId(`tego-sheet-${value.toString(36)}`);
}
