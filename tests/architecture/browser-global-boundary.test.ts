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

const globalObject = Symbol('global-object');
type BrowserAlias = string | typeof globalObject;

function staticName(node: ts.Node | undefined): string | null {
  if (
    node !== undefined
    && (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
  ) return node.text;
  return null;
}

function visitEager(node: ts.Node, visitor: (current: ts.Node) => void): void {
  if (ts.isTypeNode(node)) return;
  visitor(node);
  if (ts.isFunctionLike(node)) return;
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    for (const clause of node.heritageClauses ?? []) {
      for (const type of clause.types) visitEager(type.expression, visitor);
    }
    for (const member of node.members) {
      const isStatic = (ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined)
        ?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) ?? false;
      if (!isStatic) continue;
      if (ts.isPropertyDeclaration(member) && member.initializer !== undefined) {
        visitEager(member.initializer, visitor);
      }
      if (ts.isClassStaticBlockDeclaration(member)) visitEager(member.body, visitor);
    }
    return;
  }
  ts.forEachChild(node, child => visitEager(child, visitor));
}

function collectBindingNames(name: ts.BindingName, names: Set<string>): void {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) collectBindingNames(element.name, names);
  }
}

function eagerBrowserGlobalsFromSource(source: string, file: string): readonly string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const declared = new Set<string>();
  visitEager(sourceFile, node => {
    if (ts.isVariableDeclaration(node)) collectBindingNames(node.name, declared);
    if (
      (ts.isFunctionDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isEnumDeclaration(node)
        || ts.isImportClause(node)
        || ts.isImportEqualsDeclaration(node)
        || ts.isNamespaceImport(node)
        || ts.isImportSpecifier(node))
      && node.name !== undefined
    ) declared.add(node.name.text);
  });

  const aliases = new Map<string, BrowserAlias>();
  const aliasFor = (expression: ts.Expression): BrowserAlias | undefined => {
    if (ts.isIdentifier(expression)) {
      const alias = aliases.get(expression.text);
      if (alias !== undefined) return alias;
      if (declared.has(expression.text)) return undefined;
      if (expression.text === 'globalThis' || expression.text === 'window') return globalObject;
      return browserGlobals.has(expression.text) ? expression.text : undefined;
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const parent = aliasFor(expression.expression);
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : staticName(expression.argumentExpression);
      if (parent === undefined || property === null) return undefined;
      if (parent === globalObject) return browserGlobals.has(property) ? property : undefined;
      return parent;
    }
    if (ts.isCallExpression(expression)) {
      const binder = expression.expression;
      if (
        (ts.isPropertyAccessExpression(binder) || ts.isElementAccessExpression(binder))
        && staticName(ts.isPropertyAccessExpression(binder) ? binder.name : binder.argumentExpression) === 'bind'
      ) return aliasFor(binder.expression);
    }
    return undefined;
  };

  let changed = true;
  while (changed) {
    changed = false;
    const bind = (name: string | null, alias: BrowserAlias | undefined): void => {
      if (name === null || alias === undefined || aliases.get(name) === alias) return;
      aliases.set(name, alias);
      changed = true;
    };
    visitEager(sourceFile, node => {
      if (!ts.isVariableDeclaration(node) || node.initializer === undefined) return;
      if (ts.isIdentifier(node.name)) {
        bind(node.name.text, aliasFor(node.initializer));
        return;
      }
      if (!ts.isObjectBindingPattern(node.name)) return;
      const parent = aliasFor(node.initializer);
      for (const element of node.name.elements) {
        const property = staticName(element.propertyName ?? element.name);
        const alias = parent === globalObject && property !== null && browserGlobals.has(property)
          ? property
          : parent === globalObject ? undefined : parent;
        bind(staticName(element.name), alias);
      }
    });
  }

  const found = new Set<string>();
  visitEager(sourceFile, node => {
    if (!ts.isExpression(node)) return;
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      if (
        (ts.isPropertyAccessExpression(parent) && parent.name === node)
        || (ts.isVariableDeclaration(parent) && parent.name === node)
        || (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node))
        || (ts.isPropertyAssignment(parent) && parent.name === node)
      ) return;
    }
    const alias = aliasFor(node);
    if (alias === globalObject && ts.isIdentifier(node) && node.text === 'window') found.add('window');
    else if (alias !== undefined && alias !== globalObject) found.add(alias);
  });
  return [...found];
}

function eagerBrowserGlobals(file: string): readonly string[] {
  return eagerBrowserGlobalsFromSource(readFileSync(resolve(root, file), 'utf8'), file);
}

it('does not read browser globals while evaluating source modules', () => {
  for (const file of sourceFiles()) {
    expect(eagerBrowserGlobals(file), file).toEqual([]);
  }
});

it('detects eager browser access through global, property, and destructured aliases', () => {
  const found = eagerBrowserGlobalsFromSource(`
    const browser = globalThis;
    const { document: doc, requestAnimationFrame: raf } = browser;
    const make = doc.createElement.bind(doc);
    const storage = browser['localStorage'];
    const page = window;
    const navigation = page.navigator;
    make('div');
    raf(() => undefined);
    storage.getItem('key');
    navigation.userAgent;
  `, 'probe.ts');

  expect([...found].sort()).toEqual([
    'document',
    'localStorage',
    'navigator',
    'requestAnimationFrame',
    'window',
  ]);
  expect(eagerBrowserGlobalsFromSource(`
    const globalThis = { document: localDocument };
    globalThis.document;
  `, 'shadowed.ts')).toEqual([]);
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
