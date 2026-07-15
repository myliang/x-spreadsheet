# Task 17 Callback Ref Root Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the stable imperative handle focus the sheet root when a callback ref invokes `handle.focus()` immediately on first attachment, without exposing roots from uncommitted or aborted renders.

**Architecture:** Keep render-token commit authority unchanged and add a root-only patch operation that can update an already committed runtime without advancing the active-sheet decision version or committing a token. The host root callback patches a non-null node only when authority already has a committed runtime; `CommitAuthority` remains the fallback when the host ref attaches first, and a null host ref always deactivates authority.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library.

---

### Task 1: Lock callback-ref root timing

**Files:**
- Modify: `tests/component/imperative-handle.test.tsx`

- [x] **Step 1: Write failing immediate-focus regressions**

Add one parameterized regression for empty and non-empty workbooks whose callback ref invokes `handle.focus()` synchronously and records `document.activeElement`. Add StrictMode/unmount coverage proving the detached handle is inactive, plus an aborted-render case proving a pending host root never replaces the committed root.

```tsx
const callback = (handle: TegoSheetHandle | null) => {
  if (handle === null) return;
  handle.focus();
  focused.push(document.activeElement);
};
```

- [x] **Step 2: Run focused RED verification**

Run: `npm test -- --run tests/component/imperative-handle.test.tsx`

Expected: empty and non-empty immediate-focus assertions fail because the committed runtime still has `root: null` when the callback ref fires.

### Task 2: Patch only an already committed root

**Files:**
- Modify: `src/react/hooks/use-tego-sheet-handle.ts`
- Modify: `src/react/tego-sheet.tsx`

- [x] **Step 1: Add the root-only authority operation**

Extend `TegoSheetRuntimeAuthority` with a non-throwing operation that returns `false` when there is no active committed runtime and otherwise replaces only `root`.

```ts
patchRoot(root: HTMLDivElement): boolean {
  if (current === null || !current.isActive()) return false;
  current = { ...current, root };
  return true;
}
```

It must not add a render token or increment `activeDecisionVersion`.

- [x] **Step 2: Patch from the host callback without weakening abort safety**

For non-null nodes, set `rootRef.current` and call `runtimeAuthority.patchRoot(node)`. For null nodes, clear `rootRef.current` and call `runtimeAuthority.deactivate()`. Leave `CommitAuthority` reading `rootRef.current` so the opposite commit ordering remains correct.

```ts
const rootCallback = useCallback((node: HTMLDivElement | null) => {
  rootRef.current = node;
  if (node === null) runtimeAuthority.deactivate();
  else runtimeAuthority.patchRoot(node);
}, [runtimeAuthority]);
```

- [x] **Step 3: Run focused GREEN verification**

Run: `npm test -- --run tests/component/imperative-handle.test.tsx`

Expected: every imperative handle test passes, including immediate focus, StrictMode/unmount, and aborted-render authority isolation.

### Task 3: Verify and append a Lore commit

**Files:**
- Modify: `docs/superpowers/plans/2026-07-15-task17-callback-ref-root.md`

- [x] **Step 1: Run full verification**

Run: `npm test && npm run test:unit && npm run test:ssr && npm run test:package && npm run typecheck && npm run lint && npm run build && git diff --check`

Expected: all commands exit zero with no test failures, type errors, lint warnings, build failures, or whitespace errors.

- [x] **Step 2: Review scope and create a new Lore commit**

Confirm HEAD is `78eef610cb167459e584581047c494e8c363d620`, stage only this plan, the authority/root implementation, and imperative-handle regressions, then commit without amend.

Commit intent: `Keep the imperative root current at ref attachment`
