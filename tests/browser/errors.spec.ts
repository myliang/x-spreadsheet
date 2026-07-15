import { expect, test } from '@playwright/test';

test('@parity:correction.resource-cleanup returns browser resources to baseline after unmount', async ({ page }) => {
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
    (window as unknown as { __resourceCounts: () => unknown }).__resourceCounts = () => ({
      listeners: [...activeListeners.values()].filter(target => (
        target === window
        || target === document
        || !(target instanceof Node)
        || target.isConnected
      )).length,
      observers,
      printHosts: document.querySelectorAll('[data-tego-print-pages]').length,
    });
  });
  await page.goto('/?mounted=0');
  await expect(page.getByRole('button', { name: 'Mount sheet', exact: true })).toBeVisible();
  const baseline = await page.evaluate(() => (window as unknown as { __resourceCounts(): unknown }).__resourceCounts());
  await page.getByRole('button', { name: 'Mount sheet', exact: true }).click();
  await expect(page.locator('[data-tego-sheet]')).toHaveAttribute('data-mode', 'controlled');
  await page.getByRole('button', { name: 'Unmount sheet', exact: true }).click();
  await expect(page.locator('[data-tego-sheet]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __resourceCounts(): unknown }).__resourceCounts())).toEqual(baseline);
});
