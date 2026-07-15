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

interface ConnectionToken {
  active: boolean;
}

interface ControllerConnection {
  readonly token: ConnectionToken;
  readonly unsubscribe: () => void;
}

export function createControllerExternalStore(
  controller: WorkbookController,
): ControllerExternalStore {
  let snapshot = controller.getSnapshot();
  let controllerConnection: ControllerConnection | null = null;
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
    if (controllerConnection !== null || disposed) return;
    const token: ConnectionToken = { active: true };
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = controller.subscribe(event => {
        if (token.active) publish(event.snapshot);
      });
      const current = controller.getSnapshot();
      controllerConnection = { token, unsubscribe };
      snapshot = current;
    } catch (error) {
      token.active = false;
      try {
        unsubscribe?.();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'Controller connection and rollback cleanup failed',
        );
      }
      throw error;
    }
  };

  const disconnect = () => {
    const connection = controllerConnection;
    controllerConnection = null;
    if (connection === null) return;
    connection.token.active = false;
    connection.unsubscribe();
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
