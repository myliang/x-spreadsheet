import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  defaultParityEvidencePaths,
  parityEvidencePaths,
} from '../../scripts/reporters/parity-evidence-paths.mjs';

const root = resolve(import.meta.dirname, '../..');

it('uses one stable default artifact per execution lane', () => {
  expect(parityEvidencePaths).toEqual({
    browser: 'test-results/parity/browser.ndjson',
    component: 'test-results/parity/component.ndjson',
    unit: 'test-results/parity/unit.ndjson',
    visual: 'test-results/parity/visual.ndjson',
  });
  expect(defaultParityEvidencePaths).toEqual([
    parityEvidencePaths.unit,
    parityEvidencePaths.component,
    parityEvidencePaths.browser,
    parityEvidencePaths.visual,
  ]);
});

it('connects actual Vitest and Playwright runs to the evidence reporters without replacing list output', () => {
  const vitest = readFileSync(resolve(root, 'vitest.config.ts'), 'utf8');
  const browser = readFileSync(resolve(root, 'playwright.config.ts'), 'utf8');
  const visual = readFileSync(resolve(root, 'playwright.visual.config.ts'), 'utf8');
  const gate = readFileSync(resolve(root, 'scripts/test-parity-gate.mjs'), 'utf8');

  expect(vitest).toMatch(/reporters:\s*\['default',\s*new VitestParityEvidenceReporter/);
  expect(vitest).toContain('releaseOnly: true');
  expect(browser).toMatch(/reporter:\s*\[[\s\S]*?\['list'\],[\s\S]*?playwright-parity-evidence\.ts/);
  expect(browser).toContain("lane: 'browser'");
  expect(browser).toContain('releaseOnly: true');
  expect(visual).toMatch(/reporter:\s*\[[\s\S]*?\['list'\],[\s\S]*?playwright-parity-evidence\.ts/);
  expect(visual).toContain("lane: 'visual'");
  expect(visual).toContain('releaseOnly: true');
  expect(gate).toContain('defaultParityEvidencePaths');
  expect(gate).not.toContain("['test-results/parity-evidence.ndjson']");
});

it('provides one portable release command that owns all four parity lanes and the gate', () => {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  expect(packageJson.scripts['test:parity-release']).toBe('node scripts/run-parity-release.mjs');
});
