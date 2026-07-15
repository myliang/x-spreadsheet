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
    snapshot = next;
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener();
    }
  };

  const connect = () => {
    if (controllerUnsubscribe !== null || disposed) return;
    controllerUnsubscribe = controller.subscribe(event => publish(event.snapshot));
    const current = controller.getSnapshot();
    if (
      current.revision !== snapshot.revision
      || current.readOnly !== snapshot.readOnly
      || current.canUndo !== snapshot.canUndo
      || current.canRedo !== snapshot.canRedo
    ) {
      publish(current);
    }
  };

  const disconnect = () => {
    controllerUnsubscribe?.();
    controllerUnsubscribe = null;
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      connect();
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
      disconnect();
      listeners.clear();
    },
  };
}
