import type {
  JsonExtensible,
  JsonValue,
  SparseJsonCollection,
} from './json';

export type HorizontalAlign = 'left' | 'center' | 'right';

export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type BorderLine = readonly [style: string, color?: string];

export type FontStyle = JsonExtensible<{
  readonly name?: string;
  readonly size?: number;
  readonly bold?: boolean;
  readonly italic?: boolean;
}>;

export type CellBorders = JsonExtensible<{
  readonly top?: BorderLine;
  readonly right?: BorderLine;
  readonly bottom?: BorderLine;
  readonly left?: BorderLine;
}>;

export type CellStyle = JsonExtensible<{
  readonly format?: string;
  readonly bgcolor?: string;
  readonly align?: HorizontalAlign;
  readonly valign?: VerticalAlign;
  readonly textwrap?: boolean;
  readonly strike?: boolean;
  readonly underline?: boolean;
  readonly color?: string;
  readonly font?: FontStyle;
  readonly border?: CellBorders;
}>;

export type CellData = JsonExtensible<{
  readonly text?: string;
  readonly style?: number;
  readonly merge?: readonly [rowSpan: number, columnSpan: number];
  readonly editable?: boolean;
  readonly printable?: boolean;
  readonly value?: JsonValue;
}>;

export type CellsData = SparseJsonCollection<CellData>;

export type RowData = JsonExtensible<{
  readonly height?: number;
  readonly hide?: boolean;
  readonly style?: number;
  readonly cells?: CellsData;
}>;

export type RowsData = SparseJsonCollection<RowData, {
  readonly len?: number;
}>;

export type ColumnData = JsonExtensible<{
  readonly width?: number;
  readonly hide?: boolean;
  readonly style?: number;
}>;

export type ColsData = SparseJsonCollection<ColumnData, {
  readonly len?: number;
}>;

export type ValidationData = JsonExtensible<{
  readonly refs?: readonly string[];
  readonly mode?: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly operator?: string;
  readonly value?: JsonValue;
}>;

export type AutoFilterItemData = JsonExtensible<{
  readonly ci?: number;
  readonly operator?: string;
  readonly value?: JsonValue;
}>;

export type AutoFilterSortData = JsonExtensible<{
  readonly ci?: number;
  readonly order?: string;
}>;

export type AutoFilterData = JsonExtensible<{
  readonly ref?: string;
  readonly filters?: readonly AutoFilterItemData[];
  readonly sort?: AutoFilterSortData;
}>;

export type SheetData = JsonExtensible<{
  readonly name?: string;
  readonly freeze?: string;
  readonly styles?: readonly CellStyle[];
  readonly merges?: readonly string[];
  readonly rows?: RowsData;
  readonly cols?: ColsData;
  readonly validations?: readonly ValidationData[];
  readonly autofilter?: AutoFilterData;
}>;

export type WorkbookData = readonly SheetData[];

export type WorkbookInput = SheetData | WorkbookData;
