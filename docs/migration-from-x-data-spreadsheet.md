# Migration from x-data-spreadsheet

`tego-sheet` preserves supported workbook JSON and spreadsheet behavior, but intentionally provides a new React-only integration surface. Migrate application integration; do not rewrite stored workbook data.

## Replace construction and events

The old `new Spreadsheet(element, options)` constructor and `x_spreadsheet(...)` global do not exist. Render `<TegoSheet>` in React and import `tego-sheet/styles.css`. The old `.on(...)` emitter and string event names do not exist either; use typed props such as `onChange`, `onCellEdit`, `onPaste`, `onSelectionChange`, `onActiveSheetChange`, and `onError`.

```tsx
import { TegoSheet, type WorkbookData, type WorkbookInput } from 'tego-sheet';
import 'tego-sheet/styles.css';

interface EditorProps {
  legacyJson: WorkbookInput;
  saveWorkbook(value: WorkbookData): void;
}

export function Editor({ legacyJson, saveWorkbook }: EditorProps) {
  return <TegoSheet defaultValue={legacyJson} onChange={saveWorkbook} />;
}
```

There is no public controller, renderer, `DataProxy`, mutable sheet object, global locale mutation, or internal emitter.

## Choose one ownership mode

- Uncontrolled: pass `defaultValue`; use `onChange` for persistence and a `TegoSheetHandle` ref for queries or commands.
- Controlled: pass `value` and accept the next workbook from `onChange`. Keep the current object reference during unrelated parent renders.
- Never pass both props or switch modes after mount.

The input and callback payloads remain isolated from internal state. `getValue()` returns compatible sparse workbook JSON. Unknown JSON-compatible extension keys are preserved recursively through unrelated edits, history, and export.

## Map UI options to React props

| Legacy option or integration | React API |
| --- | --- |
| `showToolbar: false` | `toolbar={false}` |
| custom toolbar DOM | `toolbar={renderer}` with typed `ToolbarRenderProps` |
| `showBottomBar: false` | `sheetTabs={false}` |
| custom sheet-tab DOM | `sheetTabs={renderer}` with typed `SheetTabsRenderProps` |
| `mode: 'read'` | `readOnly` |
| global locale registration | `locale={definition}` on each component |
| imperative load | controlled `value`, or remount an uncontrolled component with a new `key` and `defaultValue` |
| imperative data export | `ref.current.getValue()` or the `onChange` value |
| resize callbacks | size the container and call `recalculateLayout()` when needed |

Import bundled dictionaries from their explicit paths:

```tsx
import { de } from 'tego-sheet/locales/de';
import { en } from 'tego-sheet/locales/en';
import { nl } from 'tego-sheet/locales/nl';
import { zhCN } from 'tego-sheet/locales/zh-cn';
```

## Ref commands

Use `TegoSheetHandle` for `focus`, workbook and cell queries, cell edits, sheet management, undo/redo, validation, printing, and layout recalculation. Ref mutations follow the same validation, history, read-only, and callback rules as the default UI. Invalid caller commands throw the public `TegoSheetException` synchronously; recoverable browser failures are reported through `onError`.

## Five intentional correctness differences

These are the only approved visible departures from legacy behavior:

1. **Empty workbook:** loading `[]` renders an explicit empty workbook state and continues exporting `[]`; it no longer leaves a stale grid visible.
2. **All sheets are validated:** `validate()` inspects every sheet, including hidden rows and columns, in deterministic sheet/row/column order rather than validating only the initially created sheet.
3. **Rendered-value stable sort:** sorting uses the selected column's rendered values, handles numeric and textual groups deterministically, keeps empty values last in both directions, and preserves original row order for equal comparisons. It no longer sorts row indexes.
4. **Resource cleanup:** React unmount removes every owned listener, observer, timer, animation frame, subscription, and transient overlay. There is no incomplete manual destroy path.
5. **Printable cells:** cells with `printable: false` omit their content from print output while retaining grid geometry. The legacy implementation stored this flag but ignored it during printing.

## Data and identity notes

Sparse row, column, and cell indexes; formulas; styles; merges; validation; filters; falsy values; and extension keys retain their serialized meaning. Invalid workbook replacement is atomic, so partially imported state is never exposed.

`SheetId` is a runtime-only opaque identity used by callbacks and ref commands. Do not persist it in workbook JSON. A genuine external workbook replacement creates new IDs; edits, renames, history, and controlled acknowledgements retain existing IDs.

The package exposes only `tego-sheet`, `tego-sheet/styles.css`, the four locale subpaths, and `tego-sheet/package.json`. Imports from controller, engine, React internals, source, or legacy paths are unsupported and blocked by the export map.
