import { serializeWorkbook } from '../serialization/serialize-workbook';
import type { SheetId } from '../types/coordinates';
import type { SheetData, WorkbookData } from '../types/workbook';
import type { RuntimeSheet } from '../model/workbook-state';
import { WorkbookState } from '../model/workbook-state';

export function selectWorkbookData(state: WorkbookState): WorkbookData {
  return state.serialize();
}

export function selectRuntimeSheet(state: WorkbookState, id: SheetId): RuntimeSheet | null {
  return state.get(id);
}

export function selectSheetData(state: WorkbookState, id: SheetId): SheetData | null {
  const sheet = state.get(id);
  return sheet === null ? null : serializeWorkbook([sheet.data])[0] as SheetData;
}
