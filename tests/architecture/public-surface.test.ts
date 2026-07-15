import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import * as publicApi from '../../src';

const root = resolve(import.meta.dirname, '../..');
const exactEvidence = new Set([
  'assets/material_common_sprite82.svg',
  'assets/sprite.svg',
  'docs/migration-from-x-data-spreadsheet.md',
  'tests/parity/legacy/baseline-meta.json',
  'tests/visual/fonts/NotoSans-Regular.woff2',
  'tests/visual/fonts/OFL.txt',
  'tests/visual/fonts/README.md',
]);

function isApprovedEvidence(file: string): boolean {
  return exactEvidence.has(file)
    || /^docs\/superpowers\/(?:[^/]+\/)*[^/]+\.md$/.test(file)
    || /^tests\/visual\/__snapshots__\/[^/]+\.png$/.test(file);
}

function isGeneratedOutput(file: string): boolean {
  if (isApprovedEvidence(file)) return false;
  const sourceOrFixture = /(?:^|\/)(?:src|fixtures?)(?:\/|$)/.test(file);
  return (
    /^(?:docs\/superpowers|tests\/parity\/legacy|tests\/visual\/(?:__snapshots__|fonts))(?:\/|$)/.test(file)
    || /(?:^|\/)(?:build|dist|demo-dist|coverage|playwright-report|test-results|reports?)(?:\/|$)/.test(file)
    || /\.map$/i.test(file)
    || /\.min\.(?:js|cjs|mjs|css)$/i.test(file)
    || /(?:^|\/)[a-f0-9]{8,}\.(?:js|cjs|mjs|css|map|svg|png|woff2?)$/i.test(file)
    || /(?:^|\/)(?:assets\/)?[^/]+-[a-z0-9_-]{8,}\.(?:js|css)$/i.test(file)
    || /^docs\/.*\.(?:html|js|cjs|mjs|css|map|svg|png)$/i.test(file)
    || (!sourceOrFixture && /(?:^|\/)[^/]*(?:bundle|chunk)[^/]*\.(?:js|cjs|mjs|css)$/i.test(file))
    || (!sourceOrFixture && /(?:^|\/)(?:main|index|app)(?:[-.][^/]*)?\.(?:js|cjs|mjs|css)$/i.test(file))
    || /(?:^|\/)(?:tego-sheet|xspreadsheet)(?:\.[a-z0-9-]+)?\.(?:js|cjs|mjs|css)$/i.test(file)
  );
}

it('classifies only exact architecture evidence as approved and rejects generated lookalikes', () => {
  const approved = [
    'docs/superpowers/plans/design.md',
    'tests/parity/legacy/baseline-meta.json',
    'tests/visual/__snapshots__/workbook.png',
    'tests/visual/fonts/NotoSans-Regular.woff2',
    'tests/visual/fonts/OFL.txt',
    'tests/visual/fonts/README.md',
    'docs/migration-from-x-data-spreadsheet.md',
    'assets/material_common_sprite82.svg',
    'assets/sprite.svg',
  ];
  const generated = [
    'docs/superpowers/bundle.js.map',
    'docs/superpowers/diagram.png',
    'tests/parity/legacy/other.test.cjs',
    'tests/parity/legacy/runtime.min.js',
    'tests/visual/__snapshots__/workbook.json',
    'tests/visual/fonts/Other.woff2',
    'tests/visual/fonts/generated-bundle.js',
    'build/main.js',
    'public/bundle.js',
  ];
  const source = ['src/index.ts', 'tests/fixtures/index.js'];

  for (const file of approved) {
    expect(isApprovedEvidence(file), file).toBe(true);
    expect(isGeneratedOutput(file), file).toBe(false);
  }
  for (const file of generated) {
    expect(isApprovedEvidence(file), file).toBe(false);
    expect(isGeneratedOutput(file), file).toBe(true);
  }
  for (const file of source) {
    expect(isApprovedEvidence(file), file).toBe(false);
    expect(isGeneratedOutput(file), file).toBe(false);
  }
});

function trackedFiles(): readonly string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

it('[ARCH-1] exposes only the React component and public exception at runtime', () => {
  expect(Object.keys(publicApi).sort()).toEqual(['TegoSheet', 'TegoSheetException']);

  const source = readFileSync(resolve(root, 'src/index.ts'), 'utf8');
  expect(source).not.toMatch(/export\s+\*|\b(?:DataProxy|WorkbookController|CanvasEngine|InteractionManager)\b/);
  expect(source).not.toMatch(/\b(?:xspreadsheet|spreadsheet)\s*[=:]|\.on\s*\(/i);
});

it('[ARCH-1] publishes only the approved package entry points', () => {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
    readonly exports?: Readonly<Record<string, unknown>>;
    readonly files?: readonly string[];
  };

  expect(Object.keys(packageJson.exports ?? {}).sort()).toEqual([
    '.',
    './locales/de',
    './locales/en',
    './locales/nl',
    './locales/zh-cn',
    './package.json',
    './styles.css',
  ]);
  expect(packageJson.files).toEqual(['dist', 'docs/migration-from-x-data-spreadsheet.md']);
});

it('keeps the removed root legacy tree visible to filesystem and ignore guards', () => {
  expect(existsSync(resolve(root, 'legacy'))).toBe(false);
  const ignored = spawnSync(
    'git',
    ['check-ignore', '-q', '--no-index', 'legacy/__architecture_probe__.ts'],
    { cwd: root },
  );
  expect(ignored.status, 'root legacy must not be hidden by .gitignore').toBe(1);
});

it('keeps the immutable legacy baseline without shipping recapture tooling', () => {
  const tracked = trackedFiles();
  expect(tracked.filter(file => file.startsWith('tests/parity/legacy/'))).toEqual([
    'tests/parity/legacy/baseline-meta.json',
  ]);
  for (const obsolete of [
    'npmx.txt',
    'scripts/capture-legacy-parity.cjs',
    'tests/parity/legacy/capture-atomicity.test.cjs',
  ]) expect(tracked, obsolete).not.toContain(obsolete);
  for (const file of tracked.filter(path => path.startsWith('docs/') && path.endsWith('.md'))) {
    expect(readFileSync(resolve(root, file), 'utf8'), file).not.toMatch(
      /capture-legacy-parity|capture-atomicity/,
    );
  }
});

it('does not track generated output outside the explicit evidence allowlist', () => {
  const tracked = trackedFiles();
  const generated = tracked.filter(isGeneratedOutput);

  for (const file of exactEvidence) expect(tracked, file).toContain(file);
  for (const prefix of ['docs/superpowers/', 'tests/visual/__snapshots__/']) {
    expect(tracked.some(file => file.startsWith(prefix) && isApprovedEvidence(file)), prefix).toBe(true);
  }
  expect(generated, 'tracked generated outputs').toEqual([]);
});
