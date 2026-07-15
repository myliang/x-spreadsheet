import type {
  ControllerSnapshot,
  WorkbookController,
} from '../../core/controller/workbook-controller';

export interface ControllerExternalStore {
  readonly getSnapshot: () => ControllerSnapshot;
  readonly getServerSnapshot: () => ControllerSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly refresh: () => void;
  readonly dispose: () => void;
}

export function createControllerExternalStore(
  controller: WorkbookController,
): ControllerExternalStore {
  let snapshot = controller.getSnapshot();
  let controllerUnsubscribe: (() => void) | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();

  const publish = (next: ControllerSnapshot) => {
    if (disposed) return;
    snapshot = next;
    let firstError: unknown;
    let failed = false;
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try {
        listener();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  };

  const connect = () => {
    if (controllerUnsubscribe !== null || disposed) return;
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = controller.subscribe(event => publish(event.snapshot));
      const current = controller.getSnapshot();
      controllerUnsubscribe = unsubscribe;
      snapshot = current;
    } catch (error) {
      try {
        unsubscribe?.();
      } catch {
        // Preserve the connection failure while leaving no local connection state.
      }
      throw error;
    }
  };

  const disconnect = () => {
    const unsubscribe = controllerUnsubscribe;
    controllerUnsubscribe = null;
    unsubscribe?.();
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      connect();
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        listeners.delete(listener);
        if (listeners.size === 0) disconnect();
      };
    },
    refresh() {
      if (disposed) return;
      publish(controller.getSnapshot());
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      disconnect();
    },
  };
}
