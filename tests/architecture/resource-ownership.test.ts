import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { CanvasEngine } from '../../src/engine/canvas/canvas-engine';
import { ResourceRegistry } from '../../src/engine/interaction/resource-registry';
import { createCanvasHarness } from '../helpers/canvas-harness';

const root = resolve(import.meta.dirname, '../..');

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

it('[ARCH-5] confines browser resource creation to the documented sole owners', () => {
  const files = execFileSync('git', ['ls-files', '-z', 'src'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => /\.tsx?$/.test(file));
  const ownership = [
    { pattern: /\.(?:addEventListener|removeEventListener)\s*\(/, allowed: new Set([
      'src/engine/interaction/resource-registry.ts',
      'src/react/adapters/interaction-adapter.ts',
    ]) },
    { pattern: /new\s+ResizeObserver\s*\(/, allowed: new Set([
      'src/react/adapters/interaction-adapter.ts',
    ]) },
    { pattern: /globalThis\.(?:requestAnimationFrame|cancelAnimationFrame)\b/, allowed: new Set([
      'src/engine/canvas/render-scheduler.ts',
    ]) },
    { pattern: /\.setTimeout\s*\(/, allowed: new Set([
      'src/react/adapters/interaction-adapter.ts',
    ]) },
  ];

  for (const { pattern, allowed } of ownership) {
    const owners = files.filter(file => pattern.test(readFileSync(resolve(root, file), 'utf8')));
    expect(new Set(owners), pattern.source).toEqual(allowed);
  }
});

it('[ARCH-5] keeps the React disposal cascade ordered and covered by Strict Mode regression', () => {
  const component = readFileSync(resolve(root, 'src/react/tego-sheet.tsx'), 'utf8');
  expect(component.indexOf('useInteractionManager({')).toBeLessThan(component.indexOf('useCanvasEngine({'));

  const engineHook = readFileSync(resolve(root, 'src/react/hooks/use-canvas-engine.ts'), 'utf8');
  expect(engineHook.indexOf('append(errors, unsubscribe)')).toBeLessThan(
    engineHook.indexOf('append(errors, adapter.dispose)'),
  );

  const regression = readFileSync(resolve(root, 'tests/component/strict-mode-cleanup.test.tsx'), 'utf8');
  expect(regression).toMatch(/it\('balances Strict Mode resources and makes retained browser callbacks inert'/);
  for (const resource of ['listener', 'observer', 'timer', 'animation-frame', 'subscription', 'overlay']) {
    expect(regression, resource).toContain(resource);
  }
});
