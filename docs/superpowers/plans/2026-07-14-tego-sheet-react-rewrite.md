# tego-sheet React Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy imperative spreadsheet with the `tego-sheet` React + TypeScript + Vite library while preserving approved data and visible behavior parity.

**Architecture:** A pure TypeScript `WorkbookController` owns canonical document state and commands. A Canvas engine owns geometry, rendering, and browser interactions through narrow ports; React owns lifecycle, controlled reconciliation, UI chrome, callbacks, slots, and disposal. The public package exports only the approved React API, styles, and locale subpaths.

**Tech Stack:** React 19.2.7, TypeScript 6.0.3, Vite 8.1.4, Vitest 4.1.10, React Testing Library 16.3.2, jsdom 29.1.1, Playwright 1.61.1, ESLint 10.7.0, Less 4.6.7.

---

## Execution rules

- Work in the task order below. Later tasks depend on the contracts and tests established earlier.
- Apply test-driven development to every behavior: add one focused failing test, run it and read the failure, implement the smallest complete behavior, rerun the focused test, then run the affected suite.
- Preserve the legacy tree under `legacy/` only while it is needed as a read-only reference. Remove it in Task 23 after all parity fixtures pass.
- Do not export `core`, `engine`, runtime ports, the controller, or legacy objects.
- Do not update screenshot baselines until geometry assertions pass.
- Every commit follows the repository Lore protocol. The task-specific intent line is listed in each task; add `Constraint`, `Rejected`, `Confidence`, `Scope-risk`, `Directive`, `Tested`, and `Not-tested` trailers.

## Final file structure

```text
src/
  index.ts
  core/
    index.ts
    types/{json,workbook,coordinates,changes,validation,options}.ts
    serialization/{parse-workbook,canonicalize-workbook,serialize-workbook,semantic-equal}.ts
    coordinates/{a1,ranges}.ts
    model/{workbook-state,sheet-ids,rows,columns,cells,styles,merges}.ts
    formulas/{tokenizer,parser,evaluator,functions,rendered-value}.ts
    operations/{cell,style,structure,merge,clipboard,autofill,filter,sort,validation,sheet}.ts
    commands/{workbook-command,command-result,validate-command,apply-command}.ts
    controller/{workbook-controller,controller-checkpoint,history,subscription-store}.ts
    selectors/{workbook,cell,style,validation}.ts
    errors/{tego-sheet-error,tego-sheet-exception}.ts
  engine/
    index.ts
    ports.ts
    viewport/{viewport-state,selection-state,scroll-state}.ts
    geometry/{grid-geometry,frozen-pane-geometry,hit-test,overlay-anchors}.ts
    canvas/{canvas-engine,render-scheduler,draw-context,grid-painter,cell-painter,header-painter,selection-painter,print-renderer}.ts
    interaction/{interaction-manager,resource-registry,pointer,touch,keyboard,clipboard,resize}.ts
  ui/
    slot-types.ts
    sheet-chrome.tsx
    empty-workbook.tsx
    toolbar/{default-toolbar,toolbar-button,format-controls,border-controls}.tsx
    tabs/sheet-tabs.tsx
    editor/{cell-editor,formula-suggestions,date-editor}.tsx
    menus/{context-menu,filter-menu}.tsx
    dialogs/{validation-dialog,print-dialog}.tsx
    notifications/notification-host.tsx
    styles/{index,grid-overlays,toolbar,tabs,dialogs}.less
  react/
    tego-sheet.tsx
    tego-sheet.types.ts
    tego-sheet-context.tsx
    control/{controlled-reconciler,pending-checkpoint,classify-value-update}.ts
    adapters/{controller-external-store,engine-adapter,interaction-adapter,event-dispatcher}.ts
    hooks/{use-controller-epoch,use-canvas-engine,use-interaction-manager,use-controlled-workbook,use-tego-sheet-handle,use-mount-option-warnings}.ts
  locales/{index,en,de,nl,zh-cn}.ts
tests/
  helpers/
  parity/{manifest,manifest-types,manifest-gate}.ts
  parity/fixtures/{workbooks,invalid,operations}/
  unit/{core,engine}/
  component/
  browser/
  visual/
  types/
  package/
  ssr/
  architecture/
demo/
fixtures/consumer/
scripts/{capture-legacy-parity,verify-parity-manifest,test-package,test-ssr}.ts
```

## Task 1: Capture the immutable legacy baseline

**Files:**
- Create: `scripts/capture-legacy-parity.cjs`
- Create: `tests/parity/legacy/baseline-meta.json`
- Create: `tests/parity/fixtures/workbooks/{blank-object,empty-array,multiple-sheets,sheet-fields,rows,cells,columns,styles,validations,autofilter,sparse-falsy}.json`
- Create: `tests/parity/fixtures/operations/{history,structure,merge,clipboard,autofill,filter,sort,formulas,freeze,printable}.json`

- [ ] **Step 1: Write the fixture inventory assertion**

Create a temporary Node assertion in `scripts/capture-legacy-parity.cjs` that requires these fixture IDs before writing: `blank-object`, `empty-array`, `multiple-sheets`, `sheet-fields`, `rows`, `cells`, `columns`, `styles`, `validations`, `autofilter`, `sparse-falsy`, `history`, `structure`, `merge`, `clipboard`, `autofill`, `filter`, `sort`, `formulas`, `freeze`, and `printable`.

```js
const required = new Set(['blank-object', 'empty-array', 'multiple-sheets', 'sheet-fields', 'rows', 'cells', 'columns', 'styles', 'validations', 'autofilter', 'sparse-falsy', 'history', 'structure', 'merge', 'clipboard', 'autofill', 'filter', 'sort', 'formulas', 'freeze', 'printable']);
const captured = new Map();
process.on('beforeExit', () => {
  const missing = [...required].filter(id => !captured.has(id));
  if (missing.length > 0) throw new Error(`Missing legacy fixtures: ${missing.join(', ')}`);
});
```

- [ ] **Step 2: Run the capture script and verify the red state**

Run: `node -r @babel/register scripts/capture-legacy-parity.cjs`

Expected: FAIL with `Missing legacy fixtures`.

- [ ] **Step 3: Capture legacy operations and metadata**

Instantiate the existing `DataProxy`, perform the named operations, and write deterministic JSON with sorted object keys. Record commit `504ccf8`, Node version, `134 passing / 1 failing`, the infix mismatch, three lint errors, and the OpenSSL build workaround in `baseline-meta.json`.

- [ ] **Step 4: Verify every fixture is parseable and stable**

Run twice: `node -r @babel/register scripts/capture-legacy-parity.cjs && git diff --exit-code tests/parity`

Expected: first run writes fixtures; second run produces no diff.

- [ ] **Step 5: Commit**

Intent: `Lock observable legacy behavior before replacing the runtime`

Tested: fixture inventory, deterministic recapture, existing legacy baseline.

## Task 2: Install the parity manifest gate

**Files:**
- Create: `tests/parity/manifest-types.ts`
- Create: `tests/parity/manifest.ts`
- Create: `tests/parity/manifest-gate.check.ts`
- Create: `scripts/verify-parity-manifest.ts`

- [ ] **Step 1: Write the failing manifest test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyManifest } from '../../scripts/verify-parity-manifest.ts';

test('@parity:manifest.all-rows-covered rejects an uncovered row', () => {
  assert.throws(
    () => verifyManifest([{ id: 'workbook', unit: { assertions: [] } }], new Set()),
    /workbook has no executable assertion/,
  );
});
```

- [ ] **Step 2: Run the focused test**

Run: `node --test tests/parity/manifest-gate.check.ts`

Expected: FAIL because `verifyManifest` does not exist.

- [ ] **Step 3: Implement stable assertion-ID verification**

```ts
export type AssertionLane =
  | { readonly assertions: readonly string[] }
  | { readonly notApplicable: string };

export interface ParityRow {
  readonly id: string;
  readonly unit: AssertionLane;
  readonly component: AssertionLane;
  readonly browser: AssertionLane;
  readonly visual: AssertionLane;
}
```

Populate rows for workbook, selection, editing, history, formatting, structure, ranges, view, clipboard, data tools, formulas, output, input, localization, and the five correction-ledger cases. Require every executable test title to contain `@parity:<id>`.

- [ ] **Step 4: Verify the gate fails only for not-yet-executed IDs**

Run: `node --test tests/parity/manifest-gate.check.ts`

Expected: PASS for manifest structure; the release script reports missing execution artifacts without changing files.

- [ ] **Step 5: Commit**

Intent: `Make parity evidence executable instead of declarative`

Tested: duplicate IDs, missing IDs, unexplained N/A lanes, mandatory correction rows.

## Task 3: Replace the toolchain and isolate legacy code

**Files:**
- Move: `src/` to `legacy/src/`
- Move: `test/` to `legacy/test/`
- Move: `build/` to `legacy/build/`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Create: `tsconfig.tests.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `eslint.config.js`
- Create: `src/index.ts`
- Create: `tests/package/package-metadata.check.mjs`
- Create: `tests/unit/bootstrap.test.ts`

- [ ] **Step 1: Write package-name and SSR-entry tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import pkg from '../../package.json' with { type: 'json' };

test('publishes only tego-sheet', () => {
  assert.equal(pkg.name, 'tego-sheet');
  assert.equal(pkg.license, 'MIT');
  assert.deepEqual(pkg.peerDependencies, { react: '^19.2.7', 'react-dom': '^19.2.7' });
});
```

- [ ] **Step 2: Run tests and observe missing TypeScript tooling**

Run: `node --test tests/package/package-metadata.check.mjs`

Expected: FAIL because the package is still named `x-data-spreadsheet`.

- [ ] **Step 3: Move legacy directories and replace package metadata**

Set scripts to `test`, `test:unit`, `test:browser`, `test:visual`, `test:ssr`, `test:package`, `test:parity-gate`, `typecheck`, `lint`, `dev`, and `build`. Pin the versions in the plan header, set `type: module`, `sideEffects: ["**/*.css"]`, React peers, and Vite library exports. Exclude `legacy/` from `files`, TypeScript, lint, and Vite inputs.

Configure `npm test` as `vitest run`. Configure `test:parity-gate` to run the Node check plus the execution-artifact verifier, so Node-native gate files are not collected by Vitest. The parity gate is a separate release command until Task 24.

```json
{
  "dependencies": {},
  "peerDependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.61.1",
    "@testing-library/dom": "10.4.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "@types/node": "24.13.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@vitejs/plugin-react": "6.0.3",
    "@vitest/coverage-v8": "4.1.10",
    "eslint": "10.7.0",
    "eslint-plugin-react-hooks": "7.1.1",
    "eslint-plugin-react-refresh": "0.5.3",
    "jsdom": "29.1.1",
    "less": "4.6.7",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "typescript": "6.0.3",
    "typescript-eslint": "8.64.0",
    "vite": "8.1.4",
    "vite-plugin-dts": "5.0.3",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 4: Add a minimal SSR-safe public entry**

```ts
export {};
```

Create `tests/unit/bootstrap.test.ts`:

```ts
import { expect, it } from 'vitest';

it('imports the library entry without browser globals', async () => {
  await expect(import('../../src/index')).resolves.toEqual({});
});
```

Do not read `window`, `document`, `navigator`, Canvas, or ResizeObserver at module evaluation.

- [ ] **Step 5: Install and verify the foundation**

Run: `npm install && npm run typecheck && npm run lint && npm test && npm run build`

Expected: all foundation checks pass; the library build contains no legacy bundle.

- [ ] **Step 6: Commit**

Intent: `Establish a modern library boundary before porting behavior`

Tested: package metadata, typecheck, lint, unit bootstrap, SSR-safe entry, Vite build.

## Task 4: Define public schemas, coordinates, options, and errors

**Files:**
- Create: `src/core/types/json.ts`
- Create: `src/core/types/workbook.ts`
- Create: `src/core/types/coordinates.ts`
- Create: `src/core/types/changes.ts`
- Create: `src/core/types/validation.ts`
- Create: `src/core/types/options.ts`
- Create: `src/core/index.ts`
- Create: `src/core/errors/tego-sheet-error.ts`
- Create: `src/core/errors/tego-sheet-exception.ts`
- Modify: `src/index.ts`
- Create: `tests/types/public-api.test.tsx`
- Create: `tests/types/legacy-api-negative.test.ts`
- Create: `tests/unit/core/schema-validation.test.ts`

- [ ] **Step 1: Add type and runtime tests for the approved schema**

```ts
const address: CellAddress = { sheet: sheetId('sheet-1'), row: 0, column: 0 };
expect(address.row).toBe(0);
expect(() => assertCellPoint({ row: -1, column: 0 })).toThrow('row must be a non-negative integer');
```

Add negative compile assertions that reject `new Spreadsheet()`, `.on()`, `.change()`, and `window.x_spreadsheet`.

- [ ] **Step 2: Run type and schema tests**

Run: `npm run typecheck && npm run test:unit -- tests/unit/core/schema-validation.test.ts`

Expected: FAIL on missing exported types and validators.

- [ ] **Step 3: Implement the complete public types**

Define `JsonValue`, extension bags, `WorkbookInput`, canonical array output, all sheet/row/cell/style/validation/filter fields, branded `SheetId`, normalized coordinates, `WorkbookChange`, callback payloads, `SheetOptions`, slot actions, `TegoSheetError`, and `TegoSheetException` exactly as approved.

- [ ] **Step 4: Verify types and runtime guards**

Run: `npm run typecheck && npm run test:unit -- tests/unit/core/schema-validation.test.ts`

Expected: PASS, including readonly and legacy-negative tests.

- [ ] **Step 5: Commit**

Intent: `Make the React contract compile before runtime work begins`

Tested: public types, readonly payloads, branded IDs, runtime coordinate guards, legacy API absence.

## Task 5: Implement atomic workbook parsing and canonical serialization

**Files:**
- Create: `src/core/serialization/parse-workbook.ts`
- Create: `src/core/serialization/canonicalize-workbook.ts`
- Create: `src/core/serialization/serialize-workbook.ts`
- Create: `src/core/serialization/semantic-equal.ts`
- Create: `tests/unit/core/serialization.test.ts`
- Use: the eleven exact workbook fixtures created in Task 1

- [ ] **Step 1: Write failing round-trip tests**

```ts
it('@parity:workbook.canonical-roundtrip preserves sparse falsy extension data', () => {
  const parsed = parseWorkbook(fixture.input);
  expect(serializeWorkbook(parsed)).toEqual(fixture.canonical);
  expect(fixture.input).toEqual(before);
});
```

Cover empty object, empty array, uppercase A1, base-10 sparse keys, explicit falsy values, cached value, and recursive extension keys.

- [ ] **Step 2: Run the focused test**

Run: `npm run test:unit -- tests/unit/core/serialization.test.ts`

Expected: FAIL because `parseWorkbook` is missing.

- [ ] **Step 3: Implement clone, validation, canonicalization, egress, and equality**

```ts
export function semanticEqual(left: WorkbookInput, right: WorkbookInput): boolean {
  return canonicalKey(parseWorkbook(left)) === canonicalKey(parseWorkbook(right));
}
```

Invalid input must throw before exposing partial state. Output must always be a cloned array.

- [ ] **Step 4: Run serialization and schema suites**

Run: `npm run test:unit -- tests/unit/core/serialization.test.ts tests/unit/core/schema-validation.test.ts`

Expected: PASS for every schema-table fixture and invalid fixture.

- [ ] **Step 5: Commit**

Intent: `Stabilize workbook identity before adding mutable commands`

Tested: atomic invalid rejection, canonical output, semantic equality, input/output isolation.

## Task 6: Port A1 coordinates, ranges, formulas, and formats

**Files:**
- Create: `src/core/coordinates/{a1,ranges}.ts`
- Create: `src/core/formulas/tokenizer.ts`
- Create: `src/core/formulas/parser.ts`
- Create: `src/core/formulas/evaluator.ts`
- Create: `src/core/formulas/functions.ts`
- Create: `src/core/formulas/rendered-value.ts`
- Create: `src/core/model/styles.ts`
- Create: `tests/unit/core/{coordinates,formulas,formatting}.test.ts`

- [ ] **Step 1: Port legacy cases as failing Vitest tables**

```ts
it.each([
  ['A1', { row: 0, column: 0 }],
  ['B3', { row: 2, column: 1 }],
])('@parity:formulas.references parses %s', (input, expected) => {
  expect(parseA1(input)).toEqual(expected);
});
```

Add the eight formula functions, arithmetic, comparisons, ranges, reference shifts, cycles, and all approved formats.

- [ ] **Step 2: Run focused tests**

Run: `npm run test:unit -- tests/unit/core/coordinates.test.ts tests/unit/core/formulas.test.ts tests/unit/core/formatting.test.ts`

Expected: FAIL on missing parsers/evaluator.

- [ ] **Step 3: Implement pure parsers and evaluators**

Keep stored cells inert. Formula evaluation reads cells through a selector callback and returns a rendered value without mutating cache or workbook state.

- [ ] **Step 4: Verify parity tables**

Run: `npm run test:unit -- tests/unit/core/coordinates.test.ts tests/unit/core/formulas.test.ts tests/unit/core/formatting.test.ts`

Expected: PASS, including the observed legacy infix output `931-+*23+42/+`; the stale legacy expectation is not treated as supported behavior.

- [ ] **Step 5: Commit**

Intent: `Port deterministic spreadsheet primitives before stateful operations`

Tested: A1/ranges, formula functions, arithmetic, cycle behavior, formats and style deduplication.

## Task 7: Build workbook state, rows, columns, cells, styles, and merges

**Files:**
- Create: `src/core/model/workbook-state.ts`
- Create: `src/core/model/sheet-ids.ts`
- Create: `src/core/model/rows.ts`
- Create: `src/core/model/columns.ts`
- Create: `src/core/model/cells.ts`
- Create: `src/core/model/styles.ts`
- Create: `src/core/model/merges.ts`
- Create: `src/core/selectors/{workbook,cell,style}.ts`
- Create: `tests/unit/core/workbook-model.test.ts`

- [ ] **Step 1: Write immutable-update and ID tests**

```ts
it('keeps runtime IDs through internal rename and regenerates on replacement', () => {
  const state = WorkbookState.from([{ name: 'A' }]);
  const id = state.sheets[0].id;
  expect(state.rename(id, 'B').sheets[0].id).toBe(id);
  expect(state.replace([{ name: 'B' }]).sheets[0].id).not.toBe(id);
});
```

- [ ] **Step 2: Run the model test**

Run: `npm run test:unit -- tests/unit/core/workbook-model.test.ts`

Expected: FAIL because `WorkbookState` is missing.

- [ ] **Step 3: Implement focused immutable model helpers**

Preserve sparse indexes and extension fields. Keep runtime IDs and transient data outside serialized sheet JSON.

- [ ] **Step 4: Verify model and serialization together**

Run: `npm run test:unit -- tests/unit/core/workbook-model.test.ts tests/unit/core/serialization.test.ts`

Expected: PASS with no mutation of frozen inputs.

- [ ] **Step 5: Commit**

Intent: `Separate runtime identity from compatible workbook JSON`

Tested: model updates, sparse metadata, style/merge selectors, runtime sheet identity.

## Task 8: Define commands, controller, subscriptions, and history

**Files:**
- Create: `src/core/commands/workbook-command.ts`
- Create: `src/core/commands/command-result.ts`
- Create: `src/core/commands/validate-command.ts`
- Create: `src/core/commands/apply-command.ts`
- Create: `src/core/controller/workbook-controller.ts`
- Create: `src/core/controller/controller-checkpoint.ts`
- Create: `src/core/controller/history.ts`
- Create: `src/core/controller/subscription-store.ts`
- Create: `tests/unit/core/{workbook-controller,history}.test.ts`

- [ ] **Step 1: Write the command outcome tests**

```ts
expect(controller.dispatch({ type: 'set-cell-text', address, text: '' }, 'ref'))
  .toEqual({ status: 'noop' });
expect(events).toHaveLength(0);
```

Test one checkpoint per undoable command, redo invalidation, read-only rejection, synchronous publish, cloned queries, restore, replace, and silent replay.

- [ ] **Step 2: Run controller tests**

Run: `npm run test:unit -- tests/unit/core/workbook-controller.test.ts tests/unit/core/history.test.ts`

Expected: FAIL on missing controller.

- [ ] **Step 3: Implement the sole mutation boundary**

```ts
export type CommandOutcome<T = void> =
  | { readonly status: 'noop' }
  | { readonly status: 'committed'; readonly commit: CommandCommit<T> };
```

Operations receive state/context and return results; they never import the controller.

- [ ] **Step 4: Verify history and subscriptions**

Run: `npm run test:unit -- tests/unit/core/workbook-controller.test.ts tests/unit/core/history.test.ts`

Expected: PASS; silent restore/replay emits no document callbacks.

- [ ] **Step 5: Commit**

Intent: `Create one auditable mutation boundary for every spreadsheet action`

Tested: command validation, no-op silence, history, checkpoints, subscriptions, snapshot replay.

## Task 9: Implement cell, style, structure, merge, and sheet operations

**Files:**
- Create: `src/core/operations/{cell,style,structure,merge,sheet}.ts`
- Create: `tests/unit/core/{editing,formatting,structure,ranges,workbook}.test.ts`

- [ ] **Step 1: Add failing operation fixtures**

Cover edit commit/cancel inputs, every formatting control, row/column insert/delete/resize/hide, formula-reference shifts, merge conflicts, paint/clear format, add/delete/rename sheets, and empty workbook.

- [ ] **Step 2: Run focused operation tests**

Run: `npm run test:unit -- tests/unit/core/editing.test.ts tests/unit/core/formatting.test.ts tests/unit/core/structure.test.ts tests/unit/core/ranges.test.ts tests/unit/core/workbook.test.ts`

Expected: FAIL on unhandled command variants.

- [ ] **Step 3: Implement one operation module at a time**

Each operation returns a new state plus exact affected range/result. Preserve extension fields outside the replaced object and reject merge/structure conflicts atomically.

- [ ] **Step 4: Verify full operation group**

Run the command from Step 2.

Expected: PASS, including `@parity:correction.empty-workbook`.

- [ ] **Step 5: Commit**

Intent: `Restore document editing without reintroducing mutable proxies`

Tested: editing, formatting, structure, merges, sheet lifecycle, empty state.

## Task 10: Implement clipboard, autofill, filters, corrected sorting, and validation

**Files:**
- Create: `src/core/operations/{clipboard,autofill,filter,sort,validation}.ts`
- Create: `src/core/selectors/validation.ts`
- Create: `tests/unit/core/{clipboard,ranges,filters-sort,validation}.test.ts`

- [ ] **Step 1: Write failing transformation tests**

```ts
it('@parity:tools.sort-total-order keeps empties last descending', () => {
  const locale = { id: 'en-US', messages: {} };
  expect(sortValues(['10', 'A', '', '2'], 'desc', locale)).toEqual(['10', '2', 'A', '']);
});
```

Cover internal all/value/format paste, external matrices, cut, numeric/text/formula autofill, filter membership, stable ties, mixed values, every validation type/operator, hidden cells, and issue ordering.

- [ ] **Step 2: Run focused tests**

Run: `npm run test:unit -- tests/unit/core/clipboard.test.ts tests/unit/core/ranges.test.ts tests/unit/core/filters-sort.test.ts tests/unit/core/validation.test.ts`

Expected: FAIL on missing transforms.

- [ ] **Step 3: Implement pure transformations**

Use the approved numeric/text/empty total order, `Intl.Collator` options, stable original indexes, and workbook-wide validation ordered by sheet/row/column/rule.

- [ ] **Step 4: Verify correction rows**

Run the command from Step 2.

Expected: PASS for corrected sort and all-sheet validation.

- [ ] **Step 5: Commit**

Intent: `Make data tools deterministic and testable outside the browser`

Tested: clipboard transforms, autofill, filters, total sorting order, validation scope/order.

## Task 11: Implement viewport, selection, scroll, hit testing, and frozen geometry

**Files:**
- Create: `src/engine/ports.ts`
- Create: `src/engine/index.ts`
- Create: `src/engine/viewport/viewport-state.ts`
- Create: `src/engine/viewport/selection-state.ts`
- Create: `src/engine/viewport/scroll-state.ts`
- Create: `src/engine/geometry/grid-geometry.ts`
- Create: `src/engine/geometry/frozen-pane-geometry.ts`
- Create: `src/engine/geometry/hit-test.ts`
- Create: `src/engine/geometry/overlay-anchors.ts`
- Create: `tests/unit/engine/{geometry,frozen-panes,selection}.test.ts`

- [ ] **Step 1: Write geometry tests from legacy fixtures**

```ts
expect(hitTest({ x: 161, y: 76 }, metrics)).toEqual({ row: 2, column: 1 });
expect(frozenQuadrants({ row: 2, column: 1 }, viewport)).toHaveLength(4);
```

Cover hidden/resized structure, headers, scroll clipping, merges, selection normalization, and overlay anchors.

- [ ] **Step 2: Run engine geometry tests**

Run: `npm run test:unit -- tests/unit/engine/geometry.test.ts tests/unit/engine/frozen-panes.test.ts tests/unit/engine/selection.test.ts`

Expected: FAIL on missing geometry modules.

- [ ] **Step 3: Implement geometry as DOM-free TypeScript**

Accept readonly model selectors and viewport metrics; return values without calling the controller or renderer.

- [ ] **Step 4: Verify geometry**

Run the command from Step 2.

Expected: PASS with geometry tolerances expressed in CSS pixels.

- [ ] **Step 5: Commit**

Intent: `Stabilize grid coordinates before mounting Canvas or React overlays`

Tested: scrolling, hidden/resized geometry, freeze quadrants, selection, hit testing, anchors.

## Task 12: Port Canvas drawing, rendering, scheduling, and print layout

**Files:**
- Create: `src/engine/canvas/canvas-engine.ts`
- Create: `src/engine/canvas/render-scheduler.ts`
- Create: `src/engine/canvas/draw-context.ts`
- Create: `src/engine/canvas/grid-painter.ts`
- Create: `src/engine/canvas/cell-painter.ts`
- Create: `src/engine/canvas/header-painter.ts`
- Create: `src/engine/canvas/selection-painter.ts`
- Create: `src/engine/canvas/print-renderer.ts`
- Create: `tests/helpers/canvas-harness.ts`
- Create: `tests/helpers/deep-freeze.ts`
- Create: `tests/helpers/workbook-builders.ts`
- Create: `tests/unit/engine/{renderer-readonly,print-layout}.test.ts`

- [ ] **Step 1: Write frozen-snapshot rendering tests**

```ts
const snapshot = deepFreeze(buildStyledWorkbook());
engine.render(snapshot);
expect(snapshot).toEqual(before);
expect(canvas.width).toBe(1280 * 2);
```

Add grid, text, formats, borders, merges, frozen panes, selection, validation/filter marks, and DPR 1/2 cases.

- [ ] **Step 2: Run renderer tests**

Run: `npm run test:unit -- tests/unit/engine/renderer-readonly.test.ts tests/unit/engine/print-layout.test.ts`

Expected: FAIL on missing engine/painters.

- [ ] **Step 3: Implement painters behind `DrawContext`**

`CanvasEngine` receives snapshots and viewport state, schedules at most one RAF, cancels it on dispose, and never imports React or `WorkbookController`.

- [ ] **Step 4: Implement print pagination and printable correction**

Assert A3/A4/A5/B4/B5, portrait/landscape, page count, merge/style geometry, and blank content with retained geometry for `printable: false`.

- [ ] **Step 5: Verify Canvas and print suites**

Run the command from Step 2.

Expected: PASS, including `@parity:correction.printable-cells`.

- [ ] **Step 6: Commit**

Intent: `Preserve Canvas behavior behind a read-only rendering port`

Tested: DPR, painters, scheduling, formulas/styles/merges, print pagination and printable cells.

## Task 13: Implement browser interactions and resource ownership

**Files:**
- Create: `src/engine/interaction/interaction-manager.ts`
- Create: `src/engine/interaction/resource-registry.ts`
- Create: `src/engine/interaction/pointer.ts`
- Create: `src/engine/interaction/touch.ts`
- Create: `src/engine/interaction/keyboard.ts`
- Create: `src/engine/interaction/clipboard.ts`
- Create: `src/engine/interaction/resize.ts`
- Create: `tests/helpers/{clipboard-harness,resource-ledger}.ts`
- Create: `tests/unit/engine/{interaction,resource-ownership}.test.ts`

- [ ] **Step 1: Write the disposal-ledger test**

```ts
const ledger = new ResourceLedger();
const manager = createInteractionManager({ ledger, ports });
manager.dispose();
manager.dispose();
expect(ledger.current()).toEqual(ledger.baseline());
```

Cover pointer selection, keyboard navigation/edit commands, touch tap/double-tap/swipe, resize/hide, internal/external clipboard, and permission denial.

- [ ] **Step 2: Run interaction tests**

Run: `npm run test:unit -- tests/unit/engine/interaction.test.ts tests/unit/engine/resource-ownership.test.ts`

Expected: FAIL on missing manager and registry.

- [ ] **Step 3: Implement `ResourceRegistry` and interaction modules**

Every listener, observer, timer, RAF, subscription, and overlay callback registers one disposer. `dispose()` is idempotent and forbids later dispatch.

- [ ] **Step 4: Verify interaction and cleanup**

Run the command from Step 2.

Expected: PASS, including denied clipboard `CLIPBOARD_DENIED` and zero resource deltas.

- [ ] **Step 5: Commit**

Intent: `Give browser effects one explicit and disposable owner`

Tested: pointer, keyboard, touch, resize, clipboard, permission errors, idempotent cleanup.

## Task 14: Build React runtime ports, control-mode guards, and dispatcher

**Files:**
- Create: `src/react/tego-sheet.types.ts`
- Create: `src/react/adapters/{controller-external-store,event-dispatcher}.ts`
- Create: `src/react/hooks/use-controller-epoch.ts`
- Create: `tests/component/{initialization,mode-invariants,callbacks}.test.tsx`
- Create: `tests/helpers/render-sheet.tsx`

- [ ] **Step 1: Write React boundary tests with a fake runtime**

Test `value/defaultValue` exclusivity, mode switching, `{}` versus `[]`, callback order, no-op silence, UI error callbacks, ref exceptions, and latest callback functions.

- [ ] **Step 2: Run component tests**

Run: `npm run test:unit -- tests/component/initialization.test.tsx tests/component/mode-invariants.test.tsx tests/component/callbacks.test.tsx`

Expected: FAIL because React adapters are missing.

- [ ] **Step 3: Implement controller epoch and dispatcher**

Use `useSyncExternalStore` for snapshots. Order a committed cell edit as controller commit → controlled checkpoint record → `onChange` → `onCellEdit` → optional selection callback → paint schedule.

- [ ] **Step 4: Verify React boundary tests**

Run the command from Step 2.

Expected: PASS with isolated readonly callback values.

- [ ] **Step 5: Commit**

Intent: `Centralize React notifications before assembling the component`

Tested: initialization, control-mode guards, callback order, no-op and error channels.

## Task 15: Assemble uncontrolled `<TegoSheet>` and lifecycle cleanup

**Files:**
- Create: `src/react/tego-sheet.tsx`
- Create: `src/react/adapters/{engine-adapter,interaction-adapter}.ts`
- Create: `src/react/hooks/{use-canvas-engine,use-interaction-manager}.ts`
- Create: `tests/component/{uncontrolled-mode,strict-mode-cleanup,empty-workbook}.test.tsx`

- [ ] **Step 1: Write uncontrolled and Strict Mode tests**

```tsx
const { unmount } = render(
  <StrictMode><TegoSheet defaultValue={[{ name: 'A' }]} /></StrictMode>,
);
unmount();
expect(resourceLedger.delta()).toEqual(zeroResources);
```

- [ ] **Step 2: Run component tests**

Run: `npm run test:unit -- tests/component/uncontrolled-mode.test.tsx tests/component/strict-mode-cleanup.test.tsx tests/component/empty-workbook.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Mount runtime in layout effects**

Create engine after root/canvas refs, then interactions and engine subscription. Cleanup order is interactions → engine subscription → engine → controller subscription/controller epoch.

- [ ] **Step 4: Render the explicit empty state**

Editable `[]` exposes add-sheet; read-only `[]` exposes no mutation. `defaultValue` is read once and `getValue()` returns isolated canonical output.

- [ ] **Step 5: Verify uncontrolled lifecycle**

Run the command from Step 2.

Expected: PASS with balanced resources after repeated Strict Mode remounts.

- [ ] **Step 6: Commit**

Intent: `Mount the spreadsheet through React without leaking browser state`

Tested: uncontrolled mode, empty workbook, runtime order, Strict Mode disposal.

## Task 16: Implement optimistic controlled reconciliation

**Files:**
- Create: `src/react/control/controlled-reconciler.ts`
- Create: `src/react/control/pending-checkpoint.ts`
- Create: `src/react/control/classify-value-update.ts`
- Create: `src/react/hooks/use-controlled-workbook.ts`
- Create: `tests/component/{controlled-mode,controlled-reconciliation}.test.tsx`

- [ ] **Step 1: Write the complete reconciliation state-machine tests**

Cover same-reference retention, newest and intermediate acknowledgement, silent replay, explicit rollback, genuine replacement, regenerated sheet IDs, cleared history, invalid input dedupe, extension-key equality, sparse-index sensitivity, and replay-tail truncation.

- [ ] **Step 2: Run controlled tests**

Run: `npm run test:unit -- tests/component/controlled-mode.test.tsx tests/component/controlled-reconciliation.test.tsx`

Expected: FAIL on missing reconciler.

- [ ] **Step 3: Implement pure classification and pending checkpoints**

```ts
export type ValueUpdate =
  | { readonly kind: 'same-reference' }
  | { readonly kind: 'acknowledge'; readonly through: number }
  | { readonly kind: 'rollback' }
  | { readonly kind: 'replace'; readonly workbook: CanonicalWorkbook }
  | { readonly kind: 'invalid'; readonly error: TegoSheetError };
```

- [ ] **Step 4: Integrate silent restore/replay**

Acknowledgement replay emits no success callbacks. Genuine replacement clears history, pending commands, validation errors, and editor state while clipping viewport coordinates.

- [ ] **Step 5: Verify controlled mode**

Run the command from Step 2.

Expected: PASS for multiple pending commands and every replacement path.

- [ ] **Step 6: Commit**

Intent: `Make controlled React updates deterministic under optimistic editing`

Tested: acknowledgement, rollback, replacement, silent replay, invalid updates and ID invalidation.

## Task 17: Implement active sheet, ref handle, read-only, options, and slots

**Files:**
- Create: `src/react/hooks/{use-tego-sheet-handle,use-mount-option-warnings}.ts`
- Create: `src/react/tego-sheet-context.tsx`
- Create: `src/ui/slot-types.ts`
- Create: `tests/component/{imperative-handle,readonly,options-updates,toolbar-slot,sheet-tabs-slot}.test.tsx`

- [ ] **Step 1: Write public behavior tests**

Test every approved ref method, stable ref identity, isolated queries, stale `SheetId`, active-index clipping, callback-silent external replacement, read-only allowed/forbidden actions, live options, mount-only warnings, and default/false/custom slots.

- [ ] **Step 2: Run focused tests**

Run: `npm run test:unit -- tests/component/imperative-handle.test.tsx tests/component/readonly.test.tsx tests/component/options-updates.test.tsx tests/component/toolbar-slot.test.tsx tests/component/sheet-tabs-slot.test.tsx`

Expected: FAIL on missing hooks and slot hosts.

- [ ] **Step 3: Implement the stable handle and component-owned active sheet**

All document ref mutations use the dispatcher; `focus`, `print`, and layout use runtime ports; `activateSheet` changes viewport only and emits `onActiveSheetChange`.

- [ ] **Step 4: Implement option/slot rules**

Live options update immediately. Mount-only changes warn once in development and do not rewrite data. Disabled custom actions report `INVALID_COMMAND`.

- [ ] **Step 5: Verify public behavior**

Run the command from Step 2.

Expected: PASS for ref, read-only, options and slot contracts.

- [ ] **Step 6: Commit**

Intent: `Expose commands and composition without exposing mutable internals`

Tested: ref API, active sheet, read-only, options, toolbar/tab slots and errors.

## Task 18: Build the React editor, toolbar, tabs, menus, dialogs, and notifications

**Files:**
- Create: `src/ui/sheet-chrome.tsx`
- Create: `src/ui/empty-workbook.tsx`
- Create: `src/ui/toolbar/default-toolbar.tsx`
- Create: `src/ui/toolbar/toolbar-button.tsx`
- Create: `src/ui/toolbar/format-controls.tsx`
- Create: `src/ui/toolbar/border-controls.tsx`
- Create: `src/ui/tabs/sheet-tabs.tsx`
- Create: `src/ui/editor/cell-editor.tsx`
- Create: `src/ui/editor/formula-suggestions.tsx`
- Create: `src/ui/editor/date-editor.tsx`
- Create: `src/ui/menus/context-menu.tsx`
- Create: `src/ui/menus/filter-menu.tsx`
- Create: `src/ui/dialogs/validation-dialog.tsx`
- Create: `src/ui/dialogs/print-dialog.tsx`
- Create: `src/ui/notifications/notification-host.tsx`
- Create: `tests/component/{editing,errors,data-tools,localization}.test.tsx`

- [ ] **Step 1: Write edit transaction tests**

Type without workbook mutation; commit once on Enter/Tab/blur/pointer navigation; cancel on Escape; create one undo entry; emit the normative callback timeline.

- [ ] **Step 2: Run UI component tests**

Run: `npm run test:unit -- tests/component/editing.test.tsx tests/component/errors.test.tsx tests/component/data-tools.test.tsx`

Expected: FAIL because default UI components are missing.

- [ ] **Step 3: Implement editor and overlay anchors**

React owns textarea, formula suggestions, date editor, portals and focus. The engine supplies anchor rectangles and commands; UI never mutates workbook snapshots.

- [ ] **Step 4: Implement default chrome**

Add every approved formatting control, sheet tab operation, context-menu action, filter control, validation dialog, print dialog, and recoverable-error notification.

- [ ] **Step 5: Verify UI component tests**

Run the command from Step 2.

Expected: PASS with disabled read-only controls and no global listeners from UI components.

- [ ] **Step 6: Commit**

Intent: `Rebuild spreadsheet chrome as lifecycle-safe React components`

Tested: editor transactions, toolbar/tabs, menus, validation/filter/print dialogs, notifications.

## Task 19: Port locales, scoped styles, and the Vite demo

**Files:**
- Create: `src/locales/index.ts`
- Create: `src/locales/en.ts`
- Create: `src/locales/de.ts`
- Create: `src/locales/nl.ts`
- Create: `src/locales/zh-cn.ts`
- Create: `src/ui/styles/index.less`
- Create: `src/ui/styles/grid-overlays.less`
- Create: `src/ui/styles/toolbar.less`
- Create: `src/ui/styles/tabs.less`
- Create: `src/ui/styles/dialogs.less`
- Create: `demo/index.html`
- Create: `demo/src/{main,app}.tsx`
- Create: `tests/unit/core/localization.test.ts`
- Create: `tests/architecture/css-scoping.test.ts`

- [ ] **Step 1: Write locale and CSS-boundary tests**

Test English fallback, recursive partial overlays, live locale changes, isolation between two sheets, and reject selectors targeting `body`, `html`, or unscoped form elements.

- [ ] **Step 2: Run tests**

Run: `npm run test:unit -- tests/unit/core/localization.test.ts tests/architecture/css-scoping.test.ts`

Expected: FAIL on missing locale/style entries.

- [ ] **Step 3: Port locale dictionaries without globals**

Export `en`, `de`, `nl`, and `zhCN` values. Resolve messages per component instance with bundled English fallback.

- [ ] **Step 4: Port and scope visual styles**

Every selector begins with `.tego-sheet`; preserve legacy density, icons, overlay z-order, responsive toolbar behavior, and print preview.

- [ ] **Step 5: Build the demo**

Demonstrate uncontrolled, controlled, read-only, custom toolbar, locale switch, and legacy JSON load/export without importing internal modules.

- [ ] **Step 6: Verify**

Run: `npm run test:unit -- tests/unit/core/localization.test.ts tests/architecture/css-scoping.test.ts && npm run build`

Expected: PASS and demo build succeeds.

- [ ] **Step 7: Commit**

Intent: `Preserve spreadsheet presentation without polluting host applications`

Tested: locale fallback/isolation, CSS scoping, demo build.

## Task 20: Add cross-browser behavior tests

**Files:**
- Create: `tests/browser/harness/index.html`
- Create: `tests/browser/harness/vite.config.ts`
- Create: `tests/browser/harness/src/main.tsx`
- Create: `tests/browser/harness/src/scenario-host.tsx`
- Create: `tests/browser/{workbook,selection,editing,history,formatting,structure,ranges,view,clipboard,data-tools,formulas,print,input-desktop,input-touch,localization,errors}.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Configure six browser projects**

Create Chromium, Firefox, and WebKit desktop projects at 1280×720 plus touch projects at 390×844 with `hasTouch: true`, fixed locale, and fixed timezone.

- [ ] **Step 2: Add one failing browser scenario per parity row**

Use `@parity:` IDs for workbook, selection, editing, history, formatting, structure, ranges, view, clipboard, data tools, formulas, print, desktop input, touch input, localization, and errors.

- [ ] **Step 3: Run Chromium desktop first**

Run: `npm run test:browser -- --project=chromium-desktop`

Expected: failures identify missing browser wiring, not absent test IDs.

- [ ] **Step 4: Fix only browser integration defects**

Do not change core semantics without a focused core regression test. Add permission-denial clipboard injection and stop print assertions before native dialog chrome.

- [ ] **Step 5: Run the full browser matrix**

Run: `npm run test:browser`

Expected: PASS in all six projects.

- [ ] **Step 6: Commit**

Intent: `Prove visible behavior across the supported browser matrix`

Tested: all browser parity rows in Chromium, Firefox, WebKit, desktop and touch.

## Task 21: Add geometry-gated visual regression

**Files:**
- Create: `playwright.visual.config.ts`
- Create: `tests/visual/visual.spec.ts`
- Create: `tests/visual/masks.ts`
- Create: `tests/visual/fixtures/{default-workbook,styled-cells-borders,merged-cells,frozen-panes,resized-hidden-structure,editing-overlays-menus,validation-filter-ui,multiple-sheet-tabs,print-preview,localized-ui,touch-interaction}.ts`
- Create: `tests/visual/fonts/{NotoSans-Regular.woff2,OFL.txt}`

- [ ] **Step 1: Add geometry assertions before screenshots**

Assert cell, header, frozen-pane, selection, editor, and overlay rectangles within 1 CSS pixel at desktop/touch and DPR 1/2.

- [ ] **Step 2: Run visual tests without baselines**

Run: `npm run test:visual`

Expected: FAIL because approved snapshots do not exist; geometry assertions must already pass.

- [ ] **Step 3: Capture named fixtures**

Capture default workbook, styles/borders, merges, frozen panes, resized/hidden structure, editor/menu, validation/filter, sheet tabs, print preview, localized UI, and touch interaction. Use threshold `24/255`, max diff ratio `0.002`, and only named caret/native-scrollbar masks.

- [ ] **Step 4: Rerun visual tests**

Run: `npm run test:visual`

Expected: PASS at DPR 1 and 2 with bundled font loaded.

- [ ] **Step 5: Commit**

Intent: `Turn visual parity into a measured release contract`

Tested: all named fixtures, geometry bounds, masks and pixel thresholds.

## Task 22: Finalize package exports, SSR, consumer fixture, and migration docs

**Files:**
- Modify: `src/index.ts`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Create: `scripts/{test-package,test-ssr}.ts`
- Create: `tests/package/package-exports.test.ts`
- Create: `tests/package/packed-consumer.test.ts`
- Create: `tests/package/fixtures/node-esm/{package.json,index.mjs}`
- Create: `tests/package/fixtures/node-cjs/{package.json,index.cjs}`
- Create: `tests/ssr/public-entrypoints.test.ts`
- Create: `fixtures/consumer/package.json`
- Create: `fixtures/consumer/package-lock.json`
- Create: `fixtures/consumer/tsconfig.json`
- Create: `fixtures/consumer/vite.config.ts`
- Create: `fixtures/consumer/index.html`
- Create: `fixtures/consumer/src/main.tsx`
- Create: `fixtures/consumer/src/app.tsx`
- Modify: `readme.md`
- Create: `docs/migration-from-x-data-spreadsheet.md`

- [ ] **Step 1: Write export and SSR tests**

Assert only `TegoSheet`, approved types, styles, and locale subpaths resolve. Assert controller/engine/legacy/internal imports fail and no browser global exists during Node import.

- [ ] **Step 2: Run package tests before export completion**

Run: `npm run test:ssr && npm run test:package`

Expected: FAIL on missing packed exports and consumer fixture.

- [ ] **Step 3: Configure ESM, CJS, declarations, styles and locales**

Externalize React/ReactDOM. Export `.`, `./styles.css`, `./locales/en`, `./locales/de`, `./locales/nl`, `./locales/zh-cn`, and `./package.json`; block all other subpaths.

- [ ] **Step 4: Implement packed consumer verification**

Build, run `npm pack --json`, install the absolute tarball path in a temporary clean React + Vite fixture, then typecheck/build ESM and CJS consumers. Confirm React is a peer and absent from the bundle.

- [ ] **Step 5: Write API and migration documentation**

Document controlled/uncontrolled examples, callbacks, ref methods, slots, locales, stylesheet import, legacy JSON compatibility, the five correction-ledger differences, and the absence of the old constructor/global/emitter.

- [ ] **Step 6: Verify package gates**

Run: `npm run build && npm run test:ssr && npm run test:package`

Expected: PASS from packed artifacts, not workspace source.

- [ ] **Step 7: Commit**

Intent: `Make tego-sheet consumable without exposing implementation history`

Tested: ESM/CJS, declarations, CSS/locales, SSR, clean Vite consumer, migration docs.

## Task 23: Remove legacy code and prove architecture invariants

**Files:**
- Delete: `legacy/`
- Delete: `dist/`
- Delete: `docs/dist/`
- Delete: `docs/locale/`
- Delete: `docs/index.html`
- Delete: `docs/xspreadsheet.css`
- Delete: `docs/xspreadsheet.css.map`
- Delete: `docs/xspreadsheet.js`
- Delete: `docs/xspreadsheet.js.map`
- Delete: `docs/58eaeb4e52248a5c75936c6f4c33a370.svg`
- Delete: `docs/ece3e4fa05d4292823fdef970eaf1233.svg`
- Delete: `docs/demo.png`
- Create: `tests/architecture/{public-surface,core-purity,controller-boundary,renderer-readonly,browser-global-boundary,resource-ownership}.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Write boundary tests before deletion**

Fail on React/DOM imports from `core`, UI/React imports from `engine`, controller imports from painters/operations, public legacy symbols, unowned browser resources, module-scope browser globals, and generated bundle files committed outside approved fixtures.

- [ ] **Step 2: Run architecture tests**

Run: `npm run test:unit -- tests/architecture`

Expected: FAIL while legacy/generated trees remain.

- [ ] **Step 3: Remove legacy and obsolete generated artifacts**

Keep only source, approved parity fixtures, test snapshots, demo source, docs, and build outputs generated on demand.

- [ ] **Step 4: Run architecture and package tests**

Run: `npm run test:unit -- tests/architecture && npm run build && npm run test:package`

Expected: PASS with no legacy API or unpublished internal entry.

- [ ] **Step 5: Commit**

Intent: `Remove the obsolete runtime after parity evidence replaces it`

Tested: all nine architecture invariants, package exports, clean build from source.

## Task 24: Run the final parity and quality gate

**Files:**
- Modify only files identified by cleanup/review findings
- Produce: `.omx` verification and review evidence through the active Ultragoal workflow

- [ ] **Step 1: Run the complete pre-cleanup suite**

Run:

```sh
npm test
npm run test:browser
npm run test:visual
npm run test:ssr
npm run typecheck
npm run lint
npm run build
npm run test:package
npm run test:parity-gate
```

Expected: every command exits 0 and every manifest ID has passing evidence.

- [ ] **Step 2: Run the required anti-slop cleanup**

Use `$ai-slop-cleaner` only on changed implementation files. Preserve behavior with the complete passing suite and prefer deletion/reuse over new abstractions.

- [ ] **Step 3: Rerun the complete suite after cleanup**

Run the exact Step 1 command block again.

Expected: every command exits 0 with no snapshot or manifest drift.

- [ ] **Step 4: Audit every architecture invariant**

For each invariant, record the source design section, implementation file, automated assertion ID, and independent reviewer evidence. Any missing proof is a release blocker.

- [ ] **Step 5: Request independent reviews**

Run an independent code-reviewer and architect pass. Required final verdicts are `APPROVE` and `CLEAR`. Convert every non-clean finding into an Ultragoal review-blocker story before changing status.

- [ ] **Step 6: Commit final verified corrections**

Intent: `Close the rewrite only after parity and architecture are independently proven`

Tested: full post-cleanup suite, parity manifest, invariant audit, package consumer, independent reviews.

- [ ] **Step 7: Complete the Ultragoal aggregate**

Checkpoint every story with fresh goal snapshots, pass the final quality-gate JSON, then mark the aggregate Codex goal complete only when no required work remains.

## Spec coverage self-review map

| Design requirement | Plan tasks |
| --- | --- |
| React-only public API | 4, 14–18, 22–23 |
| Legacy JSON compatibility | 1, 4–7, 9–10 |
| Functional parity matrix | 2, 6, 9–13, 18–21 |
| Five approved corrections | 9, 10, 12–13 |
| Pure controller architecture | 7–10, 23 |
| Canvas read-only engine | 11–13, 23 |
| Controlled/uncontrolled semantics | 14–17 |
| Errors, validation, read-only | 10, 14, 17–18 |
| Slots and options | 17–18 |
| Lifecycle/resource ownership | 13, 15, 23 |
| Locales and scoped styles | 19, 21–22 |
| ESM/CJS/declarations/SSR | 3, 22 |
| Browser, touch, print, visual | 12–13, 20–21 |
| Package consumer and migration | 22 |
| Cleanup, invariants, review | 23–24 |

No design section is intentionally deferred outside this plan.
