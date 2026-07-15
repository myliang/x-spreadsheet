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

const callNames = new Map<string, string>([
  ['addEventListener', 'listener'],
  ['removeEventListener', 'listener'],
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

function resourcePrimitivesFromSource(source: string, file: string): readonly string[] {
  const primitives: string[] = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = expressionName(node.expression);
      const primitive = name === null || (ts.isIdentifier(node.expression) && propertyOnly.has(name))
        ? undefined
        : callNames.get(name);
      if (primitive !== undefined) primitives.push(primitive);
    }
    if (ts.isNewExpression(node) && expressionName(node.expression) === 'ResizeObserver') {
      primitives.push('observer');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
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

it('[ARCH-5] confines every section 6.6 browser resource primitive to its sole owner', () => {
  const files: string[] = [];
  const visitDirectory = (relative: string): void => {
    for (const entry of readdirSync(resolve(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visitDirectory(file);
      else if (/\.tsx?$/.test(file)) files.push(file);
    }
  };
  visitDirectory('src');
  const owners = new Map<string, Set<string>>();
  const record = (primitive: string, file: string): void => {
    const entries = owners.get(primitive) ?? new Set<string>();
    entries.add(file);
    owners.set(primitive, entries);
  };
  for (const file of files) {
    const source = readFileSync(resolve(root, file), 'utf8');
    for (const primitive of resourcePrimitivesFromSource(source, file)) record(primitive, file);
  }
  const ownership = new Map<string, ReadonlySet<string>>([
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
  for (const [primitive, allowed] of ownership) {
    expect(owners.get(primitive) ?? new Set(), primitive).toEqual(allowed);
  }
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
