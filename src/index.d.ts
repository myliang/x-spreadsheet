declare module 'poly-spreadsheet' {
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
    cellsStyles?: CellStyle[]
  }

  export type CELL_SELECTED = 'cell-selected';
  export type CELLS_SELECTED = 'cells-selected';
  export type CELL_EDITED = 'cell-edited';
  export type CHANGE_SHEET_INDEX = 'changeSheetIndex';
  export type PASTE = 'paste';

  export type CellMerge = [number, number];

  export interface SpreadsheetEventHandler {
    (
      event: CELL_SELECTED,
      callback: (cell: Cell, rowIndex: number, colIndex: number) => void
    ): void;
    (
      event: CELLS_SELECTED,
      callback: (
        cell: Cell,
        parameters: { sri: number; sci: number; eri: number; eci: number }
      ) => void
    ): void;
    (
      event: CELL_EDITED,
      callback: (text: string, rowIndex: number, colIndex: number) => void
    ): void;
    (
      event: CHANGE_SHEET_INDEX,
      callback: (index: number) => void
    ): void;
    (
      event: PASTE,
      callback: (paste: boolean) => void
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
  export interface Cell {text?: string, merge?: CellMerge, editable?: boolean}
  export interface Sheet {}

  export default class Spreadsheet {
    constructor(container: string | HTMLElement, opts?: Options);
    on: SpreadsheetEventHandler;
    /**
     * retrieve cell
     * @param rowIndex {number} row index
     * @param colIndex {number} column index
     * @param sheetIndex {number} sheet iindex
     */
    cell(rowIndex: number, colIndex: number, sheetIndex: number): Cell;
    /**
     * retrieve cell style
     * @param rowIndex
     * @param colIndex
     * @param sheetIndex
     */
    cellStyle(
      rowIndex: number,
      colIndex: number,
      sheetIndex: number
    ): CellStyle;
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
     * remove current sheet
     */
    deleteSheet(): void;

    /**s
     * load data
     * @param json
     */
    loadData(json: Record<string, any>): this;

    /**
     * string at
     */
    stringAt: string;

    /**
     * rows length
     */
    rowsLength: number;

    /**
     * cols length
     */
    colsLength: number;

    /**
     * insert row or column
     */
    insert(type: 'row' | 'column' ,n: number): void;

    /**
     * insert row below
     */
    insertRow(n: number): void;

    /**
     * insert column right
     */
    insertColumn(n: number): void;

    /**
     * select cell
     */
    selectCell(sri: number, sci: number): void;

    /**
     * expr2xy
     */
    expr2xy(str: string): any;

    /**
     * xy2expr
     * @param x
     * @param y
     */
    xy2expr(x, y): string

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
     * bind handler to change sheet index event
     * @param callback
     */
    changeSheetIndex(callback: (index: number) => void): this;

    /**
     * set locale
     * @param lang
     * @param message
     */
    static locale(lang: string, message: object): void;
  }
  global {
    interface Window {
      x_spreadsheet(container: string | HTMLElement, opts?: Options): Spreadsheet;
    }
  }
}

