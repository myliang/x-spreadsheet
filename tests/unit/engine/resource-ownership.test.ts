import { describe, expect, it, vi } from 'vitest';
import { ResourceRegistry } from '../../../src/engine/interaction/resource-registry';
import {
  createInteractionManager,
  createSelectionState,
  createSheetGridModel,
  createViewportMetrics,
  type InteractionManagerPorts,
} from '../../../src/engine';
import { sheetId } from '../../../src/core';
import { ResourceLedger } from '../../helpers/resource-ledger';

class FakeTarget {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class LedgerTarget extends FakeTarget {
  private readonly releases = new Map<(event: unknown) => void, () => void>();
  adds = 0;

  constructor(
    private readonly ledger: ResourceLedger,
    private readonly throwAt?: number,
    private readonly removeError?: Error,
  ) {
    super();
  }

  override addEventListener(type: string, listener: (event: unknown) => void): void {
    this.adds += 1;
    super.addEventListener(type, listener);
    this.releases.set(listener, this.ledger.acquire('listener'));
    if (this.adds === this.throwAt) throw new Error(`add ${this.adds} failed`);
  }

  override removeEventListener(type: string, listener: (event: unknown) => void): void {
    super.removeEventListener(type, listener);
    this.releases.get(listener)?.();
    this.releases.delete(listener);
    if (this.removeError !== undefined) throw this.removeError;
  }
}

function managerPorts(
  root: FakeTarget,
  globalTarget: FakeTarget,
  overrides: Partial<InteractionManagerPorts> = {},
): InteractionManagerPorts {
  const model = createSheetGridModel({ rows: { len: 2 }, cols: { len: 2 } });
  const interactionRoot = root as FakeTarget & {
    contains(target: unknown): boolean;
    getBoundingClientRect(): { left: number; top: number };
  };
  interactionRoot.contains = target => target === interactionRoot;
  interactionRoot.getBoundingClientRect = () => ({ left: 0, top: 0 });
  return {
    root: interactionRoot,
    globalTarget,
    getSnapshot: () => ({
      viewport: createViewportMetrics(model, { width: 300, height: 200 }),
      selection: createSelectionState({ row: 0, column: 0 }),
      sheet: sheetId('sheet-1'),
      readOnly: false,
    }),
    setSelection: () => {},
    setScroll: () => {},
    dispatch: () => ({ status: 'committed' }),
    readSelection: () => [['']],
    commitEditor: () => true,
    requestEdit: () => {},
    requestDelete: () => {},
    requestContextMenu: () => {},
    requestSurfaceFocus: () => {},
    requestEnsureVisible: () => {},
    requestResizePreview: () => {},
    requestFormat: () => {},
    requestError: () => {},
    requestCancelTransient: () => {},
    ...overrides,
  };
}

describe('ResourceRegistry', () => {
  it('releases each owned browser resource exactly once and dispose is idempotent', () => {
    const ledger = new ResourceLedger();
    const registry = new ResourceRegistry();
    registry.observer(ledger.acquire('observer'));
    registry.timer(ledger.acquire('timer'));
    registry.animationFrame(ledger.acquire('animation-frame'));
    registry.subscription(ledger.acquire('subscription'));
    registry.overlay(ledger.acquire('overlay'));
    const target = new FakeTarget();
    const releaseListener = ledger.acquire('listener');
    registry.listen(target, 'ping', () => {}, undefined, releaseListener);

    registry.dispose();
    registry.dispose();

    expect(ledger.current()).toEqual(ledger.baseline());
    expect(target.listeners.get('ping')?.size).toBe(0);
  });

  it('drains every disposer when one throws and reports stable aggregate errors', () => {
    const calls: string[] = [];
    const registry = new ResourceRegistry();
    registry.own(() => calls.push('first'));
    registry.own(() => {
      calls.push('second');
      throw new Error('second failed');
    });
    registry.own(() => {
      calls.push('third');
      throw new Error('third failed');
    });

    expect(() => registry.dispose()).toThrowError(AggregateError);
    expect(calls).toEqual(['third', 'second', 'first']);
    expect(() => registry.dispose()).not.toThrow();
  });

  it('runs listener afterRemove even when DOM removal throws and aggregates both failures', () => {
    const registry = new ResourceRegistry();
    const removeError = new Error('remove failed');
    const afterError = new Error('after remove failed');
    const target = new FakeTarget();
    target.removeEventListener = () => { throw removeError; };
    const afterRemove = vi.fn(() => { throw afterError; });
    registry.listen(target, 'ping', () => {}, undefined, afterRemove);

    let thrown: unknown;
    try {
      registry.dispose();
    } catch (error) {
      thrown = error;
    }
    expect(afterRemove).toHaveBeenCalledOnce();
    expect(thrown).toBeInstanceOf(AggregateError);
    const cleanup = (thrown as AggregateError).errors[0] as AggregateError;
    expect(cleanup.errors).toEqual([removeError, afterError]);
    expect(() => registry.dispose()).not.toThrow();
  });

  it('makes guarded and late async callbacks inert after disposal', async () => {
    const registry = new ResourceRegistry();
    const callback = vi.fn();
    const guarded = registry.guard(callback);
    const promise = Promise.resolve().then(guarded);

    registry.dispose();
    guarded();
    await promise;

    expect(callback).not.toHaveBeenCalled();
    expect(registry.active).toBe(false);
  });

  it('supports strict create-dispose-create without shared module state', () => {
    const first = new ResourceRegistry();
    const second = new ResourceRegistry();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const guardedFirst = first.guard(firstCallback);
    const guardedSecond = second.guard(secondCallback);

    first.dispose();
    guardedFirst();
    guardedSecond();

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledOnce();
    expect(second.active).toBe(true);
    second.dispose();
  });

  it('rolls back every listener when binding or root observation fails during construction', () => {
    const addLedger = new ResourceLedger();
    const addRoot = new LedgerTarget(addLedger, 4);
    const addGlobal = new LedgerTarget(addLedger);
    expect(() => createInteractionManager({
      ports: managerPorts(addRoot, addGlobal),
    })).toThrow('add 4 failed');
    expect(addLedger.current()).toEqual(addLedger.baseline());
    expect([...addRoot.listeners.values(), ...addGlobal.listeners.values()]
      .every(listeners => listeners.size === 0)).toBe(true);

    const observeLedger = new ResourceLedger();
    const observeRoot = new LedgerTarget(observeLedger);
    const observeGlobal = new LedgerTarget(observeLedger);
    const observeError = new Error('observe failed');
    expect(() => createInteractionManager({
      ports: managerPorts(observeRoot, observeGlobal, {
        observeRoot: () => { throw observeError; },
      }),
    })).toThrow(observeError);
    expect(observeLedger.current()).toEqual(observeLedger.baseline());
  });

  it('preserves the constructor failure when rollback cleanup also fails', () => {
    const ledger = new ResourceLedger();
    const cleanupError = new Error('cleanup failed');
    const root = new LedgerTarget(ledger, undefined, cleanupError);
    const globalTarget = new LedgerTarget(ledger, undefined, cleanupError);
    const original = new Error('observe failed');
    let thrown: unknown;
    try {
      createInteractionManager({
        ports: managerPorts(root, globalTarget, {
          observeRoot: () => { throw original; },
        }),
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors[0]).toBe(original);
    expect(ledger.current()).toEqual(ledger.baseline());
  });

  it('drains manager listeners when transient, touch, and registry cleanup all throw', () => {
    const root = new FakeTarget() as FakeTarget & {
      contains(target: unknown): boolean;
      getBoundingClientRect(): { left: number; top: number };
    };
    root.contains = target => target === root;
    root.getBoundingClientRect = () => ({ left: 0, top: 0 });
    const globalTarget = new FakeTarget();
    const model = createSheetGridModel({ rows: { len: 2 }, cols: { len: 2 } });
    const preview = vi.fn((value: unknown) => {
      if (value === null) throw new Error('preview cleanup failed');
    });
    const transient = vi.fn(() => { throw new Error('transient cleanup failed'); });
    const cancelTimer = vi.fn(() => { throw new Error('touch cleanup failed'); });
    const manager = createInteractionManager({
      ports: {
        root,
        globalTarget,
        getSnapshot: () => ({
          viewport: createViewportMetrics(model, { width: 300, height: 200 }),
          selection: createSelectionState({ row: 0, column: 0 }),
          sheet: sheetId('sheet-1'),
          readOnly: false,
        }),
        setSelection: () => {},
        setScroll: () => {},
        dispatch: () => ({ status: 'committed' }),
        readSelection: () => [['']],
        commitEditor: () => true,
        requestEdit: () => {},
        requestDelete: () => {},
        requestContextMenu: () => {},
        requestSurfaceFocus: () => {},
        requestEnsureVisible: () => {},
        requestResizePreview: preview,
        requestFormat: () => {},
        requestError: () => {},
        requestCancelTransient: transient,
        setTimer: () => cancelTimer,
      },
    });
    const touch = { clientX: 100, clientY: 100 };
    root.emit('touchstart', { target: root, touches: [touch] });
    root.emit('touchend', { target: root, changedTouches: [touch], touches: [] });
    root.emit('pointerdown', { button: 0, buttons: 1, clientX: 160, clientY: 10, target: root });

    expect(() => manager.dispose()).toThrowError(AggregateError);
    expect(preview).toHaveBeenCalledWith(null);
    expect(transient).toHaveBeenCalledOnce();
    expect(cancelTimer).toHaveBeenCalledOnce();
    expect([...root.listeners.values(), ...globalTarget.listeners.values()]
      .every(listeners => listeners.size === 0)).toBe(true);
    expect(() => manager.dispose()).not.toThrow();
  });
});
