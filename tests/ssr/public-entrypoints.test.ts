import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const consumer = process.env.TEGO_SHEET_CONSUMER;
assert.ok(consumer, 'TEGO_SHEET_CONSUMER must point at the clean installed fixture');
const publicEntries = [
  'tego-sheet',
  'tego-sheet/locales/en',
  'tego-sheet/locales/de',
  'tego-sheet/locales/nl',
  'tego-sheet/locales/zh-cn',
];

test('every ESM and CommonJS public entry imports without browser globals', () => {
  for (const entry of publicEntries) {
    execFileSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `
        if ('window' in globalThis || 'document' in globalThis) throw new Error('browser global leaked');
        await import(${JSON.stringify(entry)});
        if ('window' in globalThis || 'document' in globalThis) throw new Error('browser global created');
      `,
    ], { cwd: consumer, stdio: 'pipe' });
    execFileSync(process.execPath, [
      '--input-type=commonjs',
      '--eval',
      `
        if ('window' in globalThis || 'document' in globalThis) throw new Error('browser global leaked');
        require(${JSON.stringify(entry)});
        if ('window' in globalThis || 'document' in globalThis) throw new Error('browser global created');
      `,
    ], { cwd: consumer, stdio: 'pipe' });
  }
});
