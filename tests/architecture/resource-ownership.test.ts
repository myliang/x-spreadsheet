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

function resourceReference(
  expression: ts.Expression,
  aliases: ReadonlyMap<string, ResourcePrimitive>,
): ResourcePrimitive | undefined {
  if (ts.isIdentifier(expression)) {
    return aliases.get(expression.text)
      ?? (propertyOnly.has(expression.text) ? undefined : callNames.get(expression.text));
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    const name = expressionName(expression);
    return name === null ? undefined : callNames.get(name);
  }
  const target = boundTarget(expression);
  return target === null ? undefined : resourceReference(target, aliases);
}

function bindingName(name: ts.BindingName | ts.PropertyName | undefined): string | null {
  if (name === undefined) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function resourceAliases(sourceFile: ts.SourceFile): ReadonlyMap<string, ResourcePrimitive> {
  const aliases = new Map<string, ResourcePrimitive>();
  let changed = true;
  while (changed) {
    changed = false;
    const bind = (name: string | null, primitive: ResourcePrimitive | undefined): void => {
      if (name === null || primitive === undefined || aliases.get(name) === primitive) return;
      aliases.set(name, primitive);
      changed = true;
    };
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
        if (ts.isIdentifier(node.name)) {
          bind(node.name.text, resourceReference(node.initializer, aliases));
        } else if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            const property = bindingName(element.propertyName ?? element.name);
            bind(bindingName(element.name), property === null ? undefined : callNames.get(property));
          }
        }
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        bind(node.left.text, resourceReference(node.right, aliases));
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return aliases;
}

function resourcePrimitivesFromSource(source: string, file: string): readonly string[] {
  const primitives: string[] = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const aliases = resourceAliases(sourceFile);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const primitive = resourceReference(node.expression, aliases);
      if (primitive !== undefined) primitives.push(primitive);
    }
    if (ts.isNewExpression(node)) {
      const primitive = resourceReference(node.expression, aliases);
      if (primitive !== undefined) primitives.push(primitive);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
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
  interface Scope {
    readonly bindings: Map<string, OwnerAlias | null>;
    readonly parent: Scope | null;
  }
  const rootScope: Scope = { bindings: new Map(), parent: null };
  const scopes = new WeakMap<ts.Node, Scope>();
  const buildScopes = (node: ts.Node, parent: Scope): void => {
    const scope = (ts.isFunctionLike(node) || ts.isBlock(node))
      ? { bindings: new Map(), parent }
      : parent;
    scopes.set(node, scope);
    ts.forEachChild(node, child => buildScopes(child, scope));
  };
  buildScopes(sourceFile, rootScope);
  const visit = (node: ts.Node, visitor: (current: ts.Node, scope: Scope) => void): void => {
    const scope = scopes.get(node)!;
    visitor(node, scope);
    ts.forEachChild(node, child => visit(child, visitor));
  };
  const declare = (scope: Scope, name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) {
      scope.bindings.set(name.text, null);
      return;
    }
    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declare(scope, element.name);
    }
  };
  visit(sourceFile, (node, scope) => {
    if (ts.isVariableDeclaration(node)) declare(scope, node.name);
    if (ts.isParameter(node)) {
      declare(scope, node.name);
      if (!ts.isIdentifier(node.name) || node.type === undefined) return;
      const type = node.type.getText(sourceFile);
      if (/\bWorkbookController\b/.test(type)) scope.bindings.set(node.name.text, 'controller-object');
      if (/\bUseCanvasEngineOptions\b/.test(type)) scope.bindings.set(node.name.text, 'canvas-options');
    }
  });
  const lookup = (scope: Scope, name: string): { readonly owner: Scope | null; readonly value: OwnerAlias | null } => {
    for (let current: Scope | null = scope; current !== null; current = current.parent) {
      if (current.bindings.has(name)) return { owner: current, value: current.bindings.get(name)! };
    }
    return { owner: null, value: null };
  };
  const aliasFor = (expression: ts.Expression, scope: Scope): OwnerAlias | undefined => {
    if (ts.isIdentifier(expression)) return lookup(scope, expression.text).value ?? undefined;
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      const property = expressionName(expression);
      if (
        expression.expression.kind === ts.SyntaxKind.ThisKeyword
        && property === 'registry'
      ) return 'registry-object';
      return ownershipMember(aliasFor(expression.expression, scope), property);
    }
    const target = boundTarget(expression);
    return target === null ? undefined : aliasFor(target, scope);
  };
  let changed = true;
  while (changed) {
    changed = false;
    const bind = (scope: Scope, name: string | null, alias: OwnerAlias | undefined): void => {
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
        const owner = aliasFor(node.initializer, scope);
        for (const element of node.name.elements) {
          bind(
            scope,
            bindingName(element.name),
            ownershipMember(owner, bindingName(element.propertyName ?? element.name)),
          );
        }
      } else if (
        ts.isBinaryExpression(node)
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)
      ) {
        const target = lookup(scope, node.left.text);
        if (target.owner !== null) bind(target.owner, node.left.text, aliasFor(node.right, scope));
      }
    });
  }
  const primitives: ResourcePrimitive[] = [];
  visit(sourceFile, (node, scope) => {
    if (!ts.isCallExpression(node)) return;
    const primitive = aliasFor(node.expression, scope);
    if (
      primitive !== undefined
      && primitive !== 'canvas-options'
      && !primitive.endsWith('-object')
    ) primitives.push(primitive as ResourcePrimitive);
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
