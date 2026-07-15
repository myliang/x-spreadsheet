import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parityManifest } from '../parity/manifest';

const visualSpec = readFileSync('tests/visual/visual.spec.ts', 'utf8');
const visualParity = readFileSync('tests/visual/parity.ts', 'utf8');
const visualHarness = readFileSync('tests/visual/harness/src/main.tsx', 'utf8');
const visualMasks = readFileSync('tests/visual/masks.ts', 'utf8');
const visualCss = readFileSync('tests/visual/harness/src/visual.css', 'utf8');
const editingFixture = readFileSync('tests/visual/fixtures/editing-overlays-menus.ts', 'utf8');

const requiredVisualIds = parityManifest.flatMap(row => (
  'assertions' in row.visual ? row.visual.assertions : []
));

describe('visual regression release contract', () => {
  it('maps every declared visual parity assertion to an exact test title token', () => {
    for (const id of requiredVisualIds) {
      expect(`${visualSpec}\n${visualParity}`, `missing @parity:${id}`).toContain(`@parity:${id}`);
    }
    expect(new Set(requiredVisualIds)).toHaveLength(12);
  });

  it('captures actual generated print canvases and printable-cell evidence', () => {
    expect(visualHarness).toContain('data-visual-print-preview');
    expect(visualHarness).toContain('data-visual-print-page');
    expect(visualHarness).toContain('printSnapshot');
    expect(visualParity).toContain("@parity:correction.printable-cells-visual");
    expect(visualSpec).toContain("not.toContain('private')");
  });

  it('permits only dedicated narrow mask hooks', () => {
    expect(visualMasks).not.toMatch(/\.tego-sheet__/);
    expect(visualMasks).toContain('[data-visual-mask="blinking-caret"]');
    expect(visualMasks).toContain('[data-visual-mask="native-scrollbars"]');
  });

  it('masks only deterministic caret pixels declared by the editing fixture', () => {
    expect(visualCss).not.toMatch(/caret-color\s*:\s*transparent/);
    expect(editingFixture).toContain("masks: ['blinking-caret']");
    expect(visualHarness).toContain("data-visual-mask', 'blinking-caret'");
    expect(visualHarness).toContain("mask.style.width = '2px'");
    expect(visualHarness).toContain('mask.style.height = `${lineHeight}px`');
    expect(visualMasks).toContain("'blinking-caret': '[data-visual-mask=\"blinking-caret\"]'");
    expect(visualSpec).toContain("fill('Editing')");
    expect(visualSpec).toContain('setSelectionRange(0, 0)');
  });

  it('captures the real context menu opened through public pointer interaction', () => {
    expect(visualSpec).toContain("button: 'right'");
    expect(visualSpec).toContain("getByRole('menu', { name: 'Cell actions' })");
    expect(visualSpec).toContain("toHaveScreenshot('context-menu.png')");
  });
});
