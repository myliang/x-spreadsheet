import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { WorkbookController, parseWorkbook, serializeWorkbook } from '../../src/core';
import type { WorkbookInput } from '../../src/core';
import { deepFreeze } from '../helpers/deep-freeze';

const root = resolve(import.meta.dirname, '../..');
const forbiddenGlobals = new Set([
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLCanvasElement',
  'CanvasRenderingContext2D',
  'EventTarget',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
  'sessionStorage',
]);

function coreFiles(): readonly string[] {
  return execFileSync('git', ['ls-files', '-z', 'src/core'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => file.endsWith('.ts'));
}

it('[ARCH-3] keeps every core and controller module independent of React and the browser', () => {
  expect(coreFiles().length).toBeGreaterThan(20);
  for (const file of coreFiles()) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const imports = ts.preProcessFile(source).importedFiles.map(entry => entry.fileName);
    expect(imports, file).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/^(?:react(?:\/|$)|react-dom(?:\/|$))/),
    ]));
    expect(imports, file).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/(?:^|\/)ui(?:\/|$)|(?:^|\/)react(?:\/|$)|(?:^|\/)engine(?:\/|$)/),
    ]));

    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const found = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && forbiddenGlobals.has(node.text)) found.add(node.text);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    expect([...found], file).toEqual([]);
  }
});

it('[ARCH-2][ARCH-6] round-trips legacy JSON without mutating caller-owned input', () => {
  const input = deepFreeze([{
    name: 'Legacy',
    freeze: 'B2',
    customExtension: { nested: ['kept', 7, true] },
    rows: {
      len: 3,
      0: { cells: { 0: { text: '42', editable: false, printable: false } } },
    },
    cols: { len: 2, 0: { width: 88 } },
  }] as WorkbookInput);
  const before = JSON.stringify(input);

  const parsed = parseWorkbook(input);
  const controller = new WorkbookController(input);
  const serialized = serializeWorkbook(controller.getValue());

  expect(JSON.stringify(input)).toBe(before);
  expect(serialized).toEqual(parsed);
  expect(serialized[0]).toMatchObject({
    name: 'Legacy',
    freeze: 'B2',
    customExtension: { nested: ['kept', 7, true] },
    rows: { 0: { cells: { 0: { text: '42', editable: false, printable: false } } } },
  });
  controller.dispose();
});
