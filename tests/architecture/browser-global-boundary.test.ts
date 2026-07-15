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

function forEachEagerChild(node: ts.Node, visitor: (child: ts.Node) => void): void {
  if (ts.isFunctionLike(node)) return;
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    for (const clause of node.heritageClauses ?? []) {
      for (const type of clause.types) visitor(type.expression);
    }
    for (const member of node.members) {
      const isStatic = (ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined)
        ?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) ?? false;
      if (!isStatic) continue;
      if (ts.isPropertyDeclaration(member) && member.initializer !== undefined) visitor(member.initializer);
      if (ts.isClassStaticBlockDeclaration(member)) visitor(member.body);
    }
    return;
  }
  ts.forEachChild(node, visitor);
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
  interface Scope {
    readonly bindings: Map<string, BrowserAlias | null>;
    readonly parent: Scope | null;
  }
  const rootScope: Scope = { bindings: new Map(), parent: null };
  const scopes = new WeakMap<ts.Node, Scope>();
  const buildScopes = (node: ts.Node, parent: Scope): void => {
    if (ts.isTypeNode(node)) return;
    const scope = ts.isBlock(node) ? { bindings: new Map(), parent } : parent;
    scopes.set(node, scope);
    forEachEagerChild(node, child => buildScopes(child, scope));
  };
  buildScopes(sourceFile, rootScope);
  const visit = (node: ts.Node, visitor: (current: ts.Node, scope: Scope) => void): void => {
    if (ts.isTypeNode(node)) return;
    const scope = scopes.get(node)!;
    visitor(node, scope);
    forEachEagerChild(node, child => visit(child, visitor));
  };
  visit(sourceFile, (node, scope) => {
    if (ts.isVariableDeclaration(node)) {
      const names = new Set<string>();
      collectBindingNames(node.name, names);
      for (const name of names) scope.bindings.set(name, null);
    }
    if (
      (ts.isFunctionDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isEnumDeclaration(node)
        || ts.isImportClause(node)
        || ts.isImportEqualsDeclaration(node)
        || ts.isNamespaceImport(node)
        || ts.isImportSpecifier(node))
      && node.name !== undefined
    ) scope.bindings.set(node.name.text, null);
  });
  const lookup = (scope: Scope, name: string): { readonly found: boolean; readonly value: BrowserAlias | null } => {
    for (let current: Scope | null = scope; current !== null; current = current.parent) {
      if (current.bindings.has(name)) return { found: true, value: current.bindings.get(name)! };
    }
    return { found: false, value: null };
  };
  const aliasFor = (expression: ts.Expression, scope: Scope): BrowserAlias | undefined => {
    if (ts.isIdentifier(expression)) {
      const binding = lookup(scope, expression.text);
      if (binding.found) return binding.value ?? undefined;
      if (expression.text === 'globalThis' || expression.text === 'window') return globalObject;
      return browserGlobals.has(expression.text) ? expression.text : undefined;
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const parent = aliasFor(expression.expression, scope);
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
      ) return aliasFor(binder.expression, scope);
    }
    return undefined;
  };
  let changed = true;
  while (changed) {
    changed = false;
    const bind = (scope: Scope, name: string | null, alias: BrowserAlias | undefined): void => {
      if (name === null || alias === undefined || scope.bindings.get(name) === alias) return;
      scope.bindings.set(name, alias);
      changed = true;
    };
    visit(sourceFile, (node, scope) => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        if (ts.isIdentifier(node.name)) {
          bind(scope, node.name.text, aliasFor(node.initializer, scope));
          return;
        }
        if (!ts.isObjectBindingPattern(node.name)) return;
        const parent = aliasFor(node.initializer, scope);
        for (const element of node.name.elements) {
          const property = staticName(element.propertyName ?? element.name);
          const alias = parent === globalObject && property !== null && browserGlobals.has(property)
            ? property
            : parent === globalObject ? undefined : parent;
          bind(scope, staticName(element.name), alias);
        }
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        const target = lookup(scope, node.left.text);
        if (!target.found) return;
        for (let owner: Scope | null = scope; owner !== null; owner = owner.parent) {
          if (!owner.bindings.has(node.left.text)) continue;
          bind(owner, node.left.text, aliasFor(node.right, scope));
          break;
        }
      }
    });
  }
  const found = new Set<string>();
  visit(sourceFile, (node, scope) => {
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
    const alias = aliasFor(node, scope);
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

it('keeps browser shadowing lexical instead of suppressing outer global reads', () => {
  expect(eagerBrowserGlobalsFromSource(`
    { const document = localDocument; }
    document.createElement('div');
  `, 'block-shadow.ts')).toEqual(['document']);

  expect(eagerBrowserGlobalsFromSource(`
    const browser = globalThis;
    {
      const browser = localBrowser;
      browser.document.createElement('local');
    }
    browser.document.createElement('global');
  `, 'nested-shadow.ts')).toEqual(['document']);

  expect(eagerBrowserGlobalsFromSource(`
    {
      const document = localDocument;
      document.createElement('local');
    }
  `, 'local-only.ts')).toEqual([]);
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
