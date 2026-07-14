import { describe, expectTypeOf, it } from 'vitest';
import type {
  ActiveSheetChangeEvent,
  CellAddress,
  CellData,
  CellEditEvent,
  CellRange,
  CellStyle,
  FilterDefinition,
  JsonValue,
  LocaleDefinition,
  PasteEvent,
  Selection,
  SheetData,
  SheetOptions,
  SheetTabsRenderProps,
  TegoSheetError,
  ToolbarAction,
  ToolbarRenderProps,
  ValidationIssue,
  ValidationResult,
  ValidationRule,
  WorkbookChange,
  WorkbookData,
  WorkbookInput,
} from '../../src/index';
import type { SheetId } from '../../src/index';

describe('the public type contract', () => {
  it('accepts canonical workbook arrays and permissive single-sheet input', () => {
    const sheet: SheetData = {
      name: '',
      freeze: 'A1',
      styles: [
        {
          format: '',
          bgcolor: '',
          align: 'left',
          valign: 'middle',
          textwrap: false,
          strike: false,
          underline: false,
          color: '',
          font: { name: '', size: 0, bold: false, italic: false, vendorFontId: 7 },
          border: {
            top: ['thin', ''],
            right: ['thin'],
            bottom: ['thin', '#000'],
            left: ['thin'],
            diagonal: false,
          },
          vendorStyle: { enabled: true },
        },
      ],
      merges: [],
      rows: {
        len: 0,
        0: {
          height: 0,
          hide: false,
          style: 0,
          cells: {
            0: {
              text: '',
              style: 0,
              merge: [0, 0],
              editable: false,
              printable: false,
              value: 0,
              cachedBy: 'legacy',
            },
            cellCollectionMetadata: null,
          },
          rowMetadata: ['preserved'],
        },
        rowCollectionMetadata: true,
      },
      cols: {
        len: 0,
        0: { width: 0, hide: false, style: 0, columnMetadata: { pinned: false } },
        columnCollectionMetadata: '',
      },
      validations: [
        {
          refs: ['A1'],
          mode: 'cell',
          type: 'list',
          required: false,
          operator: 'in',
          value: ['red', 'blue'],
          validationMetadata: { source: 'legacy' },
        },
      ],
      autofilter: {
        ref: 'A1:B4',
        filters: [
          {
            ci: 0,
            operator: 'in',
            value: ['open'],
            filterMetadata: false,
          },
        ],
        sort: { ci: 0, order: 'asc', sortMetadata: 0 },
        autofilterMetadata: null,
      },
      vendorSheetData: { nested: [false, 0, '', null] },
    };
    const workbook: WorkbookData = [sheet];
    const singleInput: WorkbookInput = sheet;
    const arrayInput: WorkbookInput = workbook;

    expectTypeOf(workbook).toMatchTypeOf<readonly SheetData[]>();
    expectTypeOf(singleInput).toMatchTypeOf<WorkbookInput>();
    expectTypeOf(arrayInput).toMatchTypeOf<WorkbookInput>();
    expectTypeOf(sheet.name).toEqualTypeOf<string | undefined>();
    expectTypeOf(sheet.vendorSheetData).toMatchTypeOf<JsonValue>();

    // @ts-expect-error canonical workbook output is always an array
    const invalidWorkbook: WorkbookData = sheet;
    // @ts-expect-error workbook arrays are readonly
    workbook.push(sheet);
    // @ts-expect-error sheet properties are readonly
    sheet.name = 'renamed';
    if (sheet.styles?.[0]?.font) {
      // @ts-expect-error nested style objects are readonly
      sheet.styles[0].font.bold = true;
    }
    // @ts-expect-error nested serialized arrays are readonly
    sheet.validations?.[0]?.refs?.push('B2');

    expectTypeOf(invalidWorkbook).toEqualTypeOf<WorkbookData>();
  });

  it('limits extension keys to recursively JSON-compatible values', () => {
    const json: JsonValue = {
      enabled: true,
      count: 0,
      label: '',
      empty: null,
      nested: [{ preserved: 'yes' }],
    };
    const cell: CellData = { text: '', vendor: json };

    expectTypeOf(cell.vendor).toMatchTypeOf<JsonValue>();

    const invalidFunction: SheetData = {
      // @ts-expect-error functions are not JSON-compatible extension values
      vendor: () => undefined,
    };
    const invalidSymbol: SheetData = {
      // @ts-expect-error symbols are not JSON-compatible extension values
      vendor: Symbol('vendor'),
    };
    const invalidUndefined: SheetData = {
      // @ts-expect-error unknown direct keys cannot serialize undefined
      vendor: undefined,
    };

    expectTypeOf(invalidFunction).toEqualTypeOf<SheetData>();
    expectTypeOf(invalidSymbol).toEqualTypeOf<SheetData>();
    expectTypeOf(invalidUndefined).toEqualTypeOf<SheetData>();
  });

  it('uses branded sheet identities and deeply readonly event payloads', () => {
    const sheet = 'sheet-1' as SheetId;
    const address: CellAddress = { sheet, row: 0, column: 0 };
    const range: CellRange = { start: address, end: { row: 2, column: 3 } };
    const selection: Selection = { sheet, range, active: address };
    const change: WorkbookChange = {
      id: 'change-1',
      kind: 'cell',
      source: 'keyboard',
      sheet,
      range,
    };
    const edit: CellEditEvent = {
      changeId: change.id,
      address,
      previousText: '',
      text: 'next',
      source: 'keyboard',
    };
    const paste: PasteEvent = {
      changeId: 'change-2',
      source: 'external',
      target: selection,
      values: [['a', 'b']],
    };
    const activeSheetChange: ActiveSheetChangeEvent = {
      sheet,
      index: 0,
      source: 'sheet-tabs',
    };
    const locale: LocaleDefinition = {
      id: 'en-US',
      messages: { toolbar: { undo: 'Undo' } },
    };

    // @ts-expect-error a plain string is not an opaque SheetId
    const plainSheet: SheetId = 'sheet-1';
    // @ts-expect-error coordinates are readonly
    address.row = 1;
    if (change.range) {
      // @ts-expect-error nested ranges are readonly
      change.range.start.column = 1;
    }
    // @ts-expect-error pasted rows are readonly
    paste.values[0]?.push('c');
    // @ts-expect-error locale messages are recursively readonly
    locale.messages.toolbar = 'Toolbar';

    expectTypeOf(edit).toMatchTypeOf<CellEditEvent>();
    expectTypeOf(activeSheetChange).toMatchTypeOf<ActiveSheetChangeEvent>();
    expectTypeOf(plainSheet).toEqualTypeOf<SheetId>();
  });

  it('accepts only approved validation rules, options, and toolbar actions', () => {
    const sheet = 'sheet-1' as SheetId;
    const rule: ValidationRule = {
      mode: 'cell',
      type: 'number',
      required: false,
      operator: 'be',
      value: ['0', '10'],
    };
    const filter: FilterDefinition = { column: 0, operator: 'in', value: ['', 'open'] };
    const actions: readonly ToolbarAction[] = [
      { type: 'undo' },
      { type: 'redo' },
      { type: 'print' },
      { type: 'paint-format' },
      { type: 'clear-format' },
      { type: 'set-style', patch: { boldVendorFlag: false, font: { bold: true } } },
      { type: 'merge' },
      { type: 'unmerge' },
      { type: 'freeze' },
      { type: 'unfreeze' },
      { type: 'insert-row' },
      { type: 'delete-row' },
      { type: 'hide-row' },
      { type: 'unhide-row' },
      { type: 'insert-column' },
      { type: 'delete-column' },
      { type: 'hide-column' },
      { type: 'unhide-column' },
      { type: 'set-validation', rule },
      { type: 'remove-validation' },
      { type: 'set-filter', filter },
      { type: 'clear-filter' },
      { type: 'sort', order: 'desc' },
    ];
    const options: SheetOptions = {
      showGrid: false,
      showContextMenu: false,
      rows: { initialCount: 0, defaultHeight: 0 },
      columns: { initialCount: 0, defaultWidth: 0, minimumWidth: 0 },
      rowHeaderWidth: 0,
      defaultStyle: { align: 'right' },
      autoFocus: false,
    };
    const toolbarProps: ToolbarRenderProps = {
      selection: null,
      activeStyle: {},
      readOnly: false,
      canUndo: false,
      canRedo: false,
      merged: false,
      frozen: false,
      disabledActions: new Set<ToolbarAction['type']>(),
      execute: () => undefined,
    };
    const tabsProps: SheetTabsRenderProps = {
      sheets: [{ id: sheet, index: 0, name: '' }],
      activeSheet: sheet,
      readOnly: false,
      add: () => undefined,
      delete: () => undefined,
      rename: () => undefined,
      activate: () => undefined,
    };

    expectTypeOf(actions).toMatchTypeOf<readonly ToolbarAction[]>();

    // @ts-expect-error serialized legacy operators do not make invalid command rules legal
    const invalidRule: ValidationRule = { mode: 'cell', type: 'list', required: false, operator: 'in' };
    // @ts-expect-error old action names are not part of the action union
    const invalidAction: ToolbarAction = { type: 'format-bold' };
    // @ts-expect-error sorting requires an approved order
    const invalidSort: ToolbarAction = { type: 'sort', order: 'ascending' };
    const duplicatedToolbarOption: SheetOptions = {
      ...options,
      // @ts-expect-error toolbar composition is a dedicated React prop, not a SheetOption
      toolbar: false,
    };
    const duplicatedTabsOption: SheetOptions = {
      ...options,
      // @ts-expect-error sheet tab composition is a dedicated React prop, not a SheetOption
      sheetTabs: false,
    };
    // @ts-expect-error options are readonly
    options.autoFocus = true;
    // @ts-expect-error filter values are readonly
    filter.value.push('closed');
    const styleAction: ToolbarAction = {
      type: 'set-style',
      patch: { font: { bold: true } },
    };
    if (styleAction.patch.font) {
      // @ts-expect-error nested style patches are readonly
      styleAction.patch.font.bold = false;
    }
    // @ts-expect-error disabled action sets are readonly views
    toolbarProps.disabledActions.add('undo');
    // @ts-expect-error sheet tab arrays are readonly
    tabsProps.sheets.push({ id: sheet, index: 1, name: 'next' });

    expectTypeOf(invalidRule).toEqualTypeOf<ValidationRule>();
    expectTypeOf(invalidAction).toEqualTypeOf<ToolbarAction>();
    expectTypeOf(invalidSort).toEqualTypeOf<ToolbarAction>();
    expectTypeOf(duplicatedToolbarOption).toEqualTypeOf<SheetOptions>();
    expectTypeOf(duplicatedTabsOption).toEqualTypeOf<SheetOptions>();
  });

  it('keeps validation and error results deeply readonly', () => {
    const sheet = 'sheet-1' as SheetId;
    const rule: ValidationRule = { mode: 'cell', type: 'email', required: true };
    const issue: ValidationIssue = {
      sheet,
      sheetIndex: 0,
      address: { sheet, row: 0, column: 0 },
      rule,
      message: '',
    };
    const result: ValidationResult = { valid: false, issues: [issue] };
    const error: TegoSheetError = {
      code: 'INVALID_DATA',
      message: 'Invalid workbook',
      recoverable: false,
      cause: { field: 'rows' },
    };
    const style: CellStyle = { font: { bold: false } };

    // @ts-expect-error validation issues are readonly arrays
    result.issues.push(issue);
    // @ts-expect-error validation issues are readonly
    issue.message = 'changed';
    // @ts-expect-error error payloads are readonly
    error.code = 'INVALID_COMMAND';
    // @ts-expect-error style properties are readonly
    style.font!.bold = true;
  });
});
