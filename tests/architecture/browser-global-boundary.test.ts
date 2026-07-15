import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { parityManifest } from '../parity/manifest';
import {
  ARCHITECTURE_TEST_TIMEOUT_MS,
  execArchitectureChild,
} from './helpers/architecture-child-process';

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

interface ListedTest {
  readonly annotations: readonly { readonly type: string }[];
  readonly expectedStatus: string;
}

interface ListedSpec {
  readonly file: string;
  readonly line: number;
  readonly ok: boolean;
  readonly tags: readonly string[];
  readonly tests: readonly ListedTest[];
  readonly title: string;
}

interface ListedSuite {
  readonly specs?: readonly ListedSpec[];
  readonly suites?: readonly ListedSuite[];
}

function listedParityRegistrations(arguments_: readonly string[]): ReadonlyMap<string, ReadonlySet<string>> {
  const cli = resolve(root, 'node_modules/@playwright/test/cli.js');
  const output = execArchitectureChild(process.execPath, [
    cli,
    'test',
    ...arguments_,
    '--list',
    '--reporter=json',
  ], { cwd: root });
  const report = JSON.parse(output) as {
    readonly errors: readonly unknown[];
    readonly suites: readonly ListedSuite[];
  };
  expect(report.errors).toEqual([]);
  const registrations = new Map<string, Set<string>>();
  const logicalSpecs = new Map<string, ListedSpec>();
  const visit = (suite: ListedSuite): void => {
    for (const spec of suite.specs ?? []) {
      const key = `${spec.file}:${spec.line}:${spec.title}`;
      const existing = logicalSpecs.get(key);
      logicalSpecs.set(key, existing === undefined ? spec : {
        ...spec,
        ok: existing.ok && spec.ok,
        tests: [...existing.tests, ...spec.tests],
      });
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites) visit(suite);
  for (const [key, spec] of logicalSpecs) {
    const parityTags = spec.tags.filter(tag => tag.startsWith('parity:'));
    expect(parityTags, key).toHaveLength(1);
    expect(spec.ok, key).toBe(true);
    expect(spec.tests.length, key).toBeGreaterThan(0);
    expect(spec.tests.every(test => (
      test.expectedStatus === 'passed'
      && test.annotations.every(annotation => !['skip', 'fixme'].includes(annotation.type))
    )), key).toBe(true);
    const id = parityTags[0]!.slice('parity:'.length);
    const entries = registrations.get(id) ?? new Set<string>();
    entries.add(key);
    registrations.set(id, entries);
  }
  return registrations;
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

it('[ARCH-8] lists an enabled Playwright registration for every browser and visual assertion', () => {
  const lanes = {
    browser: listedParityRegistrations(['tests/browser']),
    visual: listedParityRegistrations(['--config', 'playwright.visual.config.ts']),
  };
  for (const lane of ['browser', 'visual'] as const) {
    const declared = parityManifest.flatMap(row => {
      const evidence = row[lane];
      return 'assertions' in evidence ? evidence.assertions : [];
    }).sort();
    expect([...lanes[lane].keys()].sort(), `${lane} registration IDs`).toEqual(declared);
    for (const id of declared) {
      expect(lanes[lane].get(id)?.size ?? 0, `${lane}:${id}`).toBeGreaterThanOrEqual(1);
    }
  }
}, ARCHITECTURE_TEST_TIMEOUT_MS);
