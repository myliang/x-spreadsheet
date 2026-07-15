import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import * as publicApi from '../../src';

const root = resolve(import.meta.dirname, '../..');

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

it('does not track generated output outside the explicit evidence allowlist', () => {
  const approvedPrefixes = [
    'docs/superpowers/',
    'tests/parity/legacy/',
    'tests/visual/__snapshots__/',
    'tests/visual/fonts/',
  ];
  const approvedFiles = new Set([
    'docs/migration-from-x-data-spreadsheet.md',
    'assets/material_common_sprite82.svg',
    'assets/sprite.svg',
  ]);
  const approved = (file: string): boolean => (
    approvedFiles.has(file) || approvedPrefixes.some(prefix => file.startsWith(prefix))
  );
  const generated = trackedFiles().filter(file => !approved(file) && (
    /^(?:dist|demo-dist)(?:\/|$)/.test(file)
    || /^docs\/(?:dist|locale)(?:\/|$)/.test(file)
    || /^docs\/.*\.(?:html|js|css|map|svg|png)$/.test(file)
    || /\.map$/.test(file)
    || /(?:^|\/)[a-f0-9]{8,}\.(?:js|css|map|svg|png|woff2?)$/i.test(file)
    || /(?:^|\/)(?:assets\/)?[^/]+-[a-z0-9_-]{8,}\.(?:js|css)$/i.test(file)
    || /(?:^|\/)(?:tego-sheet|xspreadsheet)(?:\.[a-z0-9-]+)?\.(?:js|cjs|css)$/i.test(file)
    || /\.min\.(?:js|css)$/.test(file)
  ));

  for (const prefix of approvedPrefixes) {
    expect(trackedFiles().some(file => file.startsWith(prefix)), prefix).toBe(true);
  }
  for (const file of approvedFiles) expect(trackedFiles(), file).toContain(file);
  expect(generated, 'tracked generated outputs').toEqual([]);
});
