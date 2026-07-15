import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { parityManifest } from '../parity/manifest';

const root = resolve(import.meta.dirname, '../..');
const browserGlobals = new Set([
  'window',
  'document',
  'navigator',
  'ResizeObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
  'sessionStorage',
]);

function sourceFiles(): readonly string[] {
  return execFileSync('git', ['ls-files', '-z', 'src'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => /\.tsx?$/.test(file));
}

function eagerBrowserGlobals(file: string): readonly string[] {
  const source = readFileSync(resolve(root, file), 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node) || ts.isFunctionLike(node)) return;
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      for (const clause of node.heritageClauses ?? []) {
        for (const type of clause.types) visit(type.expression);
      }
      for (const member of node.members) {
        const isStatic = (ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined)
          ?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) ?? false;
        if (!isStatic) continue;
        if (ts.isPropertyDeclaration(member) && member.initializer !== undefined) visit(member.initializer);
        if (ts.isClassStaticBlockDeclaration(member)) visit(member.body);
      }
      return;
    }
    if (ts.isIdentifier(node) && browserGlobals.has(node.text)) found.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...found];
}

it('does not read browser globals while evaluating source modules', () => {
  for (const file of sourceFiles()) {
    expect(eagerBrowserGlobals(file), file).toEqual([]);
  }
});

it('[ARCH-9] imports the public source entry without creating browser globals', async () => {
  const before = new Map([...browserGlobals].map(name => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]));

  await import('../../src');

  for (const [name, descriptor] of before) {
    expect(Object.getOwnPropertyDescriptor(globalThis, name), name).toEqual(descriptor);
  }
});

it('[ARCH-8] maps every declared browser and visual parity assertion to an executable title', () => {
  const sources = execFileSync('git', ['ls-files', '-z', 'tests/browser', 'tests/visual'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\0').filter(file => /\.(?:ts|tsx)$/.test(file));
  const titles = sources.map(file => readFileSync(resolve(root, file), 'utf8')).join('\n');
  const declared = parityManifest.flatMap(row => (['browser', 'visual'] as const).flatMap(lane => {
    const evidence = row[lane];
    return 'assertions' in evidence ? evidence.assertions : [];
  }));

  expect(declared.length).toBeGreaterThan(20);
  for (const assertion of declared) {
    expect(titles, assertion).toContain(`@parity:${assertion}`);
  }
});
