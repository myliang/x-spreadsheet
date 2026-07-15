# Task 17 Authority Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Task 17 review findings around same-commit read-only enforcement, reentrant active-sheet decisions, disabled toolbar state, print errors, and render-phase slot actions.

**Architecture:** Replace the split handle/slot authority with one committed runtime authority. Each render receives an identity token; only tokens recorded by the pre-slot `CommitAuthority` may invoke public slot actions, while any previously committed token routes to the latest runtime. The same authority owns active-sheet decision versions and compare-and-set post-dispatch updates. `CommitAuthority` commits callbacks, controller read-only state, engine interaction state, handle runtime, and the current render token in that order.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library.

---

### Task 1: Lock same-commit and render-abort behavior

**Files:**
- Modify: `tests/component/readonly.test.tsx`
- Modify: `tests/component/toolbar-slot.test.tsx`

- [x] **Step 1: Add failing same-commit read-only tests**

Add custom slot children whose layout effects call a retained public ref, a retained toolbar action, and dispatch keyboard input during `false -> true`; assert no workbook mutation and exactly one `INVALID_COMMAND` for each forced public command. Add the inverse `true -> false` case and assert the command succeeds in the same commit.

```tsx
function LayoutCommand({ run, enabled }: { run: () => void; enabled: boolean }) {
  useLayoutEffect(() => {
    if (enabled) run();
  }, [enabled, run]);
  return null;
}
```

- [x] **Step 2: Add failing render-phase tests**

Call `props.execute({ type: 'set-style', patch: { color: 'aborted' } })` directly from a renderer in a render that suspends and in a render that throws into an error boundary. Assert the committed handle value, `onChange`, and `onError` are unchanged.

- [x] **Step 3: Run focused RED verification**

Run: `npm run test:unit -- tests/component/readonly.test.tsx tests/component/toolbar-slot.test.tsx`

Expected: failures show the old controller/handle authority is visible to child layout effects and render-time `execute` mutates the committed controller.

### Task 2: Lock active-sheet decision CAS behavior

**Files:**
- Modify: `tests/component/sheet-tabs-slot.test.tsx`
- Modify: `tests/component/imperative-handle.test.tsx`

- [x] **Step 1: Add failing nested decision tests**

Cover tab `add` and `delete` where synchronous `onChange` calls `activate`, replaces a controlled workbook, or unmounts the sheet. The post-dispatch default active selection must apply only when controller identity, epoch activity, and decision version still match.

```tsx
onChange={() => {
  retainedTabs.activate(explicitSheet);
}}
```

- [x] **Step 2: Run focused RED verification**

Run: `npm run test:unit -- tests/component/sheet-tabs-slot.test.tsx tests/component/imperative-handle.test.tsx`

Expected: the old tab post-dispatch `setActiveSheet` overwrites at least one newer decision.

### Task 3: Lock disabled toolbar facts and print failures

**Files:**
- Modify: `tests/component/toolbar-slot.test.tsx`
- Modify: `tests/component/imperative-handle.test.tsx`

- [x] **Step 1: Add failing disabled-state tests**

Assert disabled state for a single-cell merge, partially overlapping merge, freeze at A1, clear-filter/sort without an autofilter, sort outside the filter columns, and row/column deletions that split merges. Force every disabled action and assert one current `onError` call and zero change notifications per invocation.

- [x] **Step 2: Add failing ref-print tests**

Mock `window.print` to throw. Assert `ref.print()` reports `PRINT_FAILED` through the latest `onError`; then make `onError` throw and assert the consumer exception propagates.

- [x] **Step 3: Run focused RED verification**

Run: `npm run test:unit -- tests/component/toolbar-slot.test.tsx tests/component/imperative-handle.test.tsx`

Expected: missing disabled facts and direct ref print exception fail their assertions.

### Task 4: Implement one pre-slot committed authority

**Files:**
- Modify: `src/react/hooks/use-tego-sheet-handle.ts`
- Modify: `src/react/tego-sheet.tsx`
- Modify: `src/react/hooks/use-controller-epoch.ts`
- Modify: `src/react/adapters/engine-adapter.ts`
- Modify: `src/core/operations/structure.ts`
- Modify: `src/react/adapters/event-dispatcher.ts`

- [x] **Step 1: Expose the shared runtime authority from the handle hook**

The authority stores the latest committed runtime, a `WeakSet<object>` of committed render tokens, and an active-decision version. `commit(token, runtime)` advances the version when controller identity or external active sheet changes. `activate` and `deactivate` advance the version; `compareAndSet` additionally checks controller identity and `isActive()`.

```ts
export interface TegoSheetRuntimeAuthority {
  commit(token: object, runtime: TegoSheetHandleRuntime): void;
  committed(token: object): TegoSheetHandleRuntime | null;
  capture(): RuntimeCapture;
  compareAndSetActiveSheet(capture: RuntimeCapture, sheet: SheetId | null): boolean;
  activate(sheet: SheetId | null): void;
  deactivate(): void;
}
```

- [x] **Step 2: Commit all live authority before slot layout effects**

`CommitAuthority` must perform: latest callbacks, `controller.setReadOnly`, controller-store refresh, a lightweight live engine read-only update for interaction snapshots, handle/runtime commit, then render-token activation. Build toolbar and tab callbacks per render so uncommitted tokens are inert and committed stale tokens route to the latest runtime.

- [x] **Step 3: Route tab post-dispatch decisions through shared CAS**

Capture before dispatch and use `compareAndSetActiveSheet` after add/delete. Explicit tab/ref activate and unmount must advance the shared decision version.

- [x] **Step 4: Compute only payload-independent disabled facts**

Use merge range intersection, filter reference range, A1 active position, and the same merge-splitting predicate used by structural validation. Leave style/filter/validation payload correctness to command validation.

- [x] **Step 5: Share print error reporting**

Both toolbar and ref print call one helper that catches only `window.print`, reports `PRINT_FAILED` through the committed dispatcher, and allows exceptions thrown by consumer `onError` to propagate.

- [x] **Step 6: Run focused GREEN verification**

Run: `npm run test:unit -- tests/component/readonly.test.tsx tests/component/toolbar-slot.test.tsx tests/component/sheet-tabs-slot.test.tsx tests/component/imperative-handle.test.tsx`

Expected: all Task 17 review regressions pass.

### Task 5: Verify and commit

**Files:**
- Modify: `tests/package/package-metadata.check.mjs` only if a new emitted declaration is intentionally packaged.

- [x] **Step 1: Run complete verification**

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run test:ssr && npm run test:package && npm run build && git diff --check`

Expected: every command exits zero with no warnings.

- [x] **Step 2: Review staged scope**

Run: `git status --short && git diff --stat && git diff --check`

Expected: only Task 17 hardening code, tests, package declaration whitelist if needed, and this plan are changed.

- [x] **Step 3: Create a new Lore commit**

Commit intent: `Make committed authority the only path to workbook mutation`

The commit must retain `ff18d00` as its parent and include verification/risk trailers.
