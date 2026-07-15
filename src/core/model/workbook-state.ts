import { parseWorkbook } from '../serialization/parse-workbook';
import { serializeWorkbook } from '../serialization/serialize-workbook';
import type { SheetId } from '../types/coordinates';
import type { SheetData, WorkbookData, WorkbookInput } from '../types/workbook';
import { createSheetId } from './sheet-ids';
import type { WorkbookInitializationDefaults } from '../serialization/canonicalize-workbook';

export interface RuntimeSheet {
  readonly id: SheetId;
  readonly data: SheetData;
}

function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      freezeJson((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function runtimeSheets(data: WorkbookData): readonly RuntimeSheet[] {
  return Object.freeze(data.map(sheet => Object.freeze({
    id: createSheetId(),
    data: freezeJson(sheet),
  })));
}

function freezeSheets(sheets: readonly RuntimeSheet[]): readonly RuntimeSheet[] {
  return Object.freeze(sheets.map(sheet => Object.freeze({
    id: sheet.id,
    data: freezeJson(sheet.data),
  })));
}

export class WorkbookState {
  readonly sheets: readonly RuntimeSheet[];
  private readonly defaults: Readonly<WorkbookInitializationDefaults>;

  private constructor(
    sheets: readonly RuntimeSheet[],
    defaults: Readonly<WorkbookInitializationDefaults>,
  ) {
    this.sheets = freezeSheets(sheets);
    this.defaults = Object.freeze({ ...defaults });
    Object.freeze(this);
  }

  static from(
    input: WorkbookInput,
    defaults: Readonly<WorkbookInitializationDefaults> = {},
  ): WorkbookState {
    return new WorkbookState(runtimeSheets(parseWorkbook(input, defaults)), defaults);
  }

  replace(input: WorkbookInput): WorkbookState {
    return WorkbookState.from(input, this.defaults);
  }

  serialize(): WorkbookData {
    return serializeWorkbook(this.sheets.map(sheet => sheet.data));
  }

  get(id: SheetId): RuntimeSheet | null {
    return this.sheets.find(sheet => sheet.id === id) ?? null;
  }

  update(id: SheetId, updater: (sheet: SheetData) => SheetData): WorkbookState {
    const index = this.sheets.findIndex(sheet => sheet.id === id);
    if (index < 0) throw new RangeError(`Unknown sheet ID: ${id}`);
    const current = this.sheets[index] as RuntimeSheet;
    const updated = updater(current.data);
    const data = parseWorkbook([updated])[0] as SheetData;
    const sheets = this.sheets.map((sheet, sheetIndex) => (
      sheetIndex === index ? { id: sheet.id, data } : sheet
    ));
    return new WorkbookState(sheets, this.defaults);
  }

  rename(id: SheetId, name: string): WorkbookState {
    const current = this.get(id);
    if (current === null) throw new RangeError(`Unknown sheet ID: ${id}`);
    if (current.data.name === name) return this;
    return this.update(id, sheet => ({ ...sheet, name }) as unknown as SheetData);
  }

  add(name = `sheet${this.sheets.length + 1}`, id = createSheetId()): WorkbookState {
    if (this.get(id) !== null) throw new RangeError(`Duplicate sheet ID: ${id}`);
    const data = parseWorkbook({ name }, this.defaults)[0] as SheetData;
    return new WorkbookState([...this.sheets, { id, data }], this.defaults);
  }

  delete(id: SheetId): WorkbookState {
    if (this.get(id) === null) throw new RangeError(`Unknown sheet ID: ${id}`);
    return new WorkbookState(this.sheets.filter(sheet => sheet.id !== id), this.defaults);
  }
}
