import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

it('does not track the obsolete runtime or generated documentation bundles', () => {
  const exactObsolete = new Set([
    'docs/index.html',
    'docs/xspreadsheet.css',
    'docs/xspreadsheet.css.map',
    'docs/xspreadsheet.js',
    'docs/xspreadsheet.js.map',
    'docs/58eaeb4e52248a5c75936c6f4c33a370.svg',
    'docs/ece3e4fa05d4292823fdef970eaf1233.svg',
    'docs/demo.png',
  ]);
  const obsolete = trackedFiles().filter(file => (
    file === 'legacy'
    || file.startsWith('legacy/')
    || file === 'dist'
    || file.startsWith('dist/')
    || file === 'docs/dist'
    || file.startsWith('docs/dist/')
    || file === 'docs/locale'
    || file.startsWith('docs/locale/')
    || exactObsolete.has(file)
  ));

  expect(obsolete, 'tracked legacy/generated artifacts').toEqual([]);
});
