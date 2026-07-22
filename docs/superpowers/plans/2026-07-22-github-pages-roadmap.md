# GitHub Pages Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a typed, tested Roadmap section to the existing demo and publish the built page from `docs/` so it is visible through GitHub Pages.

**Architecture:** Keep Roadmap content in one typed TypeScript data module, render it through a focused React section, and test both content integrity and rendered navigation. Build the existing Vite demo directly into `docs/` without deleting the Markdown Mini-RFCs because the upstream repository's Pages source is `master:/docs`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Testing Library, GitHub Pages legacy branch publishing.

## Global Constraints

- The product remains an embeddable React component and TypeScript SDK; the site is documentation, not a hosted spreadsheet service.
- Every Roadmap item is `planned`; status controls are non-interactive.
- Priority communicates dependency order, not release dates.
- Template printing and document generation is the primary product direction.
- Roadmap labels and detail links come from one typed data source.
- GitHub Pages must continue to publish from a committed `docs/index.html` and its generated assets.
- Do not stage `.superpowers/` visual-session artifacts.

---

### Task 1: Lock the Roadmap content contract

**Files:**
- Create: `tests/unit/demo/roadmap.test.ts`
- Create: `demo/src/roadmap.ts`

**Interfaces:**
- Produces: `RoadmapPhase`, `RoadmapItem`, `roadmapItems`, `roadmapPhases`, and `groupRoadmapItems()`.
- Consumes: the 33 display rows and design links from `docs/roadmap/README.md`.

- [x] **Step 1: Write the failing data-contract test**

```ts
import { describe, expect, it } from 'vitest';
import { groupRoadmapItems, roadmapItems, roadmapPhases } from '../../../demo/src/roadmap';

describe('GitHub Pages roadmap data', () => {
  it('contains the approved planned capabilities in dependency order', () => {
    expect(roadmapItems).toHaveLength(33);
    expect(roadmapItems.every(item => item.status === 'planned')).toBe(true);
    expect(roadmapItems[0]?.title).toBe('Workbook 2.0 typed document model');
    expect(roadmapItems.some(item => item.title === 'Safe scalar bindings, repeat rows and conditional ranges')).toBe(true);
  });

  it('groups every item under a declared phase with a local design link', () => {
    const groups = groupRoadmapItems();
    expect([...groups.keys()]).toEqual(roadmapPhases.map(phase => phase.id));
    expect([...groups.values()].flat()).toHaveLength(roadmapItems.length);
    expect(roadmapItems.every(item => item.designHref.startsWith('./roadmap/'))).toBe(true);
  });
});
```

- [x] **Step 2: Run the focused test and observe RED**

Run: `npm test -- tests/unit/demo/roadmap.test.ts`

Expected: FAIL because `demo/src/roadmap.ts` does not exist.

- [x] **Step 3: Implement the typed data module**

Define exact unions and immutable records:

```ts
export type RoadmapPhaseId = 0 | 1 | 2 | 3 | 4;
export type RoadmapStatus = 'planned';

export interface RoadmapItem {
  readonly id: string;
  readonly phase: RoadmapPhaseId;
  readonly title: string;
  readonly summary: string;
  readonly status: RoadmapStatus;
  readonly designHref: `./roadmap/${string}.md`;
}

export function groupRoadmapItems(): ReadonlyMap<RoadmapPhaseId, readonly RoadmapItem[]>;
```

Populate the module from all 33 rows in `docs/roadmap/README.md`, keeping phase and display order unchanged.

- [x] **Step 4: Run the focused test and observe GREEN**

Run: `npm test -- tests/unit/demo/roadmap.test.ts`

Expected: 2 tests pass.

---

### Task 2: Render an accessible Roadmap section

**Files:**
- Create: `tests/component/demo/roadmap-section.test.tsx`
- Create: `demo/src/roadmap-section.tsx`
- Modify: `demo/src/app.tsx`
- Modify: `demo/src/demo.css`

**Interfaces:**
- Consumes: `roadmapPhases` and `groupRoadmapItems()` from Task 1.
- Produces: `RoadmapSection(): JSX.Element`, mounted at `#roadmap` after the interactive component examples.

- [x] **Step 1: Write the failing rendering test**

```tsx
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoadmapSection } from '../../../demo/src/roadmap-section';

describe('RoadmapSection', () => {
  it('renders planned items and navigable design links without task controls', () => {
    render(<RoadmapSection />);
    const section = screen.getByRole('region', { name: 'Product roadmap' });
    const designLink = within(section).getByRole('link', {
      name: /Sheet, selection and range print targets/i,
    });
    expect(within(section).getAllByText('Planned')).toHaveLength(33);
    expect(designLink.getAttribute('href')).toBe('./roadmap/template-printing.md');
    expect(within(section).queryByRole('checkbox')).toBeNull();
  });
});
```

- [x] **Step 2: Run the component test and observe RED**

Run: `npm test -- tests/component/demo/roadmap-section.test.tsx`

Expected: FAIL because `demo/src/roadmap-section.tsx` does not exist.

- [x] **Step 3: Implement the section and navigation**

Render one semantic `section` with `aria-labelledby="roadmap-title"`, phase headings, planned status labels, summaries, and links to the committed Mini-RFC Markdown files. Add a header navigation link `<a href="#roadmap">Roadmap</a>` in `App` and mount `<RoadmapSection />` after the spreadsheet examples.

- [x] **Step 4: Add responsive styles**

Use the current neutral demo palette, a five-column desktop grid that collapses at 1100px and 620px, high-contrast focus styles, and status dots implemented with CSS rather than form controls. Set `.demo-page > * { min-width: 0; }` and contain `.demo-sheet-frame` overflow so the Canvas intrinsic width cannot widen the Roadmap track.

- [x] **Step 5: Run focused tests and observe GREEN**

Run: `npm test -- tests/unit/demo/roadmap.test.ts tests/component/demo/roadmap-section.test.tsx`

Expected: 3 tests pass with no warnings.

---

### Task 3: Produce the legacy GitHub Pages artifact

**Files:**
- Modify: `demo/vite.config.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Create through build: `docs/index.html`
- Create through build: `docs/assets/*`

**Interfaces:**
- Consumes: the complete demo application from Task 2.
- Produces: `npm run build:pages`, which typechecks the demo and writes a repository-relative Pages bundle into `docs/`.

- [x] **Step 1: Add a failing build assertion**

Add `scripts/test-pages-build.mjs` that exits nonzero unless `docs/index.html` exists, references `/x-spreadsheet/assets/`, includes no absolute localhost URL, contains exactly one generated JS/CSS pair, and references that exact pair. Run it before the build.

Run: `node scripts/test-pages-build.mjs`

Expected: FAIL because the new Pages bundle has not been generated.

- [x] **Step 2: Configure the Pages build**

Set Vite `base` to `/x-spreadsheet/`, set `build.outDir` to `../docs`, and keep `emptyOutDir: false` so Markdown RFCs survive. Add:

```json
"build:pages": "tsc --noEmit --project demo/tsconfig.json && node scripts/prepare-pages-build.mjs && vite build --mode pages --config demo/vite.config.ts && node scripts/test-pages-build.mjs"
```

The `pages` mode selects `/x-spreadsheet/`, `docs/` and `emptyOutDir: false`; the default production mode retains `/`, `demo-dist/` and `emptyOutDir: true` for `build:demo`. `scripts/prepare-pages-build.mjs` removes only `docs/index.html` and `docs/assets/` before Vite runs, preventing stale hashed bundles while preserving every Markdown RFC. Remove only `/docs/index.html` from `.gitignore`; keep obsolete legacy bundles ignored. Generated `docs/assets/` is tracked.

- [x] **Step 3: Build and observe GREEN**

Run: `npm run build:pages`

Expected: Vite succeeds and `test-pages-build.mjs` reports a valid `/x-spreadsheet/` Pages bundle.

---

### Task 4: Verify, publish, and prove the public page

**Files:**
- Modify: this plan's checkboxes as work completes.
- Publish: `agent/github-pages-roadmap` to `sealday/x-spreadsheet`.

**Interfaces:**
- Consumes: committed source, generated Pages bundle, authenticated `gh` and a fork remote.
- Produces: a public fork Pages URL and an upstream pull request.

- [x] **Step 1: Run repository verification**

Run:

```bash
npm test -- tests/unit/demo/roadmap.test.ts tests/component/demo/roadmap-section.test.tsx
npm run typecheck
npm run lint
npm run build:pages
git diff --check
```

Expected: all commands exit 0.

- [x] **Step 2: Commit only the intended site files**

Stage the plan, demo source, tests, build script/configuration, `.gitignore`, `package.json`, and generated `docs/index.html` plus `docs/assets/`. Do not stage `.superpowers/`.

- [x] **Step 3: Create the fork and push the branch**

Create `sealday/x-spreadsheet` as a fork if absent, add it as remote `fork`, and push `agent/github-pages-roadmap` with tracking.

- [x] **Step 4: Publish fork Pages**

Push the same verified commit to the fork's `master`, configure Pages source to `master:/docs`, wait for status `built`, and verify `https://sealday.github.io/x-spreadsheet/` plus `#roadmap` returns HTTP 200 and contains the Roadmap heading.

- [x] **Step 5: Open the upstream pull request**

Create a ready-for-review PR from `sealday:agent/github-pages-roadmap` to `myliang:master`, describing the typed Roadmap source, Pages artifact, tests, and the upstream Pages impact. The upstream site becomes visible after a maintainer merges because the authenticated account has READ-only access there.
