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

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function isAmbient(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword);
}

function unwrapped(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
    || ts.isSatisfiesExpression(current)
  ) current = current.expression;
  return current;
}

function invokedFunctionFromCallee(
  expression: ts.Expression,
): ts.FunctionExpression | ts.ArrowFunction | null {
  let callee = unwrapped(expression);
  if (
    (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
    && ['apply', 'call'].includes(staticName(
      ts.isPropertyAccessExpression(callee) ? callee.name : callee.argumentExpression,
    ) ?? '')
  ) callee = unwrapped(callee.expression);
  return ts.isFunctionExpression(callee) || ts.isArrowFunction(callee) ? callee : null;
}

function forEachEagerChild(
  node: ts.Node,
  invokedFunctions: WeakSet<ts.FunctionExpression | ts.ArrowFunction>,
  visitor: (child: ts.Node) => void,
): void {
  if (ts.isTypeNode(node) || (node.kind !== ts.SyntaxKind.SourceFile && isAmbient(node))) return;
  if (ts.isCallExpression(node)) {
    const invoked = invokedFunctionFromCallee(node.expression);
    if (invoked !== null) invokedFunctions.add(invoked);
    visitor(node.expression);
    for (const argument of node.arguments) visitor(argument);
    return;
  }
  if (ts.isFunctionLike(node)) {
    if (!ts.isFunctionExpression(node) && !ts.isArrowFunction(node)) return;
    if (!invokedFunctions.has(node)) return;
    for (const parameter of node.parameters) visitor(parameter);
    if (node.body !== undefined) visitor(node.body);
    return;
  }
  if (ts.isParameter(node)) {
    if (node.initializer !== undefined) visitor(node.initializer);
    return;
  }
  if (ts.isClassStaticBlockDeclaration(node)) {
    visitor(node.body);
    return;
  }
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    for (const decorator of decoratorsOf(node)) visitor(decorator.expression);
    for (const clause of node.heritageClauses ?? []) {
      for (const type of clause.types) visitor(type.expression);
    }
    for (const member of node.members) {
      for (const decorator of decoratorsOf(member)) visitor(decorator.expression);
      if (member.name !== undefined && ts.isComputedPropertyName(member.name)) visitor(member.name.expression);
      if (ts.isFunctionLike(member)) {
        for (const parameter of member.parameters) {
          for (const decorator of decoratorsOf(parameter)) visitor(decorator.expression);
        }
      }
      const isStatic = (ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined)
        ?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) ?? false;
      if (!isStatic) continue;
      if (ts.isPropertyDeclaration(member) && member.initializer !== undefined) visitor(member.initializer);
      if (ts.isClassStaticBlockDeclaration(member)) visitor(member);
    }
    return;
  }
  ts.forEachChild(node, visitor);
}

function eagerBrowserGlobalsFromSource(source: string, file: string): readonly string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  interface Binding {
    readonly aliases: Set<BrowserAlias>;
  }
  interface Scope {
    readonly bindings: Map<string, Binding>;
    readonly kind: 'block' | 'root' | 'var';
    readonly parent: Scope | null;
  }
  const rootScope: Scope = { bindings: new Map(), kind: 'root', parent: null };
  const scopes = new WeakMap<ts.Node, Scope>();
  const bindings = new Set<Binding>();
  const invokedFunctions = new WeakSet<ts.FunctionExpression | ts.ArrowFunction>();
  const buildScopes = (node: ts.Node, parent: Scope): void => {
    if (ts.isTypeNode(node)) return;
    const blockScope = ts.isBlock(node)
      || ts.isCaseBlock(node)
      || ts.isCatchClause(node)
      || ts.isForStatement(node)
      || ts.isForInStatement(node)
      || ts.isForOfStatement(node)
      || ts.isClassDeclaration(node)
      || ts.isClassExpression(node);
    const varScope = ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node);
    const kind = varScope ? 'var' : blockScope ? 'block' : null;
    const scope: Scope = kind === null ? parent : { bindings: new Map(), kind, parent };
    scopes.set(node, scope);
    forEachEagerChild(node, invokedFunctions, child => buildScopes(child, scope));
  };
  buildScopes(sourceFile, rootScope);
  const visit = (node: ts.Node, visitor: (current: ts.Node, scope: Scope) => void): void => {
    if (ts.isTypeNode(node)) return;
    const scope = scopes.get(node)!;
    visitor(node, scope);
    forEachEagerChild(node, invokedFunctions, child => visit(child, visitor));
  };
  const declareName = (scope: Scope, name: string): Binding => {
    const existing = scope.bindings.get(name);
    if (existing !== undefined) return existing;
    const binding: Binding = { aliases: new Set() };
    scope.bindings.set(name, binding);
    bindings.add(binding);
    return binding;
  };
  const declare = (scope: Scope, name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      declareName(scope, name.text);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declare(scope, element.name);
    }
  };
  const variableScope = (node: ts.VariableDeclaration, scope: Scope): Scope => {
    if (ts.isCatchClause(node.parent)) return scope;
    const declarationList = ts.isVariableDeclarationList(node.parent) ? node.parent : null;
    if (declarationList !== null && (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0) return scope;
    let owner = scope;
    while (owner.kind === 'block' && owner.parent !== null) owner = owner.parent;
    return owner;
  };
  visit(sourceFile, (node, scope) => {
    if (ts.isVariableDeclaration(node)) declare(variableScope(node, scope), node.name);
    if (ts.isParameter(node)) declare(scope, node.name);
    if (ts.isFunctionExpression(node) && node.name !== undefined) declareName(scope, node.name.text);
    if (ts.isClassExpression(node) && node.name !== undefined) declareName(scope, node.name.text);
    if (
      (ts.isFunctionDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isEnumDeclaration(node)
        || ts.isImportClause(node)
        || ts.isImportEqualsDeclaration(node)
        || ts.isNamespaceImport(node)
        || ts.isImportSpecifier(node))
      && node.name !== undefined
    ) {
      const owner = (
        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))
        && scope.parent !== null
      )
        ? scope.parent
        : scope;
      declareName(owner, node.name.text);
      if (ts.isClassDeclaration(node)) declareName(scope, node.name.text);
    }
  });
  const lookup = (scope: Scope, name: string): Binding | undefined => {
    for (let current: Scope | null = scope; current !== null; current = current.parent) {
      const binding = current.bindings.get(name);
      if (binding !== undefined) return binding;
    }
    return undefined;
  };
  const aliasesFor = (expression: ts.Expression, scope: Scope): ReadonlySet<BrowserAlias> => {
    if (ts.isIdentifier(expression)) {
      const binding = lookup(scope, expression.text);
      if (binding !== undefined) return binding.aliases;
      if (expression.text === 'globalThis' || expression.text === 'window') return new Set([globalObject]);
      return browserGlobals.has(expression.text) ? new Set([expression.text]) : new Set();
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const property = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : staticName(expression.argumentExpression);
      if (property === null) return new Set();
      const aliases = new Set<BrowserAlias>();
      for (const parent of aliasesFor(expression.expression, scope)) {
        if (parent === globalObject) {
          if (browserGlobals.has(property)) aliases.add(property);
        } else {
          aliases.add(parent);
        }
      }
      return aliases;
    }
    if (ts.isCallExpression(expression)) {
      const binder = expression.expression;
      if (
        (ts.isPropertyAccessExpression(binder) || ts.isElementAccessExpression(binder))
        && staticName(ts.isPropertyAccessExpression(binder) ? binder.name : binder.argumentExpression) === 'bind'
      ) return aliasesFor(binder.expression, scope);
    }
    return new Set();
  };
  const addAliases = (binding: Binding, aliases: Iterable<BrowserAlias>): boolean => {
    let changed = false;
    for (const alias of aliases) {
      if (binding.aliases.has(alias)) continue;
      binding.aliases.add(alias);
      changed = true;
    }
    return changed;
  };
  const maximumPasses = Math.max(1, bindings.size * (browserGlobals.size + 1) + 1);
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;
    const bind = (binding: Binding | undefined, aliases: Iterable<BrowserAlias>): void => {
      if (binding !== undefined) changed = addAliases(binding, aliases) || changed;
    };
    visit(sourceFile, (node, scope) => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        const declarationScope = variableScope(node, scope);
        if (ts.isIdentifier(node.name)) {
          bind(declarationScope.bindings.get(node.name.text), aliasesFor(node.initializer, scope));
          return;
        }
        if (!ts.isObjectBindingPattern(node.name)) return;
        const parents = aliasesFor(node.initializer, scope);
        for (const element of node.name.elements) {
          const property = staticName(element.propertyName ?? element.name);
          const aliases = new Set<BrowserAlias>();
          if (property !== null) {
            for (const parent of parents) {
              if (parent === globalObject) {
                if (browserGlobals.has(property)) aliases.add(property);
              } else {
                aliases.add(parent);
              }
            }
          }
          const name = staticName(element.name);
          bind(name === null ? undefined : declarationScope.bindings.get(name), aliases);
        }
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        bind(lookup(scope, node.left.text), aliasesFor(node.right, scope));
      }
    });
    if (!changed) break;
    if (pass === maximumPasses - 1) {
      throw new Error(`browser alias analysis exceeded ${maximumPasses} monotonic passes`);
    }
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
    for (const alias of aliasesFor(node, scope)) {
      if (alias === globalObject && ts.isIdentifier(node) && node.text === 'window') found.add('window');
      else if (alias !== globalObject) found.add(alias);
    }
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

it('terminates and conservatively tracks conflicting browser aliases per lexical binding', () => {
  expect([...eagerBrowserGlobalsFromSource(`
    let browserValue = document;
    browserValue = navigator;
    {
      const browserValue = localBrowser;
      browserValue.location;
    }
    browserValue.location;
  `, 'browser-conflict.ts')].sort()).toEqual(['document', 'navigator']);
});

it('models eager execution paths without entering lazy or ambient declarations', () => {
  expect(eagerBrowserGlobalsFromSource(`
    (() => document.createElement('div'))();
  `, 'iife.ts')).toEqual(['document']);

  expect(eagerBrowserGlobalsFromSource(`
    class ComputedName {
      [navigator.userAgent]() {}
    }
  `, 'computed-class-name.ts')).toEqual(['navigator']);

  expect(eagerBrowserGlobalsFromSource(`
    @register(document.createElement('div'))
    class Decorated {}
  `, 'decorator.ts')).toEqual(['document']);

  expect(eagerBrowserGlobalsFromSource(`
    function lazyFunction() { document.createElement('div'); }
    const lazyArrow = () => navigator.userAgent;
    (function document() { document(); })();
  `, 'lazy-functions.ts')).toEqual([]);

  expect(eagerBrowserGlobalsFromSource(`
    declare const document: Document;
    declare function factory(value: typeof navigator): void;
    declare class Ambient {
      [document.createElement('div')]: string;
    }
  `, 'ambient.ts')).toEqual([]);
});

it('models wrapped invocation and class-local execution scopes', () => {
  expect(eagerBrowserGlobalsFromSource(`
    (function () { document.createElement('div'); }).call(undefined);
    ((() => navigator.userAgent) as () => string)();
  `, 'wrapped-iife.ts')).toEqual(['document', 'navigator']);

  expect(eagerBrowserGlobalsFromSource(`
    class StaticShadow {
      static {
        var document = localDocument;
        document.title;
      }
    }
    document.createElement('global');
  `, 'static-block-var.ts')).toEqual(['document']);

  expect(eagerBrowserGlobalsFromSource(`
    const LocalClass = class document {
      static value = document.title;
    };
  `, 'named-class-expression.ts')).toEqual([]);
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
