# tego-sheet

`tego-sheet` is a React, TypeScript, and Canvas spreadsheet component. It keeps the sparse workbook JSON used by x-data-spreadsheet while replacing the constructor, global locale registry, and event emitter with a React-only API.

## Install

```sh
npm install tego-sheet react react-dom
```

Import the component and its explicitly exported stylesheet:

```tsx
import { TegoSheet } from 'tego-sheet';
import 'tego-sheet/styles.css';

export function Workbook() {
  return <TegoSheet defaultValue={[]} />;
}
```

## Uncontrolled and controlled workbooks

`defaultValue` initializes an uncontrolled workbook. The component then owns edits; `onChange` still receives an isolated workbook and typed change metadata.

```tsx
import { TegoSheet, type WorkbookData } from 'tego-sheet';

const initial: WorkbookData = [{
  name: 'Budget',
  rows: { 0: { cells: { 0: { text: 'Item' }, 1: { text: 'Amount' } } } },
}];

export function Uncontrolled() {
  return <TegoSheet defaultValue={initial} onChange={(next, change) => {
    console.log(change.kind, next);
  }} />;
}
```

Use `value` when the parent owns the accepted workbook. Keep the same `value` reference for unrelated renders; supply a new value to accept, reject, or replace optimistic edits.

```tsx
import { useState } from 'react';
import { TegoSheet, type WorkbookData } from 'tego-sheet';

export function Controlled() {
  const [value, setValue] = useState<WorkbookData>([]);
  return <TegoSheet value={value} onChange={setValue} />;
}
```

Do not pass both `value` and `defaultValue`, and do not switch modes after mount.

## Callbacks and ref commands

The public callbacks are `onChange`, `onActiveSheetChange`, `onSelectionChange`, `onCellEdit`, `onPaste`, and `onError`. They observe committed state; failed commands do not produce success callbacks.

`TegoSheetHandle` exposes `focus`, `getValue`, `getCell`, `getCellStyle`, `setCellText`, sheet add/delete/rename/activate commands, `undo`, `redo`, `validate`, `print`, and `recalculateLayout`. It never exposes the controller, Canvas engine, or mutable internal objects. Synchronous programmer-contract failures are instances of the public `TegoSheetException` class; recoverable browser failures use `onError`.

```tsx
import { useRef } from 'react';
import { TegoSheet, type TegoSheetHandle } from 'tego-sheet';

export function WithRef() {
  const sheet = useRef<TegoSheetHandle>(null);
  return <>
    <button onClick={() => sheet.current?.undo()}>Undo</button>
    <TegoSheet ref={sheet} defaultValue={[]} onCellEdit={event => console.log(event.text)} />
  </>;
}
```

## Toolbar and sheet-tab slots

Set `toolbar` or `sheetTabs` to `false` to hide that region, use the default by omitting the prop, or pass a typed renderer. Slot renderers receive a read-only view model and typed actions, never implementation objects.

```tsx
import { TegoSheet, type ToolbarRenderer } from 'tego-sheet';

const toolbar: ToolbarRenderer = state => (
  <button disabled={!state.canUndo} onClick={() => state.execute({ type: 'undo' })}>
    Undo
  </button>
);

export function CustomChrome() {
  return <TegoSheet defaultValue={[]} toolbar={toolbar} sheetTabs={false} />;
}
```

## Locales

Locales are isolated per component. Import only the dictionary you use; English remains the recursive fallback for partial custom messages.

```tsx
import { TegoSheet } from 'tego-sheet';
import { zhCN } from 'tego-sheet/locales/zh-cn';

export function ChineseWorkbook() {
  return <TegoSheet defaultValue={[]} locale={zhCN} />;
}
```

The public locale subpaths are `tego-sheet/locales/en`, `/de`, `/nl`, and `/zh-cn`. No aggregate locale entry or internal source subpath is public.

## Legacy workbook JSON

Existing sparse sheet, row, column, cell, style, merge, validation, filter, and extension-key data can be passed directly through `value` or `defaultValue`. `getValue()` and `onChange` return the compatible serialized shape. Runtime `SheetId` values are opaque UI identities and are never added to the JSON.

See [Migration from x-data-spreadsheet](docs/migration-from-x-data-spreadsheet.md) for option mappings, the five intentional correctness fixes, and removal of the old imperative API.
