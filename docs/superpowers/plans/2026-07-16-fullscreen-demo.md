# tego-sheet Fullscreen Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-section showcase with one viewport-filling `TegoSheet` workbench that exposes compact controls for testing the public React API.

**Architecture:** Keep all preview-only state inside the demo. Extract deterministic JSON/event helpers into a small module, render one `TegoSheet` instance from `App`, and use a collapsible control header above a flex-sized sheet workspace. Test pure state transitions directly and mock the sheet boundary in component tests so the demo controls are verified independently of Canvas behavior already covered elsewhere.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, LESS/CSS.

---

## File map

- Create `demo/src/workbench-model.ts`: example workbook cloning, JSON parsing/formatting, and bounded event-log helpers.
- Modify `demo/src/app.tsx`: one-sheet fullscreen workbench and public-API test controls.
- Modify `demo/src/demo.css`: viewport layout, collapsible panels, responsive controls, and accessible states.
- Modify `vitest.config.ts`: resolve demo package aliases during component tests.
- Create `tests/unit/demo/workbench-model.test.ts`: deterministic helper coverage.
- Create `tests/component/demo-app.test.tsx`: preview control/data-flow coverage with a mocked `TegoSheet` boundary.

### Task 1: Lock the workbench state contracts

**Files:**
- Create: `tests/unit/demo/workbench-model.test.ts`
- Create: `demo/src/workbench-model.ts`

- [ ] **Step 1: Write failing helper tests**

Add tests that prove JSON parsing preserves legacy workbook data, invalid JSON throws without changing an existing value, example cloning returns independent objects, and event logs retain only the newest 12 entries:

```ts
import { describe, expect, it } from 'vitest';
import {
  PREVIEW_EVENT_LIMIT,
  appendPreviewEvent,
  cloneExampleWorkbook,
  formatWorkbookJson,
  parseWorkbookJson,
} from '../../../demo/src/workbench-model';

describe('fullscreen demo workbench model', () => {
  it('round-trips the legacy workbook JSON shape', () => {
    const workbook = cloneExampleWorkbook();
    expect(parseWorkbookJson(formatWorkbookJson(workbook))).toEqual(workbook);
  });

  it('returns independent example workbooks', () => {
    const first = cloneExampleWorkbook();
    const second = cloneExampleWorkbook();
    first[0]!.name = 'Changed';
    expect(second[0]!.name).toBe('Budget');
  });

  it('rejects invalid JSON before callers replace the active workbook', () => {
    expect(() => parseWorkbookJson('{broken')).toThrow(SyntaxError);
  });

  it('keeps the newest bounded event history', () => {
    const entries = Array.from({ length: PREVIEW_EVENT_LIMIT + 3 }, (_, index) => `event-${index}`)
      .reduce((logs, message) => appendPreviewEvent(logs, message), [] as string[]);
    expect(entries).toHaveLength(PREVIEW_EVENT_LIMIT);
    expect(entries[0]).toBe(`event-${PREVIEW_EVENT_LIMIT + 2}`);
    expect(entries.at(-1)).toBe('event-3');
  });
});
```

- [ ] **Step 2: Run the focused tests and confirm red state**

Run: `npx vitest run --project unit tests/unit/demo/workbench-model.test.ts`

Expected: FAIL because `demo/src/workbench-model.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Create the example workbook as immutable module data and export:

```ts
export const PREVIEW_EVENT_LIMIT = 12;
export function cloneExampleWorkbook(): WorkbookData;
export function parseWorkbookJson(source: string): WorkbookInput;
export function formatWorkbookJson(workbook: WorkbookInput): string;
export function appendPreviewEvent(logs: readonly string[], message: string): string[];
```

Use JSON serialization for demo-only cloning/formatting, `JSON.parse` for validation, and `[message, ...logs].slice(0, PREVIEW_EVENT_LIMIT)` for bounded logs.

- [ ] **Step 4: Run the focused tests and confirm green state**

Run: `npx vitest run --project unit tests/unit/demo/workbench-model.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Commit the state contract**

```bash
git add demo/src/workbench-model.ts tests/unit/demo/workbench-model.test.ts
git commit -m "Make fullscreen preview state deterministic" -m "Constraint: Preview resets and imports must not mutate shared example data.\nConfidence: high\nScope-risk: narrow\nTested: focused workbench-model unit tests."
```

### Task 2: Build the single-sheet workbench with TDD

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/component/demo-app.test.tsx`
- Modify: `demo/src/app.tsx`

- [ ] **Step 1: Add demo aliases to the test resolver**

Add the same ordered aliases used by `demo/vite.config.ts`: exact locale and style subpaths first, then the `tego-sheet` root alias. This lets tests import the demo without requiring a prebuilt `dist` directory.

- [ ] **Step 2: Write failing workbench component tests**

Mock `tego-sheet` with a `forwardRef` boundary that renders the received mode/read-only/locale props and exposes `getValue()`. Use this concrete interaction shape:

```ts
it('renders one boundary and remounts when the mode changes', () => {
  render(<App />);
  expect(screen.getAllByTestId('sheet-boundary')).toHaveLength(1);
  expect(screen.getByTestId('sheet-boundary')).toHaveAttribute('data-mode', 'uncontrolled');
  fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'controlled' } });
  expect(screen.getByTestId('sheet-boundary')).toHaveAttribute('data-mode', 'controlled');
  expect(sheetMounts).toBe(2);
});

it('toggles read-only and Simplified Chinese locale', () => {
  render(<App />);
  fireEvent.click(screen.getByLabelText('Read only'));
  fireEvent.change(screen.getByLabelText('Locale'), { target: { value: 'zh-CN' } });
  expect(screen.getByTestId('sheet-boundary')).toHaveAttribute('data-read-only', 'true');
  expect(screen.getByTestId('sheet-boundary')).toHaveAttribute('data-locale', 'zh-CN');
});

it('rejects invalid JSON without remounting or replacing the workbook', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Show JSON' }));
  fireEvent.change(screen.getByLabelText('Workbook JSON'), { target: { value: '{broken' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid workbook JSON');
  expect(sheetMounts).toBe(1);
  expect(latestSheetProps.defaultValue).toEqual(cloneExampleWorkbook());
});

it('imports, resets, exports, and bounds newest-first events', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Show JSON' }));
  fireEvent.change(screen.getByLabelText('Workbook JSON'), {
    target: { value: '[{"name":"Imported"}]' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));
  expect(latestSheetProps.defaultValue).toEqual([{ name: 'Imported' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Reset workbook' }));
  expect(latestSheetProps.defaultValue).toEqual(cloneExampleWorkbook());
  fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
  expect(screen.getByLabelText('Workbook JSON')).toHaveValue(formatWorkbookJson(exportedWorkbook));
  act(() => {
    for (let index = 0; index < PREVIEW_EVENT_LIMIT + 2; index += 1) {
      latestSheetProps.onSelectionChange?.({
        sheet: 'sheet-1' as SheetId,
        range: {
          start: { row: index, column: 0 },
          end: { row: index, column: 0 },
        },
        active: { row: index, column: 0 },
      });
    }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Show events' }));
  expect(screen.getByRole('log').children).toHaveLength(PREVIEW_EVENT_LIMIT);
});
```

Use accessible labels and roles for every interaction. Assert mode switches by checking the mocked boundary is remounted with `value` or `defaultValue`, rather than inspecting demo implementation state.

- [ ] **Step 3: Run the component test and confirm red state**

Run: `npx vitest run --project component tests/component/demo-app.test.tsx`

Expected: FAIL because the existing demo renders four sheet instances and lacks the fullscreen controls.

- [ ] **Step 4: Implement the workbench component**

Replace the showcase sections in `demo/src/app.tsx` with:

```tsx
<main className="preview-shell">
  <header className="preview-controls" aria-label="Preview controls">
    <strong>tego-sheet preview</strong>
    <label>Mode<select aria-label="Mode" value={mode} onChange={handleModeChange}><option value="uncontrolled">Uncontrolled</option><option value="controlled">Controlled</option></select></label>
    <label><input aria-label="Read only" type="checkbox" checked={readOnly} onChange={handleReadOnlyChange} />Read only</label>
    <label>Locale<select aria-label="Locale" value={localeCode} onChange={handleLocaleChange}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label>
    <button type="button" onClick={resetWorkbook}>Reset workbook</button>
    <button type="button" onClick={exportWorkbook}>Export JSON</button>
    <button type="button" aria-expanded={jsonOpen} onClick={() => setJsonOpen(value => !value)}>{jsonOpen ? 'Hide JSON' : 'Show JSON'}</button>
    <button type="button" aria-expanded={eventsOpen} onClick={() => setEventsOpen(value => !value)}>{eventsOpen ? 'Hide events' : 'Show events'}</button>
  </header>
  <section className="preview-workspace" aria-label="Spreadsheet preview">
    <TegoSheet key={mountEpoch} ref={sheetRef} {...sheetProps} />
  </section>
</main>
```

Maintain `mode`, `readOnly`, `locale`, `workbook`, `json`, `mountEpoch`, `controlsCollapsed`, panel visibility, error text, and bounded events in React state. Use only `TegoSheet` props/callbacks and `TegoSheetHandle.getValue()`. Increment `mountEpoch` for mode changes, reset, and valid JSON imports. Keep invalid JSON local to the panel and leave `workbook` and `mountEpoch` unchanged.

The expanded controls must expose:

- `Mode` select: Controlled / Uncontrolled.
- `Read only` checkbox.
- `Locale` select: English / 简体中文.
- `Reset workbook`, `Import JSON`, and `Export JSON` buttons.
- `JSON` and `Events` disclosure buttons.
- A `Collapse controls` / `Expand controls` disclosure that retains the title, current mode, workbook status, and expand action while hiding secondary controls.
- Workbook JSON textbox, inline `role="alert"` error, and `role="log"` event list.

- [ ] **Step 5: Run the component test and confirm green state**

Run: `npx vitest run --project component tests/component/demo-app.test.tsx`

Expected: all fullscreen demo component tests pass.

- [ ] **Step 6: Commit the workbench behavior**

```bash
git add vitest.config.ts demo/src/app.tsx tests/component/demo-app.test.tsx
git commit -m "Expose one testable fullscreen React workbench" -m "Constraint: The demo may exercise only the public React component and ref surface.\nConfidence: high\nScope-risk: narrow\nTested: focused demo component tests."
```

### Task 3: Make the preview fill the viewport

**Files:**
- Modify: `demo/src/demo.css`
- Test: `tests/component/demo-app.test.tsx`

- [ ] **Step 1: Add layout assertions before CSS changes**

Assert the shell, controls, workspace, JSON panel, and events panel use stable class names and that panel controls expose `aria-expanded`. The component test should fail until the new layout markup and state are complete.

- [ ] **Step 2: Implement the viewport layout**

Use the following layout contract:

```css
html, body, #root { width: 100%; height: 100%; overflow: hidden; }
.preview-shell { width: 100%; height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.preview-workspace { min-width: 0; min-height: 0; overflow: hidden; }
.preview-workspace > * { width: 100%; height: 100%; }
```

Style the controls as a compact wrapping toolbar, give dialogs/panels bounded sizes and internal scrolling, preserve visible focus states, and collapse secondary labels below 720px without introducing page scrolling.

- [ ] **Step 3: Run demo type and build checks**

Run: `npm run build:demo`

Expected: TypeScript passes and Vite emits `demo-dist` successfully.

- [ ] **Step 4: Commit the fullscreen layout**

```bash
git add demo/src/demo.css tests/component/demo-app.test.tsx
git commit -m "Let the spreadsheet own the remaining viewport" -m "Constraint: The page itself must never scroll while the sheet retains internal scrolling.\nConfidence: high\nScope-risk: narrow\nTested: demo component tests and demo production build."
```

### Task 4: Verify the completed local preview

**Files:**
- Modify only if verification finds a defect in the files above.

- [ ] **Step 1: Run focused and static verification**

Run:

```bash
npx vitest run --project unit tests/unit/demo/workbench-model.test.ts
npx vitest run --project component tests/component/demo-app.test.tsx
npm run typecheck
npm run lint
npm run build:demo
```

Expected: every command exits 0.

- [ ] **Step 2: Run the complete unit suite with bounded concurrency**

Run: `npm test -- --maxWorkers=1`

Expected: 755 tests pass with only the one release-evidence contract skip.

- [ ] **Step 3: Verify the live Vite page in the in-app browser**

Keep `npm run dev -- --host 127.0.0.1` running, reload the open local URL, and verify:

- The page has no outer vertical scrollbar.
- Exactly one sheet toolbar and one sheet tablist are rendered.
- The sheet workspace fills the viewport below the controls.
- Mode, read-only, locale, reset, valid/invalid import, export, JSON disclosure, and event disclosure work.
- Editing a cell, formatting it, undoing/redoing, adding a sheet, and changing locale remain operational.
- The browser console contains no unhandled errors.

- [ ] **Step 4: Record final verification**

If verification required no source changes, report the existing implementation commits. If a defect was fixed, commit only the minimal affected files with a Lore-format message and rerun the failed verification command plus the complete unit suite.
