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
const browserGlobals = [
  'window', 'document', 'navigator', 'ResizeObserver', 'requestAnimationFrame',
  'cancelAnimationFrame', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'OffscreenCanvas',
];

function ssrProbe(entry, loader) {
  return `
    const names = ${JSON.stringify(browserGlobals)};
    for (const name of names) {
      Reflect.deleteProperty(globalThis, name);
      if (name in globalThis) throw new Error(name + ' exists before import');
    }
    const before = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
    ${loader}(${JSON.stringify(entry)});
    for (const [index, name] of names.entries()) {
      if (name in globalThis) throw new Error(name + ' was created during import');
      const after = Object.getOwnPropertyDescriptor(globalThis, name);
      if (after !== before[index]) throw new Error(name + ' descriptor changed during import');
    }
  `;
}

test('every ESM and CommonJS public entry imports without browser globals', () => {
  for (const entry of publicEntries) {
    execFileSync(process.execPath, [
      '--input-type=module', '--eval', ssrProbe(entry, 'await import'),
    ], { cwd: consumer, stdio: 'pipe' });
    execFileSync(process.execPath, [
      '--input-type=commonjs', '--eval', ssrProbe(entry, 'require'),
    ], { cwd: consumer, stdio: 'pipe' });
  }
});
