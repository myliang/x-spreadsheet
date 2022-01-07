declare module '@bergfreunde/x-data-spreadsheet' {
  export interface ExtendToolbarOption {
    tip?: string;
    el?: HTMLElement;
    icon?: string;
    onClick?: (data: object, sheet: object) => void
  }
  export interface Options {
    mode?: 'edit' | 'read';
    showToolbar?: boolean;
    showGrid?: boolean;
    showContextmenu?: boolean;
    showBottomBar?: boolean;
    extendToolbar?: {
      left?: ExtendToolbarOption[],
      right?: ExtendToolbarOption[],
    };
    autoFocus?: boolean;
    view?: {
      height: () => number;
      width: () => number;
    };
    row?: {
      len: number;
      height: number;
    };
    col?: {
      len: number;
      width: number;
      indexWidth: number;
      minWidth: number;
    };
    style?: {
      bgcolor: string;
      align: 'left' | 'center' | 'right';
      valign: 'top' | 'middle' | 'bottom';
      textwrap: boolean;
      strike: boolean;
      underline: boolean;
      color: string;
      font: {
        name: 'Helvetica';
        size: number;
        bold: boolean;
        italic: false;
      };
    };
  }

  export type CELL_SELECTED = 'cell-selected';
  export type CELLS_SELECTED = 'cells-selected';
  export type CELL_EDITED = 'cell-edited';

  export type CellMerge = [number, number];

  export interface SpreadsheetEventHandler {
    (
      envt: CELL_SELECTED,
      callback: (cell: Cell, rowIndex: number, colIndex: number) => void
    ): void;
    (
      envt: CELLS_SELECTED,
      callback: (
        cell: Cell,
        parameters: { sri: number; sci: number; eri: number; eci: number }
      ) => void
    ): void;
    (
      evnt: CELL_EDITED,
      callback: (text: string, rowIndex: number, colIndex: number) => void
    ): void;
  }

  export interface ColProperties {
    width?: number;
  }

  /**
   * Data for representing a cell
   */
  export interface CellData {
    text: string;
    style?: number;
    merge?: CellMerge;
  }
  /**
   * Data for representing a row
   */
  export interface RowData {
    cells: {
      [key: number]: CellData;
    }
  }

  /**
   * Data for representing a sheet
   */
  export interface SheetData {
    name?: string;
    freeze?: string;
    styles?: CellStyle[];
    merges?: string[];
    cols?: {
      len?: number;
      [key: number]: ColProperties;
    };
    rows?: {
      [key: number]: RowData
    };
  }

  /**
   * Data for representing a spreadsheet
   */
  export interface SpreadsheetData {
    [index: number]: SheetData;
  }

  export interface CellStyle {
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    font?: {
      bold?: boolean;
    }
    bgcolor?: string;
    textwrap?: boolean;
    color?: string;
    border?: {
      top?: string[];
      right?: string[];
      bottom?: string[];
      left?: string[];
    };
  }
  export interface Editor {}
  export interface Element {}

  export interface Row {}
  export interface Table {}
  export interface Cell {
    text: string;
    style: number;
  }

  export interface Sheet {}

  export class DataProxy {
    constructor(name: string, settings: Options);
    undo(): void;
    redo(): void;
    copy(): void;
    clearClipboard(): void;
    cut(): void;
    paste(mode: 'all' | 'text' | 'format', cb?: () => void): void;
    pasteFromText(text: string): { rlen: number, clen: number };
    clearClipboard(): void;
    setCellStyle(rowIndex: number, colIndex: number, style: CellStyle): void;
    // TODO add type for missing methods in this class
  }

  export default class Spreadsheet {
    constructor(container: string | HTMLElement, opts?: Options);
    on: SpreadsheetEventHandler;
    /**
     * retrieve cell
     * @param rowIndex {number} row index
     * @param colIndex {number} column index
     * @param sheetIndex {number} sheet iindex
     */
    cell(rowIndex: number, colIndex: number, sheetIndex?: number): Cell;
    /**
     * retrieve cell style
     * @param rowIndex
     * @param colIndex
     * @param sheetIndex
     */
    cellStyle(
      rowIndex: number,
      colIndex: number,
      sheetIndex?: number
    ): CellStyle;

    /**
     * set cell style
     * @param rowIndex
     * @param colIndex
     * @param style
     * @param sheetIndex
     * @param reRender
     */
     setCellStyle(
      rowIndex: number,
      colIndex: number,
      style: CellStyle,
      sheetIndex?: number,
      reRender?: boolean
    ): void;

    /**
     * reset cell style
     * @param startRowIndex
     * @param startColIndex
     * @param endRowIndex
     * @param endColIndex
     * @param style
     * @param sheetIndex
     * @param reRender
     */
    resetCellStyle(
      startRowIndex: number,
      startColIndex: number,
      endRowIndex: number,
      endColIndex: number,
      style: CellStyle,
      sheetIndex?: number,
      reRender?: boolean
    ): void;

    /**
     * set cell style
     * @param rowIndex
     * @param colIndex
     * @param options
     * @param sheetIndex
     * @param reRender
     */
     highlightCell(
      rowIndex: number,
      colIndex: number,
      options?: { error: boolean, color?: never } | { color: string, error?: never },
      sheetIndex?: number,
      reRender?: boolean
    ): void;

    /**
     * get/set cell text
     * @param rowIndex
     * @param colIndex
     * @param text
     * @param sheetIndex
     */
    cellText(
      rowIndex: number,
      colIndex: number,
      text: string,
      sheetIndex?: number
    ): this;

    /**
     * reset cell text
     * @param startRowIndex
     * @param startColIndex
     * @param endRowIndex
     * @param endColIndex
     * @param style
     * @param sheetIndex
     * @param reRender
     */
    resetCellText(
      startRowIndex: number,
      startColIndex: number,
      endRowIndex: number,
      endColIndex: number,
      style: CellStyle,
      sheetIndex?: number,
      reRender?: boolean
    ): void;

    /**
     * add new sheet
     * @param name {string}
     * @param active {boolean}
     */
    addSheet(
      name: string,
      active?: boolean,
    ): DataProxy;

    addSheet(): DataProxy;

    /**
     * remove current sheet
     */
    deleteSheet(): void;

    /**s
     * load data
     * @param json
     */
    loadData(json: Record<string, any>): this;

    /**
     * get data
     */
    getData(): Record<string, any>;

    /**
     * bind handler to change event, including data change and user actions
     * @param callback
     */
    change(callback: (json: Record<string, any>) => void): this;

    /**
     * validate date
     */
    validate(): boolean;

    /**
     * rerender sheet
     */
    reRender(): this;

    static getInstance(container: string | HTMLElement, opts?: Options): Spreadsheet;

    /**
     * set locale
     * @param lang
     * @param message
     */
    static locale(lang: string, message: object): void;
  }
  
  export function spreadsheet(container: string | HTMLElement, opts?: Options): Spreadsheet
}
