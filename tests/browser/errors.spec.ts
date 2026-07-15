import { expect, test } from '@playwright/test';

interface ResourceCounts {
  readonly frames: number;
  readonly listeners: number;
  readonly observers: number;
  readonly overlays: number;
  readonly subscriptions: number;
  readonly timers: number;
}

test('@parity:correction.resource-cleanup returns every owned browser resource to baseline', async ({ page }) => {
  await page.addInitScript(() => {
    const activeListeners = new Map<string, EventTarget>();
    const listenerIds = new WeakMap<object, number>();
    let nextListenerId = 1;
    const key = (target: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (listener === null) return '';
      let id = listenerIds.get(listener as object);
      if (id === undefined) {
        id = nextListenerId;
        nextListenerId += 1;
        listenerIds.set(listener as object, id);
      }
      const capture = typeof options === 'boolean' ? options : options?.capture === true;
      return `${target === window ? 'window' : target === document ? 'document' : 'element'}:${type}:${id}:${capture}`;
    };
    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      activeListeners.set(key(this, type, listener, options), this);
      return originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function(type, listener, options) {
      activeListeners.delete(key(this, type, listener, options));
      return originalRemove.call(this, type, listener, options);
    };

    let observers = 0;
    const NativeResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      private active = false;
      observe(target: Element, options?: ResizeObserverOptions) {
        if (!this.active) {
          this.active = true;
          observers += 1;
        }
        return super.observe(target, options);
      }
      disconnect() {
        if (this.active) {
          this.active = false;
          observers -= 1;
        }
        return super.disconnect();
      }
    };

    const activeTimers = new Set<number>();
    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      let id = 0;
      const wrapped = typeof handler === 'function'
        ? () => {
          activeTimers.delete(id);
          handler(...args);
        }
        : handler;
      id = nativeSetTimeout(wrapped, timeout);
      activeTimers.add(id);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: number) => {
      if (id !== undefined) activeTimers.delete(id);
      nativeClearTimeout(id);
    }) as typeof window.clearTimeout;

    const activeFrames = new Set<number>();
    const nativeRequestFrame = window.requestAnimationFrame.bind(window);
    const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => {
      let id = 0;
      id = nativeRequestFrame(time => {
        activeFrames.delete(id);
        callback(time);
      });
      activeFrames.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => {
      activeFrames.delete(id);
      nativeCancelFrame(id);
    };

    let subscriptions = 0;
    const trackedSubscriptions = new WeakMap<object, Set<unknown>>();
    const nativeMapSet = Map.prototype.set;
    const nativeMapDelete = Map.prototype.delete;
    const nativeMapClear = Map.prototype.clear;
    Map.prototype.set = function(key, value) {
      const stack = new Error().stack ?? '';
      if (
        typeof value === 'function'
        && stack.includes('subscription-store')
        && !this.has(key)
      ) {
        const keys = trackedSubscriptions.get(this) ?? new Set<unknown>();
        keys.add(key);
        trackedSubscriptions.set(this, keys);
        subscriptions += 1;
      }
      return nativeMapSet.call(this, key, value);
    };
    Map.prototype.delete = function(key) {
      const deleted = nativeMapDelete.call(this, key);
      const keys = trackedSubscriptions.get(this);
      if (deleted && keys?.delete(key) === true) subscriptions -= 1;
      return deleted;
    };
    Map.prototype.clear = function() {
      const keys = trackedSubscriptions.get(this);
      if (keys !== undefined) {
        subscriptions -= keys.size;
        keys.clear();
      }
      return nativeMapClear.call(this);
    };

    (window as unknown as { __resourceCounts: () => ResourceCounts }).__resourceCounts = () => ({
      frames: activeFrames.size,
      listeners: [...activeListeners.values()].filter(target => (
        target === window
        || target === document
        || !(target instanceof Node)
        || target.isConnected
      )).length,
      observers,
      overlays: document.querySelectorAll([
        '.tego-sheet__cell-editor',
        '.tego-sheet__context-menu',
        '.tego-sheet__dialog',
        '.tego-sheet__filter-menu',
        '[data-tego-print-pages]',
      ].join(',')).length,
      subscriptions,
      timers: activeTimers.size,
    });
  });
  await page.goto('/?mounted=0');
  await expect(page.getByRole('button', { name: 'Mount sheet', exact: true })).toBeVisible();
  const counts = () => page.evaluate(() => (
    window as unknown as { __resourceCounts(): ResourceCounts }
  ).__resourceCounts());
  const baseline = await counts();
  await page.getByRole('button', { name: 'Mount sheet', exact: true }).click();
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-mode', 'controlled');
  const mounted = await counts();
  expect(mounted.listeners).toBeGreaterThan(baseline.listeners);
  expect(mounted.observers).toBeGreaterThan(baseline.observers);
  expect(mounted.subscriptions).toBeGreaterThan(baseline.subscriptions);

  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Filter' })).toBeVisible();
  const beforeUnmount = await page.evaluate(() => {
    const canvas = document.querySelector('.tego-sheet__canvas');
    if (canvas === null) throw new Error('canvas missing');
    const box = canvas.getBoundingClientRect();
    const touch = { identifier: 1, clientX: box.left + 100, clientY: box.top + 100 };
    const start = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'touches', { value: [touch] });
    canvas.dispatchEvent(start);
    const end = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperties(end, {
      changedTouches: { value: [touch] },
      touches: { value: [] },
    });
    canvas.dispatchEvent(end);
    window.__tegoHarness.recalculateLayout();
    const resources = (window as unknown as { __resourceCounts(): ResourceCounts }).__resourceCounts();
    window.__tegoHarness.unmount();
    return resources;
  });
  expect(beforeUnmount.timers).toBeGreaterThan(baseline.timers);
  expect(beforeUnmount.frames).toBeGreaterThan(baseline.frames);
  expect(beforeUnmount.overlays).toBeGreaterThan(baseline.overlays);
  await expect(page.locator('[data-tego-sheet]')).toHaveCount(0);
  await expect.poll(counts).toEqual(baseline);
});
