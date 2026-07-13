# tego-sheet React Rewrite Design

**Date:** 2026-07-13
**Status:** Approved in sections; awaiting review of this consolidated specification
**Package:** `tego-sheet`
**License:** MIT

## 1. Purpose

Rebuild the current `x-data-spreadsheet` project as a React + TypeScript + Vite component library named `tego-sheet`.

The rewrite will expose only a new, typed React API. It will preserve the legacy workbook data format, supported spreadsheet capabilities, and user-visible behavior, but it will not preserve the legacy constructor, global function, mutable instance API, or event-emitter surface.

This is a replacement implementation, not a React wrapper around the existing imperative `Spreadsheet` class.

## 2. Goals

1. Provide a declarative `<TegoSheet>` component for React applications.
2. Support controlled and uncontrolled workbook data without mutating caller-owned values.
3. Provide typed callback props and a small, stable imperative ref API.
4. Preserve supported legacy workbook JSON and visible spreadsheet behavior.
5. Preserve the Canvas-based grid experience while moving surrounding UI and lifecycle ownership into React.
6. Make mounting, unmounting, remounting, and React Strict Mode safe.
7. Build and publish with Vite as `tego-sheet`, including declarations, scoped styles, locales, examples, and migration documentation.
8. Prove parity through characterization, browser, visual, package-consumer, and architecture-invariant tests.

## 3. Non-goals

- Preserving the legacy `new Spreadsheet(container, options)` API.
- Preserving `window.x_spreadsheet`, chainable methods, `.on(...)`, `.change(...)`, or access to mutable internal objects.
- Shipping a compatibility adapter under the public `tego-sheet` entry point.
- Adding built-in XLSX or CSV import/export. The legacy project documents external SheetJS integration rather than implementing these features.
- Adding charts, comments, collaboration, a plugin registry, or unrelated spreadsheet features.
- Reproducing known implementation defects, lifecycle leaks, or inconsistent results merely because they exist in the legacy code.

## 4. Legacy Baseline

The repository is an imperative JavaScript application organized around a mutable `DataProxy`, a `Sheet` coordinator, Canvas rendering, and DOM overlays. It contains roughly 10.8k source lines and has no React lifecycle boundary.

The baseline captured before implementation is:

- `npm ci`: succeeds.
- `npm test`: 134 passing and 1 pre-existing failing infix-expression assertion. The actual result is `931-+*23+42/+`; the test expects `931-+23+*42/+`.
- NYC statement coverage: 20.38%. Important modules including workbook state, history, clipboard, rows, merges, and validation have little or no effective coverage.
- `npm run lint`: three pre-existing errors in `sheet.js` and `alphabet.js`.
- Production and locale builds fail on current Node without the OpenSSL legacy provider, but both succeed with `NODE_OPTIONS=--openssl-legacy-provider`.

These failures are baseline evidence, not acceptance criteria for `tego-sheet`. The rewritten package must have clean tests, type checking, linting, and builds on its supported runtime.

## 5. Compatibility Contract

### 5.1 Public API compatibility

There is intentionally no legacy public API compatibility. Consumers migrate to the new React component, callback props, and ref commands.

### 5.2 Data compatibility

The legacy loader accepts either one sheet object or an array of sheets, while export returns an array. The new React API preserves that distinction with a permissive input and canonical output:

```ts
export type WorkbookData = readonly SheetData[];
export type WorkbookInput = SheetData | WorkbookData;
```

`value` and `defaultValue` accept `WorkbookInput`. `onChange` and `getValue()` always emit a cloned `WorkbookData` array. An empty object is one blank sheet. An empty array remains an empty workbook and renders an explicit empty state from which an editable user can add a sheet; this corrects the legacy stale-grid behavior without changing the serialized value.

Each sheet continues to support the known serialized fields:

- `name`
- `freeze`
- `styles`
- `merges`
- `rows`
- `cols`
- `validations`
- `autofilter`

The schema contract covers every legacy nesting level:

| Object | Known preserved fields |
| --- | --- |
| Sheet | `name`, `freeze`, `styles`, `merges`, `rows`, `cols`, `validations`, `autofilter` |
| Rows collection | `len` and sparse decimal row-index keys |
| Row | `height`, `hide`, `style`, `cells` |
| Cell | `text`, `style`, `merge`, `editable`, `printable`, cached `value` |
| Columns collection | `len` and sparse decimal column-index keys |
| Column | `width`, `hide`, `style` |
| Style | `format`, `bgcolor`, `align`, `valign`, `textwrap`, `strike`, `underline`, `color`, `font`, `border` and their existing nested values |
| Validation | `refs`, `mode`, `type`, `required`, `operator`, `value` |
| Autofilter | `ref`, `filters`, `sort`; filters preserve `ci`, `operator`, `value`; sort preserves `ci`, `order` |

All schema objects also carry a typed extension bag for unrecognized JSON-compatible keys. The controller preserves those keys recursively through load, unrelated edits, history, and export. A command may remove or replace extension data only when it directly replaces that containing object. This is stricter than the legacy exporter and prevents migration-time data loss.

Canonicalization rules are fixed before the core port:

- output is always an array in sheet order;
- sparse row, column, and cell indexes are emitted as base-10 object keys without leading zeros;
- coordinate strings such as freeze and merge references use uppercase A1 notation;
- explicit `false`, `0`, and empty-string values are preserved;
- missing optional nested collections are emitted using the same defaults captured by the approved legacy fixtures;
- style indexes are preserved unless a user command creates or deduplicates a style through existing semantics;
- cached cell `value` is preserved until an edit invalidates it, matching the legacy row mutation behavior; and
- JSON key ordering is not semantically significant, but canonical snapshot fixtures use the serializer's deterministic order.

Compatibility rules:

1. Known legacy fields must load with the same meaning.
2. Load followed by export must preserve the semantic workbook content and stable known-field representation.
3. The library clones data at ingress and egress. It never mutates a value supplied through props or returned to a callback.
4. Invalid workbook input is rejected atomically; partially imported state is never exposed.
5. The compatibility fixture suite contains at least one fixture for every table row above, explicit falsy values, sparse indexes, extension keys, and load-export without edits.

### 5.3 Functional parity

The rewrite preserves the features actually supported by the legacy implementation:

| Area | Required behavior |
| --- | --- |
| Workbook | Multiple sheets; add, delete, rename, and activate sheets; load and export data |
| Selection | Single and range selection; keyboard and pointer navigation; selection callbacks |
| Editing | Cell text and formula editing; editor overlays; read-only behavior |
| History | Undo and redo of document mutations |
| Formatting | Number format, font family and size, bold, italic, underline, strike, colors, fill, borders, alignment, vertical alignment, and wrapping |
| Structure | Insert, delete, resize, and hide rows and columns |
| Ranges | Merge and unmerge cells; paint format; clear format; autofill |
| View | Scrolling, frozen panes, grid visibility, toolbar, context menu, bottom sheet tabs |
| Clipboard | Copy, cut, and paste with browser-permission-aware failure handling |
| Data tools | Auto-filter, sort, and data validation |
| Formulas | Existing arithmetic and references plus `SUM`, `AVERAGE`, `MAX`, `MIN`, `IF`, `AND`, `OR`, and `CONCAT` |
| Output | Print flow and existing visual presentation |
| Input | Existing desktop keyboard/pointer behavior plus tap selection, double-tap editing, and swipe scrolling |
| Localization | Existing locale messages through an explicit React-safe locale input |

Exact cursor timing, browser-native clipboard permission prompts, and printer-dialog chrome are platform behavior. Acceptance focuses on observable library behavior before and after those boundaries.

### 5.4 Known defects

Visible behavior remains parity-bound except for the following fixed correction ledger:

| Case | Legacy observation | Required `tego-sheet` result |
| --- | --- | --- |
| Empty workbook | Loading `[]` leaves stale grid state while export returns `[]` | Render an explicit empty state and continue exporting `[]` |
| Validation scope | Public `validate()` can inspect the initially created sheet instead of the current workbook | Validate every sheet in deterministic sheet/row/column order |
| Sorting | The sort path orders row indexes rather than selected-column values | Stable sort by rendered selected-column value using the total order below |
| Resource cleanup | Window listeners and overlays have no complete destroy path | Unmount removes every owned browser resource and transient overlay |
| Printable cells | Context-menu `printable: false` is stored but ignored by print output | Print output omits non-printable cell content while retaining grid geometry |

Each row requires a regression test and a migration note. Any additional intentional behavior difference discovered during characterization requires explicit Ultragoal steering and user approval before implementation; it cannot be classified as a defect unilaterally.

Sorting uses this total order:

1. finite numbers and strings that parse completely as finite numbers, compared numerically;
2. all other rendered values, including booleans and formula errors, converted to strings and compared with `Intl.Collator(locale.id, { usage: 'sort', numeric: true, sensitivity: 'base' })`;
3. empty string, `null`, and missing cells, always last in both directions.

Numeric values sort before textual values. Descending reverses comparison within the numeric and textual groups but does not move empties from last place. Equal comparisons retain original row order. Cross-browser fixtures use an explicit locale and strings whose order is defined consistently by the specified collator options.

## 6. Chosen Architecture

The implementation has four explicit layers:

```text
React application
      |
      v
react/  <TegoSheet>, props, callbacks, ref API, lifecycle
      |
      v
ui/     React toolbar, tabs, editor, menus, dialogs, notifications
      |
      +----------------------+
      |                      |
      v                      v
core/  WorkbookController    engine/ Canvas renderer + InteractionManager
      |                      |
      +---------- commands/events ----------+
```

### 6.1 `core/`

`core/` is pure TypeScript domain code. It owns:

- canonical workbook and sheet data;
- commands and document mutations;
- formulas, styles, merges, rows, columns, validation, filters, and sheet operations;
- undo and redo history;
- deterministic change descriptions;
- validation and serialization.

It does not import React, touch the DOM, read browser globals, or store viewport-only state.

`WorkbookController` is the single mutation boundary. UI and interaction code send typed commands; they do not mutate workbook structures directly.

### 6.2 `engine/`

`engine/` owns Canvas-specific and interaction-specific behavior:

- grid measurement and painting;
- cell and range geometry;
- scrolling and frozen-pane geometry;
- selection and hover presentation;
- pointer, touch, keyboard, clipboard, and resize coordination;
- editor positioning and overlay anchors;
- device-pixel-ratio handling;
- print rendering support.

The renderer consumes isolated read-only snapshots or selectors and never mutates workbook state.

`InteractionManager` owns every DOM and global listener it creates. It has an idempotent `dispose()` that removes listeners, observers, timers, animation frames, and transient overlays. This boundary is mandatory for Strict Mode safety.

### 6.3 `ui/`

`ui/` implements the visible non-grid interface as React components:

- toolbar;
- sheet tabs;
- formula and cell editor;
- context menus;
- formatting and validation dialogs;
- filter controls;
- recoverable-error notifications.

The default UI preserves legacy capabilities and visual density. Toolbar and tab composition are replaceable through typed render slots without exposing internal mutable objects.

### 6.4 `react/`

`react/` is the only public application-facing layer. It owns:

- component lifecycle;
- controlled and uncontrolled reconciliation;
- error and event delivery;
- context needed by approved composition slots;
- the stable ref handle;
- creation and disposal of controller, engine, and interaction instances.

### 6.5 Data flow

1. `<TegoSheet>` validates and clones `value` or `defaultValue`.
2. React creates the controller once for the mounted control epoch, then creates the renderer and interaction manager in a layout effect after the root and canvas refs exist.
3. UI and interactions issue typed commands to `WorkbookController`.
4. The controller applies a mutation, records one undo checkpoint for each undoable command, and emits an isolated read-only snapshot plus a typed `WorkbookChange`.
5. React invokes callbacks and updates controlled or uncontrolled presentation state.
6. The Canvas engine redraws from controller selectors plus transient viewport state.
7. Unmount disposes all browser resources.

Transient state such as active hover, scroll offsets, editor geometry, drag state, and animation scheduling remains outside serialized workbook history.

### 6.6 Resource ownership

Every browser resource has exactly one owner, and `react/` owns the disposal cascade:

| Resource | Sole owner | Cleanup contract |
| --- | --- | --- |
| Window/document pointer, keyboard, clipboard, and resize listeners | `InteractionManager` | Removed by idempotent `dispose()` |
| Root/canvas element listeners and `ResizeObserver` | `InteractionManager` | Removed/disconnected by `dispose()` |
| Canvas animation frames and render scheduler | Canvas engine | Cancelled by engine `dispose()` |
| React portals, dialogs, editors, and notifications | React UI | Unmounted through normal React cleanup |
| UI timers | Component hook that creates the timer | Cleared by that hook's effect cleanup |
| Controller subscriptions | `react/` adapter | Unsubscribed before controller disposal |

Lower layers may not create an unregistered global listener, portal, observer, timer, or animation frame. React unmount disposes interaction first, then engine subscriptions and scheduler, then controller subscriptions and state. Strict Mode tests instrument add/remove listeners, observers, timers, animation frames, subscriptions, and portal roots; every counter must return to its pre-mount value after each unmount, and no disposed callback may mutate state.

## 7. React Public API

The primary component contract is:

```ts
export interface TegoSheetProps {
  value?: WorkbookInput;
  defaultValue?: WorkbookInput;
  onChange?: (value: WorkbookData, change: WorkbookChange) => void;

  initialActiveSheetIndex?: number;
  onActiveSheetChange?: (event: ActiveSheetChangeEvent) => void;

  readOnly?: boolean;
  locale?: LocaleDefinition;
  options?: SheetOptions;

  toolbar?: 'default' | false | ToolbarRenderer;
  sheetTabs?: 'default' | false | SheetTabsRenderer;

  onSelectionChange?: (selection: Selection) => void;
  onCellEdit?: (event: CellEditEvent) => void;
  onPaste?: (event: PasteEvent) => void;
  onError?: (error: TegoSheetError) => void;

  className?: string;
  style?: React.CSSProperties;
}
```

The component uses `forwardRef` and exposes:

```ts
export interface TegoSheetHandle {
  focus(): void;
  getValue(): WorkbookData;
  getCell(address: CellAddress): CellData | null;
  getCellStyle(address: CellAddress): CellStyle;
  setCellText(address: CellAddress, text: string): void;

  addSheet(name?: string): SheetId;
  deleteSheet(sheet: SheetId): void;
  renameSheet(sheet: SheetId, name: string): void;
  activateSheet(sheet: SheetId): void;

  undo(): void;
  redo(): void;
  validate(): ValidationResult;
  print(): void;
  recalculateLayout(): void;
}
```

The ref exposes commands and isolated read-only query results, never controller, renderer, `DataProxy`, DOM-overlay, or mutable sheet instances.

`SheetId` is an opaque runtime identity, not a new serialized field. It remains stable across edits, renames, history operations, and equal controlled acknowledgements. A genuine external workbook replacement invalidates every old `SheetId` and deterministically assigns new IDs in array order. The active sheet and selection are preserved by clipped array index and cell coordinates, not by guessing sheet identity. Consumers must not persist `SheetId` as workbook data.

### 7.1 Change and event contract

Every mutating path, including ref commands, uses the same typed command pipeline. A successful document mutation synchronously publishes one `onChange` callback after the controller commits and before the next paint. Selection-only and viewport-only changes do not call `onChange`.

```ts
export type WorkbookChangeKind =
  | 'cell'
  | 'style'
  | 'structure'
  | 'merge'
  | 'clipboard'
  | 'autofill'
  | 'filter'
  | 'validation'
  | 'sheet'
  | 'history';

export type ChangeSource =
  | 'keyboard'
  | 'pointer'
  | 'touch'
  | 'toolbar'
  | 'sheet-tabs'
  | 'context-menu'
  | 'clipboard'
  | 'ref';

export interface WorkbookChange {
  id: string;
  kind: WorkbookChangeKind;
  source: ChangeSource;
  sheet: SheetId;
  range?: CellRange;
}
```

The full cloned workbook remains the persistence payload; `WorkbookChange` is stable metadata for routing, analytics, and correlating emitted controlled-mode checkpoints rather than a replayable patch.

- `onSelectionChange` fires after the active selection changes and includes the active sheet, range, and active cell.
- `onActiveSheetChange` fires after activation and includes runtime sheet ID, array index, and source. Sheet activation is component-owned viewport state and never calls `onChange`.
- `onCellEdit` fires after one cell edit successfully commits and includes address, previous text, next text, and source.
- `onPaste` fires after a paste successfully commits and includes source range or external matrix metadata plus the affected target range.
- These callbacks observe committed state and are not cancellation hooks.
- Failed or rejected commands do not emit change, edit, or paste callbacks.
- Semantically no-op commands do not create history entries or emit callbacks.
- Ref mutators respect `readOnly`, participate in history, and emit the same callbacks as equivalent UI commands.
- `getValue()` returns the current rendered document, including an unacknowledged optimistic controlled update.

#### Edit and callback timelines

Cell typing is a local editor transaction. Keystrokes do not mutate the workbook or create history entries. Enter, Tab, blur, pointer navigation, or an explicit editor commit produces one cell command and one undo step; Escape cancels without callbacks or history. Formula text follows the same transaction boundary.

Normative callback order is:

```text
cell commit: validate command -> commit/history -> onChange -> onCellEdit
             -> optional onSelectionChange -> schedule paint
paste:       validate command -> commit/history -> onChange -> onPaste
             -> onSelectionChange -> schedule paint
undo/redo:   restore history -> onChange(kind: history) -> schedule paint
ref edit:    validate command -> commit/history -> onChange -> onCellEdit
             -> schedule paint
```

Validation rules annotate the committed value and do not silently reject cell text. An invalid value therefore follows the normal commit timeline and appears in the next `ValidationResult`. A structurally invalid command fails before mutation and emits none of the success callbacks.

### 7.2 Controlled mode

- `value` is the authoritative external document.
- User commands apply optimistically to local presentation state and call `onChange(nextValue, change)`.
- The component records an ordered checkpoint for every pending command. The checkpoint contains the command, its `change.id`, and its projected canonical workbook.
- Re-rendering with the same `value` reference is not an external decision and leaves pending optimistic state intact.
- A new `value` reference semantically equal to a pending checkpoint acknowledges that checkpoint and every checkpoint before it. Later pending commands are replayed in order on the acknowledged base. Acknowledgement does not reset history, selection, scroll, or active editing.
- A new `value` reference semantically equal to the last acknowledged base explicitly rejects all pending commands, restores the controller checkpoint at that base, and discards history entries created by those rejected commands.
- Any other new `value` is a genuine replacement. It atomically discards pending commands, clears undo and redo history plus transient validation errors, cancels active editing, assigns new runtime sheet IDs, and clips the active sheet, selection, and scroll to valid coordinates.
- A replacement or rollback initiated through props emits no `onChange`, edit, paste, selection, or active-sheet callback.
- If replaying a later pending command after an acknowledgement is no longer valid, that command and all later pending commands are dropped and reported once as `INVALID_COMMAND`.
- Acknowledgement replay is notification-silent: it never repeats `onChange`, edit, paste, selection, active-sheet, or history notifications already produced by the original commands.
- Controlled consumers must retain the current `value` reference when they have made no acceptance, rejection, or replacement decision. This lets the component distinguish an unrelated parent render from an explicit rollback to semantically equal data.
- The component never mutates `value`.

Semantic equality compares canonical workbook JSON, including preserved extension keys, while excluding runtime sheet IDs, selection, history, validation issues, scroll, editor, and other transient state. Object key order is irrelevant; sheet order and sparse row/column/cell indexes are significant.

### 7.3 Uncontrolled mode

- `defaultValue` is read only during initialization.
- The component owns subsequent workbook state.
- `onChange` still reports every committed document mutation.
- `getValue()` returns a clone of current state.

### 7.4 Mode invariants

- Passing both `value` and `defaultValue` is an error.
- Switching between controlled and uncontrolled mode after mount is an error.
- `initialActiveSheetIndex` is a zero-based mount-only value. It must refer to an initial sheet; it is ignored for an empty workbook. The default is index 0.
- Deleting or replacing sheets keeps the previous active index when possible and otherwise selects the nearest preceding sheet. An empty workbook has no active sheet.
- Event callbacks are ordinary React props; there is no `.on(...)` subscription API.
- Callback payloads use deeply readonly TypeScript types and isolated deep clones. They are not recursively frozen in production; mutating a received object cannot mutate controller state.

### 7.5 Read-only mode

Read-only mode permits viewing, scrolling, selection, navigation, and copying. It disables editing, formatting, paste, cut, structural mutations, history mutations, and sheet mutations. Commands that would mutate data fail with a typed invalid-command error.

### 7.6 Named public value and slot types

All public data types are deeply readonly. Coordinates are zero-based, and ranges are normalized, inclusive, and ordered from top-left to bottom-right.

```ts
declare const sheetIdBrand: unique symbol;
export type SheetId = string & { readonly [sheetIdBrand]: true };

export interface CellPoint {
  readonly row: number;
  readonly column: number;
}

export interface CellAddress extends CellPoint {
  readonly sheet: SheetId;
}

export interface CellRange {
  readonly start: CellPoint;
  readonly end: CellPoint;
}

export interface Selection {
  readonly sheet: SheetId;
  readonly range: CellRange;
  readonly active: CellPoint;
}

export interface CellEditEvent {
  readonly changeId: string;
  readonly address: CellAddress;
  readonly previousText: string;
  readonly text: string;
  readonly source: ChangeSource;
}

export interface PasteEvent {
  readonly changeId: string;
  readonly source: 'internal' | 'external';
  readonly sourceSelection?: Selection;
  readonly target: Selection;
  readonly values: readonly (readonly string[])[];
}

export interface ActiveSheetChangeEvent {
  readonly sheet: SheetId;
  readonly index: number;
  readonly source: 'sheet-tabs' | 'keyboard' | 'ref';
}

export interface LocaleMessages {
  readonly [key: string]: string | LocaleMessages;
}

export interface LocaleDefinition {
  readonly id: string;
  readonly messages: LocaleMessages;
}

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type BorderLine = readonly [style: string, color?: string];

export interface FontStyle {
  readonly name?: string;
  readonly size?: number;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

export interface CellBorders {
  readonly top?: BorderLine;
  readonly right?: BorderLine;
  readonly bottom?: BorderLine;
  readonly left?: BorderLine;
}

export interface CellStyle {
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
  readonly [extensionKey: string]: unknown;
}

export type ValidationType = 'date' | 'number' | 'list' | 'phone' | 'email';
export type ValidationOperator =
  | 'be' | 'nbe' | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';

export interface ValidationRule {
  readonly mode: 'cell';
  readonly type: ValidationType;
  readonly required: boolean;
  readonly operator?: ValidationOperator;
  readonly value?: string | readonly [string, string];
}

export interface FilterDefinition {
  readonly column: number;
  readonly operator: 'all' | 'in';
  readonly value: readonly string[];
}
```

Locale `id` is a BCP 47 language tag. Supplied messages are a recursive partial overlay on bundled English messages, preserving the legacy fallback behavior without global locale mutation.

Custom toolbars use a public action union rather than controller access:

```ts
export type ToolbarAction =
  | { readonly type: 'undo' | 'redo' | 'print' }
  | { readonly type: 'paint-format' | 'clear-format' }
  | { readonly type: 'set-style'; readonly patch: Readonly<Partial<CellStyle>> }
  | { readonly type: 'merge' | 'unmerge' }
  | { readonly type: 'freeze' | 'unfreeze' }
  | { readonly type: 'insert-row' | 'delete-row' | 'hide-row' | 'unhide-row' }
  | { readonly type: 'insert-column' | 'delete-column' | 'hide-column' | 'unhide-column' }
  | { readonly type: 'set-validation'; readonly rule: ValidationRule }
  | { readonly type: 'remove-validation' }
  | { readonly type: 'set-filter'; readonly filter: FilterDefinition }
  | { readonly type: 'clear-filter' }
  | { readonly type: 'sort'; readonly order: 'asc' | 'desc' };

export interface ToolbarRenderProps {
  readonly selection: Selection | null;
  readonly activeStyle: CellStyle;
  readonly readOnly: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly merged: boolean;
  readonly frozen: boolean;
  readonly disabledActions: ReadonlySet<ToolbarAction['type']>;
  readonly execute: (action: ToolbarAction) => void;
}

export type ToolbarRenderer =
  (props: ToolbarRenderProps) => React.ReactNode;

export interface SheetTabItem {
  readonly id: SheetId;
  readonly index: number;
  readonly name: string;
}

export interface SheetTabsRenderProps {
  readonly sheets: readonly SheetTabItem[];
  readonly activeSheet: SheetId | null;
  readonly readOnly: boolean;
  readonly add: (name?: string) => void;
  readonly delete: (sheet: SheetId) => void;
  readonly rename: (sheet: SheetId, name: string) => void;
  readonly activate: (sheet: SheetId) => void;
}

export type SheetTabsRenderer =
  (props: SheetTabsRenderProps) => React.ReactNode;
```

Slot actions use the same validation, history, callback ordering, read-only rules, and failure channels as the default UI. Actions unavailable in the current state appear in `disabledActions`; dispatching one anyway uses `onError(INVALID_COMMAND)`.

## 8. Errors and Validation

```ts
export type TegoSheetErrorCode =
  | 'INVALID_DATA'
  | 'INVALID_COMMAND'
  | 'CLIPBOARD_DENIED'
  | 'PRINT_FAILED'
  | 'RENDER_FAILED';

export interface TegoSheetError {
  code: TegoSheetErrorCode;
  message: string;
  recoverable: boolean;
  cause?: unknown;
}
```

Public failures use one of three non-overlapping channels:

| Failure class | Channel |
| --- | --- |
| Programmer contract violations, including mixed control modes, invalid active index, invalid ref address, read-only ref mutation, or invalid sheet ID | Throw a synchronous `TegoSheetException` with a `TegoSheetError` payload |
| Invalid initial workbook | Throw during initialization so a React error boundary can handle it |
| Invalid later controlled workbook | Retain the last valid document and call `onError(INVALID_DATA)` once for that prop reference |
| Recoverable UI/browser failure, including denied clipboard access, print failure, render recovery, or a command invalidated by a concurrent replacement | Call `onError`; the default UI also shows a concise notification |
| Cell data-rule violation | Return it through `ValidationResult`; it is not an exception |

UI controls disable commands known to be invalid or forbidden by `readOnly`. If a race makes such a UI command invalid after dispatch, it uses the recoverable `onError(INVALID_COMMAND)` channel. Ref methods throw instead because they are synchronous caller-initiated commands. `addSheet` returns a `SheetId` on success and throws on a read-only workbook or invalid name.

Exceptions thrown by consumer callbacks are not swallowed or converted into spreadsheet errors. Browser globals are accessed only after mount or inside invoked browser-only commands, so package imports are SSR-safe.

Validation covers all sheets, including hidden rows and columns. Empty cells participate only when the matching rule is required. Rule definitions are serialized; current issues are transient and recalculated after load, edits, history, and external replacement.

```ts
export interface ValidationIssue {
  sheet: SheetId;
  sheetIndex: number;
  address: CellAddress;
  rule: ValidationRule;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: readonly ValidationIssue[];
}
```

Issues are ordered by sheet index, row, column, and then rule order. `validate()` returns an isolated deeply readonly result and never changes workbook history.

## 9. Options and Extensibility

`SheetOptions` retains the semantic options users need for parity, expressed as serializable typed values where possible:

- grid and context-menu visibility;
- initial row and column counts and sizes;
- minimum column width and row-header width;
- default cell style;
- autofocus;
- viewport sizing behavior through the component container and `recalculateLayout()` rather than arbitrary legacy callbacks.

The dedicated `toolbar` and `sheetTabs` props are the only visibility and composition controls for those regions. The migration guide maps legacy `showToolbar` and `showBottomBar` options to these props, avoiding two sources of truth.

Prop and option update behavior is deterministic:

| Input | Update behavior |
| --- | --- |
| `value`, `readOnly`, `locale`, `toolbar`, `sheetTabs`, `className`, `style` | Reconciled live |
| Grid and context-menu visibility | Reconciled live and redraws/reflows as needed |
| `initialActiveSheetIndex`, row/column initial counts and dimensions, minimum sizes, default style, autofocus | Mount-only defaults |

Changing a mount-only option after mount leaves the current controller unchanged and emits a development warning naming the option. Consumers remount with a React `key` when they intentionally want new initialization defaults. Default style changes never rewrite existing cells or sheets.

Toolbar and sheet-tab renderer slots receive a documented, isolated read-only view model and typed actions. They do not receive the controller or renderer. Additional extension surfaces will not be added until a concrete parity requirement needs them.

## 10. Rendering and Visual Behavior

The Canvas grid remains the performance-critical rendering surface. React renders the surrounding controls and owns lifecycle, while the engine redraws Canvas in response to controller changes and viewport changes.

Visual parity is defined by canonical fixtures for:

- default workbook and selection;
- styled cells and borders;
- merged cells;
- frozen rows and columns;
- resized and hidden rows and columns;
- editing overlays and menus;
- validation and filter UI;
- multiple sheet tabs.

Fixtures run at device-pixel ratios 1 and 2. Font-rasterization differences are bounded by the thresholds below; geometry and layout differences are not ignored.

The visual harness bundles its test font and uses fixed 1280×720 desktop and 390×844 touch viewports. Cell, header, frozen-pane, selection, editor, and overlay geometry must be within 1 CSS pixel of the approved reference. Screenshot comparison permits at most 0.2% differing pixels at a per-channel threshold of 24. Masks are allowed only for the blinking caret and browser-native scrollbars; every mask is named in the fixture. Browser print-dialog chrome is never part of a screenshot assertion.

All CSS is scoped beneath `.tego-sheet`. The package must not reset `body`, global form controls, or host typography.

## 11. Package and Build Design

Vite Library Mode produces:

- ESM JavaScript;
- CommonJS JavaScript;
- generated `.d.ts` declarations;
- an explicit stylesheet export;
- locale subpath exports.

Expected consumer usage:

```tsx
import { TegoSheet } from 'tego-sheet';
import 'tego-sheet/styles.css';

export function Example() {
  return <TegoSheet defaultValue={[]} />;
}
```

`react` and `react-dom` are peer dependencies and are not bundled. Package exports prevent accidental imports from internal directories. Every JavaScript entry point must import successfully in an SSR process without `window` or `document`.

The repository includes a React + Vite demo and a separate clean consumer fixture that installs the packed tarball rather than resolving workspace source directly.

## 12. Testing Strategy

### 12.1 Characterization and unit tests

- Capture legacy JSON fixtures and expected outcomes before replacing behavior.
- Run equivalent operations against the legacy and new domain implementations where deterministic comparison is possible.
- Cover formulas, references, rows, columns, styles, merges, history, clipboard transforms, autofill, filters, sorting, validation, freeze, and sheet operations.
- Add regression tests for every intentional defect correction.
- Use test-driven development for each new behavior: failing test, minimal implementation, passing test, then refactor.

### 12.2 React component tests

Cover:

- controlled and uncontrolled initialization and updates;
- prohibition of mixed or switched modes;
- input non-mutation and isolated read-only callback payloads;
- optimistic controlled changes and equal-value acknowledgement;
- external replacement reconciliation;
- event ordering and payloads;
- imperative ref commands;
- read-only restrictions;
- Strict Mode mount, cleanup, and remount;
- custom toolbar and sheet-tab renderers;
- recoverable error delivery.

### 12.3 Browser end-to-end tests

Playwright scenarios cover editing, selection, keyboard navigation, toolbar actions, formats, formulas, merges, row and column operations, resize and hide, freeze, copy/cut/paste, autofill, undo/redo, filters, sort, validation, sheet management, print behavior, and touch interaction. Release browser coverage uses Chromium, Firefox, and WebKit to represent the legacy project's modern Chrome, Firefox, and Safari support claim.

Clipboard tests use deterministic `DataTransfer` fixtures for internal and external tab/newline text plus an injected permission-denial path. Print tests assert selected paper size and orientation, page generation, preserved merge/style geometry, and omission of `printable: false` content before the native print call. Touch parity requires tap selection, double-tap editing, and swipe scrolling without accidental cell mutation.

### 12.4 Visual regression

Screenshot tests exercise the canonical fixtures described in section 10 at DPR 1 and 2, with stable fonts and deterministic viewport dimensions.

`tests/parity/manifest.ts` is the traceability source of truth. Every row in section 5.3 maps to named unit, component, browser, and visual assertions or to an explicit “not applicable” explanation. The release gate fails when a parity row lacks an executable assertion.

### 12.5 Package-consumer and SSR tests

- Build and pack `tego-sheet`.
- Install the tarball into a clean React + Vite fixture.
- Typecheck and build the consumer.
- Verify component rendering, stylesheet import, locale import, and declaration resolution.
- Import all public JavaScript entry points in a Node SSR smoke test.

### 12.6 Required verification commands

The final scripts may be named conventionally, but the release gate must include equivalents of:

```sh
npm test
npm run test:browser
npm run test:visual
npm run typecheck
npm run lint
npm run build
npm run test:package
```

## 13. Architecture Invariants

The implementation is incomplete unless all of these are proven:

1. The only public application API is the new React surface; no legacy global, constructor, emitter, or mutable internal object is exported.
2. Known legacy workbook JSON fields round-trip with compatible meaning and representation.
3. `WorkbookController` and domain modules have no React or DOM dependency.
4. The Canvas renderer never mutates workbook state.
5. Every browser resource has exactly one owner from the section 6.6 matrix, and the root disposal cascade leaves no listener, observer, timer, animation frame, subscription, or overlay behind.
6. Caller-owned props and workbook objects are never mutated.
7. Controlled equal-value acknowledgement preserves history, selection, scrolling, and active editing.
8. Browser and visual tests prove supported visible behavior parity.
9. Public package entry points are safe to import during SSR.

Each invariant requires implementation evidence, automated test evidence, and independent reviewer evidence during the final Ultragoal gate.

## 14. Delivery Sequence

Implementation follows these dependency-ordered stages:

1. Establish the TypeScript, React, Vite, test, and package foundation.
2. Port and characterize the pure workbook domain and serialization behavior.
3. Port Canvas rendering and interaction with explicit resource ownership.
4. Build the React UI, component contract, events, reconciliation, and ref commands.
5. Finish styles, locales, demo, package exports, and migration documentation.
6. Run parity, package-consumer, cleanup, invariant, and independent-review gates.

No implementation stage may relax the compatibility contract or architecture invariants without a new explicit design decision recorded in the Ultragoal ledger.

## 15. Acceptance Criteria

The rewrite is complete only when:

- the package is named and consumable as `tego-sheet`;
- the legacy supported workbook data loads and exports compatibly;
- every feature row in the parity matrix has automated evidence;
- controlled and uncontrolled React usage behaves as specified;
- Strict Mode and repeated mount/unmount tests show no leaked resources;
- typecheck, lint, unit, component, browser, visual, build, SSR, and package-consumer checks pass cleanly;
- migration and API documentation are complete;
- an anti-slop cleanup pass has been followed by the full verification suite;
- an independent code reviewer returns `APPROVE`;
- an independent architecture reviewer returns `CLEAR`; and
- every architecture invariant has implementation, test, and review evidence.
