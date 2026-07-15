import { cleanup, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WorkbookController } from '../../src/core/controller/workbook-controller';
import { CanvasEngine, InteractionManager } from '../../src/engine';
import { TegoSheet } from '../../src';
import { createCanvasHarness } from '../helpers/canvas-harness';
import { ResourceLedger } from '../helpers/resource-ledger';

const zeroResources = Object.freeze({
  listener: 0,
  observer: 0,
  timer: 0,
  'animation-frame': 0,
  subscription: 0,
  overlay: 0,
});

beforeEach(() => {
  const context = createCanvasHarness().canvas.getContext('2d');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('balances Strict Mode resources and makes retained browser callbacks inert', async () => {
  const ledger = new ResourceLedger();
  const retainedObservers: Array<() => void> = [];
  const listeners = new WeakMap<object, Map<string, Array<{
    readonly listener: EventListenerOrEventListenerObject;
    readonly release: () => void;
  }>>>();
  const actualAdd = EventTarget.prototype.addEventListener;
  const actualRemove = EventTarget.prototype.removeEventListener;
  vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (
    this: EventTarget,
    type,
    listener,
    options,
  ) {
    actualAdd.call(this, type, listener, options);
    if (!(this === window || (this instanceof HTMLElement && this.matches('[data-tego-sheet]')))) {
      return;
    }
    const byType = listeners.get(this) ?? new Map();
    const entries = byType.get(type) ?? [];
    entries.push({ listener, release: ledger.acquire('listener') });
    byType.set(type, entries);
    listeners.set(this, byType);
  });
  vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (
    this: EventTarget,
    type,
    listener,
    options,
  ) {
    actualRemove.call(this, type, listener, options);
    const entries = listeners.get(this)?.get(type);
    const index = entries?.findIndex(entry => entry.listener === listener) ?? -1;
    if (entries !== undefined && index >= 0) entries.splice(index, 1)[0]!.release();
  });

  class LedgerResizeObserver {
    private release: (() => void) | null = null;
    constructor(callback: ResizeObserverCallback) {
      retainedObservers.push(() => callback([], this as unknown as ResizeObserver));
    }
    observe(): void {
      this.release ??= ledger.acquire('observer');
    }
    unobserve(): void {}
    disconnect(): void {
      this.release?.();
      this.release = null;
    }
  }
  vi.stubGlobal('ResizeObserver', LedgerResizeObserver);

  let nextFrame = 1;
  const frames = new Map<number, { callback: FrameRequestCallback; release: () => void }>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, { callback, release: ledger.acquire('animation-frame') });
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    const frame = frames.get(id);
    if (frame === undefined) return;
    frames.delete(id);
    frame.release();
  });

  const actualSubscribe = WorkbookController.prototype.subscribe;
  vi.spyOn(WorkbookController.prototype, 'subscribe').mockImplementation(function (
    this: WorkbookController,
    subscriber,
  ) {
    const release = ledger.acquire('subscription');
    const unsubscribe = actualSubscribe.call(this, subscriber);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      try {
        unsubscribe();
      } finally {
        release();
      }
    };
  });

  const rendered = render(
    <StrictMode><TegoSheet defaultValue={[{ name: 'A' }]} /></StrictMode>,
  );
  await waitFor(() => expect(rendered.container.querySelector('canvas')).not.toBeNull());
  expect(ledger.current().listener).toBeGreaterThan(0);
  expect(ledger.current().observer).toBe(1);
  expect(ledger.current().subscription).toBeGreaterThan(0);

  rendered.unmount();
  expect(ledger.current()).toEqual(zeroResources);

  for (const callback of retainedObservers) callback();
  expect(ledger.current()).toEqual(zeroResources);
});

it('cleans runtime resources in the specified ownership order', async () => {
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const order: string[] = [];
  let subscriptionSequence = 0;
  const actualSubscribe = WorkbookController.prototype.subscribe;
  vi.spyOn(WorkbookController.prototype, 'subscribe').mockImplementation(function (
    this: WorkbookController,
    subscriber,
  ) {
    subscriptionSequence += 1;
    const label = `subscription-${subscriptionSequence}`;
    const unsubscribe = actualSubscribe.call(this, subscriber);
    return () => {
      order.push(label);
      unsubscribe();
    };
  });
  const actualInteractionDispose = InteractionManager.prototype.dispose;
  vi.spyOn(InteractionManager.prototype, 'dispose').mockImplementation(function (
    this: InteractionManager,
  ) {
    order.push('interactions');
    actualInteractionDispose.call(this);
  });
  const actualEngineDispose = CanvasEngine.prototype.dispose;
  vi.spyOn(CanvasEngine.prototype, 'dispose').mockImplementation(function (this: CanvasEngine) {
    order.push('engine');
    actualEngineDispose.call(this);
  });
  const actualControllerDispose = WorkbookController.prototype.dispose;
  vi.spyOn(WorkbookController.prototype, 'dispose').mockImplementation(function (
    this: WorkbookController,
  ) {
    order.push('controller');
    actualControllerDispose.call(this);
  });

  const rendered = render(<TegoSheet defaultValue={[{}]} />);
  await waitFor(() => expect(rendered.container.querySelector('canvas')).not.toBeNull());
  rendered.unmount();

  expect(order).toEqual([
    'interactions',
    'subscription-1',
    'engine',
    'subscription-2',
    'controller',
  ]);
});
