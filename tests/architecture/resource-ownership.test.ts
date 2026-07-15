import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
import { CanvasEngine } from '../../src/engine/canvas/canvas-engine';
import { ResourceRegistry } from '../../src/engine/interaction/resource-registry';
import { createCanvasHarness } from '../helpers/canvas-harness';
import {
  ARCHITECTURE_TEST_TIMEOUT_MS,
  execArchitectureChild,
} from './helpers/architecture-child-process';

const root = resolve(import.meta.dirname, '../..');

type ResourcePrimitive =
  | 'animation-frame'
  | 'listener'
  | 'observer'
  | 'overlay'
  | 'portal'
  | 'subscription'
  | 'timer';

const callNames = new Map<string, ResourcePrimitive>([
  ['addEventListener', 'listener'],
  ['removeEventListener', 'listener'],
  ['ResizeObserver', 'observer'],
  ['requestAnimationFrame', 'animation-frame'],
  ['cancelAnimationFrame', 'animation-frame'],
  ['setTimeout', 'timer'],
  ['clearTimeout', 'timer'],
  ['setInterval', 'timer'],
  ['clearInterval', 'timer'],
  ['subscribe', 'subscription'],
  ['unsubscribe', 'subscription'],
  ['createElement', 'overlay'],
  ['append', 'overlay'],
  ['appendChild', 'overlay'],
  ['remove', 'overlay'],
  ['removeChild', 'overlay'],
  ['createPortal', 'portal'],
]);
const propertyOnly = new Set([
  'createElement',
  'append',
  'appendChild',
  'remove',
  'removeChild',
]);

function expressionName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (
    ts.isElementAccessExpression(expression)
    && expression.argumentExpression !== undefined
    && (ts.isStringLiteral(expression.argumentExpression)
      || ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
  ) return expression.argumentExpression.text;
  return null;
}

function boundTarget(expression: ts.Expression): ts.Expression | null {
  if (!ts.isCallExpression(expression)) return null;
  const binder = expression.expression;
  if (!ts.isPropertyAccessExpression(binder) && !ts.isElementAccessExpression(binder)) return null;
  return expressionName(binder) === 'bind' ? binder.expression : null;
}

function bindingName(name: ts.BindingName | ts.PropertyName | undefined): string | null {
  if (name === undefined) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

interface AliasBinding<Alias> {
  readonly aliases: Set<Alias>;
}

interface AliasScope<Alias> {
  readonly bindings: Map<string, AliasBinding<Alias>>;
  readonly kind: 'block' | 'root' | 'var';
  readonly parent: AliasScope<Alias> | null;
}

interface LexicalAliases<Alias> {
  readonly bindings: Set<AliasBinding<Alias>>;
  readonly lookup: (scope: AliasScope<Alias>, name: string) => AliasBinding<Alias> | undefined;
  readonly scopeForDeclaration: (node: ts.VariableDeclaration, scope: AliasScope<Alias>) => AliasScope<Alias>;
  readonly visit: (visitor: (node: ts.Node, scope: AliasScope<Alias>) => void) => void;
}

function createLexicalAliases<Alias>(sourceFile: ts.SourceFile): LexicalAliases<Alias> {
  const root: AliasScope<Alias> = { bindings: new Map(), kind: 'root', parent: null };
  const scopes = new WeakMap<ts.Node, AliasScope<Alias>>();
  const bindings = new Set<AliasBinding<Alias>>();
  const build = (node: ts.Node, parent: AliasScope<Alias>): void => {
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
    const scope: AliasScope<Alias> = kind === null
      ? parent
      : { bindings: new Map(), kind, parent };
    scopes.set(node, scope);
    ts.forEachChild(node, child => build(child, scope));
  };
  build(sourceFile, root);
  const visit = (visitor: (node: ts.Node, scope: AliasScope<Alias>) => void): void => {
    const walk = (node: ts.Node): void => {
      visitor(node, scopes.get(node)!);
      ts.forEachChild(node, walk);
    };
    walk(sourceFile);
  };
  const lookup = (scope: AliasScope<Alias>, name: string): AliasBinding<Alias> | undefined => {
    for (let current: AliasScope<Alias> | null = scope; current !== null; current = current.parent) {
      const binding = current.bindings.get(name);
      if (binding !== undefined) return binding;
    }
    return undefined;
  };
  const scopeForDeclaration = (
    node: ts.VariableDeclaration,
    scope: AliasScope<Alias>,
  ): AliasScope<Alias> => {
    if (ts.isCatchClause(node.parent)) return scope;
    const declarationList = ts.isVariableDeclarationList(node.parent) ? node.parent : null;
    if (declarationList !== null && (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0) return scope;
    let owner = scope;
    while (owner.kind === 'block' && owner.parent !== null) owner = owner.parent;
    return owner;
  };
  const declare = (scope: AliasScope<Alias>, name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      if (scope.bindings.has(name.text)) return;
      const binding: AliasBinding<Alias> = { aliases: new Set() };
      scope.bindings.set(name.text, binding);
      bindings.add(binding);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declare(scope, element.name);
    }
  };
  visit((node, scope) => {
    if (ts.isVariableDeclaration(node)) declare(scopeForDeclaration(node, scope), node.name);
    else if (ts.isParameter(node)) declare(scope, node.name);
    else if (ts.isFunctionDeclaration(node) && node.name !== undefined) {
      declare(scope.parent ?? scope, node.name);
    } else if (ts.isFunctionExpression(node) && node.name !== undefined) {
      declare(scope, node.name);
    } else if (ts.isClassDeclaration(node) && node.name !== undefined) {
      declare(scope.parent ?? scope, node.name);
      declare(scope, node.name);
    } else if (ts.isClassExpression(node) && node.name !== undefined) {
      declare(scope, node.name);
    } else if (
      (ts.isEnumDeclaration(node)
        || ts.isImportClause(node)
        || ts.isImportEqualsDeclaration(node)
        || ts.isNamespaceImport(node)
        || ts.isImportSpecifier(node))
      && node.name !== undefined
    ) {
      declare(scope, node.name);
    }
  });
  return { bindings, lookup, scopeForDeclaration, visit };
}

function addAliases<Alias>(binding: AliasBinding<Alias>, aliases: Iterable<Alias>): boolean {
  let changed = false;
  for (const alias of aliases) {
    if (binding.aliases.has(alias)) continue;
    binding.aliases.add(alias);
    changed = true;
  }
  return changed;
}

function runBoundedDataflow(
  bindingCount: number,
  aliasCount: number,
  scan: () => boolean,
): void {
  const maximumPasses = Math.max(1, bindingCount * aliasCount + 1);
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    if (!scan()) return;
  }
  throw new Error(`alias analysis exceeded ${maximumPasses} monotonic passes`);
}

function resourcePrimitivesFromSource(source: string, file: string): readonly string[] {
  const primitives: ResourcePrimitive[] = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lexical = createLexicalAliases<ResourcePrimitive>(sourceFile);
  const references = (
    expression: ts.Expression,
    scope: AliasScope<ResourcePrimitive>,
  ): ReadonlySet<ResourcePrimitive> => {
    if (ts.isIdentifier(expression)) {
      const binding = lexical.lookup(scope, expression.text);
      if (binding !== undefined) return binding.aliases;
      const primitive = propertyOnly.has(expression.text) ? undefined : callNames.get(expression.text);
      return primitive === undefined ? new Set() : new Set([primitive]);
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const name = expressionName(expression);
      const primitive = name === null ? undefined : callNames.get(name);
      return primitive === undefined ? new Set() : new Set([primitive]);
    }
    const target = boundTarget(expression);
    return target === null ? new Set() : references(target, scope);
  };
  runBoundedDataflow(lexical.bindings.size, new Set(callNames.values()).size, () => {
    let changed = false;
    lexical.visit((node, scope) => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        const declarationScope = lexical.scopeForDeclaration(node, scope);
        if (ts.isIdentifier(node.name)) {
          changed = addAliases(declarationScope.bindings.get(node.name.text)!, references(node.initializer, scope))
            || changed;
        } else if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            const name = bindingName(element.name);
            const property = bindingName(element.propertyName ?? element.name);
            const primitive = property === null ? undefined : callNames.get(property);
            if (name !== null && primitive !== undefined) {
              changed = addAliases(declarationScope.bindings.get(name)!, [primitive]) || changed;
            }
          }
        }
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        const binding = lexical.lookup(scope, node.left.text);
        if (binding !== undefined) changed = addAliases(binding, references(node.right, scope)) || changed;
      }
    });
    return changed;
  });
  lexical.visit((node, scope) => {
    if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return;
    for (const primitive of references(node.expression, scope)) primitives.push(primitive);
  });
  return primitives;
}

const registryOwnershipMethods = new Map<string, ResourcePrimitive>([
  ['animationFrame', 'animation-frame'],
  ['listen', 'listener'],
  ['observer', 'observer'],
  ['overlay', 'overlay'],
  ['subscription', 'subscription'],
  ['timer', 'timer'],
]);

type OwnerObject = 'canvas-options' | 'controller-object' | 'epoch-object' | 'registry-object';
type OwnerAlias = OwnerObject | ResourcePrimitive;

function ownershipMember(owner: OwnerAlias | undefined, method: string | null): OwnerAlias | undefined {
  if (owner === 'registry-object' && method !== null) return registryOwnershipMethods.get(method);
  if (owner === 'controller-object' && method === 'subscribe') return 'subscription';
  if (owner === 'canvas-options' && method === 'epoch') return 'epoch-object';
  return owner === 'epoch-object' && method === 'controller' ? 'controller-object' : undefined;
}

function lifetimeResourcesFromSource(source: string, file: string): readonly ResourcePrimitive[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lexical = createLexicalAliases<OwnerAlias>(sourceFile);
  lexical.visit((node, scope) => {
    if (ts.isParameter(node)) {
      if (!ts.isIdentifier(node.name) || node.type === undefined) return;
      const type = node.type.getText(sourceFile);
      const binding = scope.bindings.get(node.name.text)!;
      if (/\bWorkbookController\b/.test(type)) binding.aliases.add('controller-object');
      if (/\bUseCanvasEngineOptions\b/.test(type)) binding.aliases.add('canvas-options');
    }
  });
  const aliasesFor = (expression: ts.Expression, scope: AliasScope<OwnerAlias>): ReadonlySet<OwnerAlias> => {
    if (ts.isIdentifier(expression)) return lexical.lookup(scope, expression.text)?.aliases ?? new Set();
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const property = expressionName(expression);
      if (
        expression.expression.kind === ts.SyntaxKind.ThisKeyword
        && property === 'registry'
      ) return new Set(['registry-object']);
      const aliases = new Set<OwnerAlias>();
      for (const owner of aliasesFor(expression.expression, scope)) {
        const alias = ownershipMember(owner, property);
        if (alias !== undefined) aliases.add(alias);
      }
      return aliases;
    }
    const target = boundTarget(expression);
    return target === null ? new Set() : aliasesFor(target, scope);
  };
  runBoundedDataflow(lexical.bindings.size, new Set<OwnerAlias>([
    ...callNames.values(),
    'canvas-options',
    'controller-object',
    'epoch-object',
    'registry-object',
  ]).size, () => {
    let changed = false;
    lexical.visit((node, scope) => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        const declarationScope = lexical.scopeForDeclaration(node, scope);
        if (ts.isIdentifier(node.name)) {
          changed = addAliases(
            declarationScope.bindings.get(node.name.text)!,
            aliasesFor(node.initializer, scope),
          ) || changed;
          return;
        }
        if (!ts.isObjectBindingPattern(node.name)) return;
        const owners = aliasesFor(node.initializer, scope);
        for (const element of node.name.elements) {
          const name = bindingName(element.name);
          if (name === null) continue;
          const aliases = new Set<OwnerAlias>();
          for (const owner of owners) {
            const alias = ownershipMember(owner, bindingName(element.propertyName ?? element.name));
            if (alias !== undefined) aliases.add(alias);
          }
          changed = addAliases(declarationScope.bindings.get(name)!, aliases) || changed;
        }
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        const binding = lexical.lookup(scope, node.left.text);
        if (binding !== undefined) changed = addAliases(binding, aliasesFor(node.right, scope)) || changed;
      }
    });
    return changed;
  });
  const primitives: ResourcePrimitive[] = [];
  lexical.visit((node, scope) => {
    if (!ts.isCallExpression(node)) return;
    for (const alias of aliasesFor(node.expression, scope)) {
      if (alias !== 'canvas-options' && !alias.endsWith('-object')) {
        primitives.push(alias as ResourcePrimitive);
      }
    }
  });
  return primitives;
}

it('classifies bare, property, and element ResizeObserver construction', () => {
  for (const source of [
    'new ResizeObserver(() => undefined);',
    'new window.ResizeObserver(() => undefined);',
    "new globalThis['ResizeObserver'](() => undefined);",
  ]) {
    expect(resourcePrimitivesFromSource(source, 'probe.ts')).toEqual(['observer']);
  }
});

it('classifies bound and destructured resource aliases as acquisitions', () => {
  const source = `
    const browser = globalThis;
    const add = root.addEventListener.bind(root);
    const { removeEventListener: remove } = root;
    const { setTimeout: later, clearTimeout: cancel } = browser;
    const { createElement: make } = document;
    add('click', listener);
    remove('click', listener);
    later(callback, 1);
    cancel(timer);
    make('div');
  `;

  expect(resourcePrimitivesFromSource(source, 'probe.ts')).toEqual([
    'listener',
    'listener',
    'timer',
    'timer',
    'overlay',
  ]);
});

it('keeps lifetime-owner wrapper calls visible through ordinary aliases', () => {
  expect(lifetimeResourcesFromSource(`
    const ownListener = this.registry.listen.bind(this.registry);
    const { timer: ownTimer } = this.registry;
    ownListener(root, 'click', listener);
    ownTimer(cancel);
    function connectController(controller: WorkbookController) {
      const { subscribe: connect } = controller;
      connect(publish);
    }
  `, 'probe.ts')).toEqual(['listener', 'timer', 'subscription']);
});

it('resolves owner-object aliases without trusting unrelated receiver names', () => {
  expect(lifetimeResourcesFromSource(`
    const resources = this.registry;
    const chained = resources;
    let assigned;
    assigned = chained;
    const { listen: ownListener, timer: ownTimer } = assigned;
    const boundListener = ownListener.bind(assigned);
    boundListener(root, 'click', listener);
    ownTimer(cancel);

    const registry = unrelatedRegistry;
    const controller = unrelatedController;
    registry.listen(root, 'fake', listener);
    controller.subscribe(listener);

    function connect(realController: WorkbookController) {
      const source = realController;
      source.subscribe(listener);
    }
  `, 'probe.ts')).toEqual(['listener', 'timer', 'subscription']);
});

it('terminates and conservatively tracks conflicting resource aliases per lexical binding', () => {
  expect(resourcePrimitivesFromSource(`
    let acquire = addEventListener;
    acquire = setTimeout;
    {
      const acquire = clearInterval;
      acquire(timer);
    }
    acquire(target, 'click', listener);
  `, 'resource-conflict.ts')).toEqual(['timer', 'listener', 'timer']);

  expect(lifetimeResourcesFromSource(`
    let own = this.registry.listen;
    own = this.registry.timer;
    {
      const own = this.registry.observer;
      own(disconnect);
    }
    own(dispose);

    const resources = this.registry;
    {
      const resources = unrelatedRegistry;
      resources.listen(target, 'fake', listener);
    }
    resources.listen(target, 'real', listener);
  `, 'owner-conflict.ts')).toEqual(['observer', 'listener', 'timer', 'listener']);

  expect(resourcePrimitivesFromSource(`
    function addEventListener() {}
    {
      const setTimeout = localTimer;
      setTimeout();
    }
    addEventListener();
  `, 'declaration-shadows.ts')).toEqual([]);
});

it('keeps static-block vars and named class expressions in their own resource scopes', () => {
  expect(resourcePrimitivesFromSource(`
    class StaticShadow {
      static {
        var setTimeout = localTimer;
        setTimeout();
      }
    }
    setTimeout(callback, 1);
  `, 'static-block-var.ts')).toEqual(['timer']);

  expect(resourcePrimitivesFromSource(`
    const LocalClass = class setTimeout {
      static run() { setTimeout(); }
    };
    setTimeout(callback, 1);
  `, 'named-class-expression.ts')).toEqual(['timer']);
});

it('[ARCH-5] gives each browser resource one idempotent registry disposal', async () => {
  const registry = new ResourceRegistry();
  const releases = {
    listener: vi.fn(),
    observer: vi.fn(),
    timer: vi.fn(),
    animationFrame: vi.fn(),
    subscription: vi.fn(),
    overlay: vi.fn(),
  };
  const callbacks = new Set<(event: unknown) => void>();
  const target = {
    addEventListener(_type: string, listener: (event: unknown) => void) {
      callbacks.add(listener);
    },
    removeEventListener(_type: string, listener: (event: unknown) => void) {
      callbacks.delete(listener);
    },
  };
  const retained = vi.fn();
  registry.listen(target, 'pointerdown', retained, undefined, releases.listener);
  registry.observer(releases.observer);
  registry.timer(releases.timer);
  registry.animationFrame(releases.animationFrame);
  registry.subscription(releases.subscription);
  registry.overlay(releases.overlay);
  const late = registry.guard(retained);

  registry.dispose();
  registry.dispose();
  late();
  await Promise.resolve().then(late);

  expect(callbacks.size).toBe(0);
  expect(retained).not.toHaveBeenCalled();
  for (const release of Object.values(releases)) expect(release).toHaveBeenCalledOnce();
});

it('[ARCH-5] cancels the renderer schedule during idempotent engine disposal', () => {
  const harness = createCanvasHarness();
  const engine = new CanvasEngine(harness.canvas, { animationFrame: harness.animationFrame });
  engine.render({
    sheet: { rows: { len: 1 }, cols: { len: 1 } },
    viewport: {
      model: {
        rowCount: 0,
        columnCount: 0,
        merges: [],
        rowHeight: () => 0,
        columnWidth: () => 0,
        rowOffset: () => 0,
        columnOffset: () => 0,
        rowAt: () => null,
        columnAt: () => null,
        previousVisibleRow: () => null,
        previousVisibleColumn: () => null,
        mergeAt: () => null,
        logicalRowAtVisualIndex: value => value,
        visualIndexOfRow: value => value,
        visualRowRange: (start, end) => [start, end],
        visualRowRuns: (start, end) => [[start, end]],
        logicalRowRange: (start, end) => [start, end],
      },
      width: 100,
      height: 100,
      rowHeaderWidth: 0,
      columnHeaderHeight: 0,
      scroll: { x: 0, y: 0 },
      freeze: { row: 0, column: 0 },
    },
  });
  expect(harness.animationFrame.pending).toBe(1);

  engine.dispose();
  engine.dispose();

  expect(harness.animationFrame.pending).toBe(0);
  expect(harness.animationFrame.cancelled).toHaveLength(1);
});

it('[ARCH-5] separates browser API implementations from section 6.6 lifetime owners', () => {
  const files: string[] = [];
  const visitDirectory = (relative: string): void => {
    for (const entry of readdirSync(resolve(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visitDirectory(file);
      else if (/\.tsx?$/.test(file)) files.push(file);
    }
  };
  visitDirectory('src');
  const apiImplementations = new Map<string, Set<string>>();
  const lifetimeOwners = new Map<string, Set<string>>();
  const record = (target: Map<string, Set<string>>, primitive: string, file: string): void => {
    const entries = target.get(primitive) ?? new Set<string>();
    entries.add(file);
    target.set(primitive, entries);
  };
  for (const file of files) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const implementations = resourcePrimitivesFromSource(source, file);
    for (const primitive of implementations) record(apiImplementations, primitive, file);
    for (const primitive of lifetimeResourcesFromSource(source, file)) {
      record(lifetimeOwners, primitive, file);
    }
    for (const primitive of implementations) {
      if (['animation-frame', 'overlay', 'portal'].includes(primitive)) {
        record(lifetimeOwners, primitive, file);
      }
    }
  }
  const implementationSites = new Map<string, ReadonlySet<string>>([
    ['listener', new Set([
      'src/engine/interaction/resource-registry.ts',
      'src/react/adapters/interaction-adapter.ts',
    ])],
    ['observer', new Set([
      'src/react/adapters/interaction-adapter.ts',
    ])],
    ['animation-frame', new Set([
      'src/engine/canvas/render-scheduler.ts',
    ])],
    ['timer', new Set([
      'src/react/adapters/interaction-adapter.ts',
    ])],
    ['subscription', new Set([
      'src/core/controller/workbook-controller.ts',
      'src/react/adapters/controller-external-store.ts',
      'src/react/hooks/use-canvas-engine.ts',
    ])],
    ['overlay', new Set([
      'src/ui/print-workbook.ts',
    ])],
    ['portal', new Set()],
  ]);
  for (const [primitive, allowed] of implementationSites) {
    expect(apiImplementations.get(primitive) ?? new Set(), `${primitive} API sites`).toEqual(allowed);
  }
  const ownership = new Map<string, ReadonlySet<string>>([
    ['listener', new Set(['src/engine/interaction/interaction-manager.ts'])],
    ['observer', new Set(['src/engine/interaction/interaction-manager.ts'])],
    ['animation-frame', new Set(['src/engine/canvas/render-scheduler.ts'])],
    ['timer', new Set(['src/engine/interaction/interaction-manager.ts'])],
    ['subscription', new Set([
      'src/react/adapters/controller-external-store.ts',
      'src/react/hooks/use-canvas-engine.ts',
    ])],
    ['overlay', new Set(['src/ui/print-workbook.ts'])],
    ['portal', new Set()],
  ]);
  for (const [primitive, allowed] of ownership) {
    expect(lifetimeOwners.get(primitive) ?? new Set(), `${primitive} lifetime owners`).toEqual(allowed);
  }
  expect([...(lifetimeOwners.get('subscription') ?? [])].every(file => file.startsWith('src/react/')))
    .toBe(true);
});

it('[ARCH-5] keeps the React disposal cascade ordered and executes the Strict Mode cleanup probe', () => {
  const component = readFileSync(resolve(root, 'src/react/tego-sheet.tsx'), 'utf8');
  expect(component.indexOf('useInteractionManager({')).toBeLessThan(component.indexOf('useCanvasEngine({'));

  const engineHook = readFileSync(resolve(root, 'src/react/hooks/use-canvas-engine.ts'), 'utf8');
  expect(engineHook.indexOf('append(errors, unsubscribe)')).toBeLessThan(
    engineHook.indexOf('append(errors, adapter.dispose)'),
  );

  const cli = resolve(root, 'node_modules/vitest/vitest.mjs');
  const output = execArchitectureChild(process.execPath, [
    cli,
    'run',
    '--project',
    'component',
    'tests/component/strict-mode-cleanup.test.tsx',
  ], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  expect(output).toMatch(/Tests\s+4 passed/);
}, ARCHITECTURE_TEST_TIMEOUT_MS);
