import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import {
  WorkbookController,
  type WorkbookControllerOptions,
} from '../../src/core/controller/workbook-controller';
import type { WorkbookInput } from '../../src/core';
import {
  createControllerExternalStore,
  type ControllerExternalStore,
} from '../../src/react/adapters/controller-external-store';
import {
  createControllerEpochSlot,
  useControllerEpoch,
} from '../../src/react/hooks/use-controller-epoch';
import { renderSheet } from '../helpers/render-sheet';

type ActiveEpochLike = Pick<
  NonNullable<ReturnType<typeof useControllerEpoch>>,
  'controller' | 'store' | 'mode' | 'isActive'
>;

interface TestEpochSlot {
  activate(epoch: ActiveEpochLike): void;
  deactivate(epoch: ActiveEpochLike): void;
  getSnapshot(): ActiveEpochLike | null;
  subscribe(listener: () => void): () => void;
}

function createTestEpochSlot(): TestEpochSlot {
  let snapshot: ActiveEpochLike | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener();
    }
  };
  return {
    activate(epoch) {
      snapshot = epoch;
      publish();
    },
    deactivate(epoch) {
      if (snapshot !== epoch) return;
      snapshot = null;
      publish();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

it('commits slot transitions and drains listeners before rethrowing the first error', () => {
  const controller = new WorkbookController([{}]);
  const store = createControllerExternalStore(controller);
  const slot = createControllerEpochSlot();
  const epoch: ActiveEpochLike = {
    controller,
    store,
    mode: 'uncontrolled',
    isActive: () => true,
  };
  const activateError = new Error('activate listener failed');
  const deactivateError = new Error('deactivate listener failed');
  let listenerError = activateError;
  const first = vi.fn(() => {
    throw listenerError;
  });
  const second = vi.fn();
  slot.subscribe(first);
  slot.subscribe(second);

  expect(() => slot.activate(epoch)).toThrow(activateError);
  expect(slot.getSnapshot()).toBe(epoch);
  expect(second).toHaveBeenCalledOnce();

  listenerError = deactivateError;
  expect(() => slot.deactivate(epoch)).toThrow(deactivateError);
  expect(slot.getSnapshot()).toBeNull();
  expect(second).toHaveBeenCalledTimes(2);

  store.dispose();
  controller.dispose();
});

it('initializes a single blank sheet from an empty object', () => {
  const rendered = renderSheet({ defaultValue: {} });

  expect(rendered.container.querySelector('output')?.getAttribute('data-mode')).toBe(
    'uncontrolled',
  );
  expect(rendered.container.querySelector('output')?.getAttribute('data-sheets')).toBe('1');
  expect(rendered.runtime.epoch.controller.getValue()).toHaveLength(1);
});

it('preserves an empty array as an empty workbook', () => {
  const rendered = renderSheet({ defaultValue: [] });

  expect(rendered.container.querySelector('output')?.getAttribute('data-sheets')).toBe('0');
  expect(rendered.runtime.epoch.controller.getValue()).toEqual([]);
});

it('reads defaultValue only for the controller epoch initialization', () => {
  const rendered = renderSheet({ defaultValue: [{ name: 'Initial' }] });

  rendered.rerenderProps({ defaultValue: [{ name: 'Ignored' }] });

  expect(rendered.runtime.epoch.controller.getValue()[0]?.name).toBe('Initial');
});

it('keeps the controller epoch usable through Strict Mode effect replay', () => {
  const rendered = renderSheet({ defaultValue: [{}] }, { strict: true });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  expect(() => act(() => {
    rendered.runtime.dispatchRef({
      type: 'set-cell-text',
      address: { sheet, row: 0, column: 0 },
      text: 'strict',
    });
  })).not.toThrow();
});

it('creates no controller for an aborted render and disposes every Strict Mode epoch once', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let created = 0;
  let disposed = 0;
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    created += 1;
    const controller = new WorkbookController(input, options);
    const dispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      disposed += 1;
      dispose();
    };
    return controller;
  };

  function Aborted(): never {
    useControllerEpoch({ defaultValue: [{}] }, { createController });
    throw new Error('abort render');
  }
  expect(() => render(<Aborted />)).toThrow('abort render');
  expect(created).toBe(0);

  function Mounted() {
    const epoch = useControllerEpoch({ defaultValue: [{}] }, { createController });
    return <output>{epoch?.snapshot.revision ?? 'pending'}</output>;
  }
  const mounted = render(<StrictMode><Mounted /></StrictMode>);
  expect(created).toBe(2);
  expect(disposed).toBe(1);
  mounted.unmount();
  expect(disposed).toBe(2);
});

it('rolls back an activated epoch when a slot listener throws during setup', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const activateError = new Error('activate listener failed');
  const slot = createTestEpochSlot();
  let throwsRemaining = 1;
  slot.subscribe(() => {
    if (throwsRemaining > 0) {
      throwsRemaining -= 1;
      throw activateError;
    }
  });
  let controller: WorkbookController | undefined;
  let activatedEpoch: ActiveEpochLike | undefined;
  const dispose = vi.fn();
  const activate = slot.activate.bind(slot);
  slot.activate = epoch => {
    activatedEpoch = epoch;
    activate(epoch);
  };
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    controller = new WorkbookController(input, options);
    const actualDispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      dispose();
      actualDispose();
    };
    return controller;
  };
  const runtime = {
    createController,
    createEpochSlot: () => slot,
  };

  function Mounted() {
    useControllerEpoch({ defaultValue: [{}] }, runtime);
    return null;
  }

  let unmount: (() => void) | undefined;
  let thrown: unknown;
  try {
    unmount = render(<Mounted />).unmount;
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) unmount?.();

  expect(thrown).toBe(activateError);
  expect(dispose).toHaveBeenCalledOnce();
  expect(slot.getSnapshot()).toBeNull();
  expect(activatedEpoch?.isActive()).toBe(false);
  expect(() => controller?.validate()).toThrow(/disposed/i);
});

it('disposes a created controller when initial store snapshot construction fails', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const snapshotError = new Error('initial snapshot failed');
  let controller: WorkbookController | undefined;
  const dispose = vi.fn();
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    controller = new WorkbookController(input, options);
    controller.getSnapshot = () => {
      throw snapshotError;
    };
    const actualDispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      dispose();
      actualDispose();
    };
    return controller;
  };

  function Mounted() {
    useControllerEpoch({ defaultValue: [{}] }, { createController });
    return null;
  }

  expect(() => render(<Mounted />)).toThrow(snapshotError);
  expect(dispose).toHaveBeenCalledOnce();
  expect(() => controller?.validate()).toThrow(/disposed/i);
});

it('preserves setup and both resource cleanup errors in order', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const activateError = new Error('activate failed');
  const storeDisposeError = new Error('store dispose failed');
  const controllerDisposeError = new Error('controller dispose failed');
  const slot = createTestEpochSlot();
  let throwsRemaining = 1;
  slot.subscribe(() => {
    if (throwsRemaining > 0) {
      throwsRemaining -= 1;
      throw activateError;
    }
  });
  let controller: WorkbookController | undefined;
  let activatedEpoch: ActiveEpochLike | undefined;
  const activate = slot.activate.bind(slot);
  slot.activate = epoch => {
    activatedEpoch = epoch;
    const actualStoreDispose = epoch.store.dispose.bind(epoch.store);
    (epoch.store as { dispose: () => void }).dispose = () => {
      actualStoreDispose();
      throw storeDisposeError;
    };
    activate(epoch);
  };
  const dispose = vi.fn();
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    controller = new WorkbookController(input, options);
    const actualDispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      dispose();
      actualDispose();
      throw controllerDisposeError;
    };
    return controller;
  };
  const runtime = {
    createController,
    createEpochSlot: () => slot,
  };

  function Mounted() {
    useControllerEpoch({ defaultValue: [{}] }, runtime);
    return null;
  }

  let unmount: (() => void) | undefined;
  let thrown: unknown;
  try {
    unmount = render(<Mounted />).unmount;
  } catch (error) {
    thrown = error;
  }
  if (thrown === undefined) {
    try {
      unmount?.();
    } catch {
      // The pre-fix path reaches normal teardown instead of failing setup.
    }
  }
  expect(thrown).toBeInstanceOf(AggregateError);
  expect((thrown as AggregateError).errors).toEqual([
    activateError,
    storeDisposeError,
    controllerDisposeError,
  ]);
  expect(dispose).toHaveBeenCalledOnce();
  expect(slot.getSnapshot()).toBeNull();
  expect(activatedEpoch?.isActive()).toBe(false);
  expect(() => controller?.validate()).toThrow(/disposed/i);
});

it('attempts slot and both resource cleanups after making the epoch inactive', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const deactivateError = new Error('deactivate listener failed');
  const storeDisposeError = new Error('store dispose failed');
  const controllerDisposeError = new Error('controller dispose failed');
  const slot = createTestEpochSlot();
  let throwOnDeactivate = false;
  let activeDuringDeactivate: boolean | undefined;
  let epoch: ActiveEpochLike | undefined;
  slot.subscribe(() => {
    if (throwOnDeactivate && slot.getSnapshot() === null) {
      activeDuringDeactivate = epoch?.isActive();
      throw deactivateError;
    }
  });
  const dispose = vi.fn();
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    const controller = new WorkbookController(input, options);
    const actualDispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      dispose();
      actualDispose();
      throw controllerDisposeError;
    };
    return controller;
  };
  const runtime = {
    createController,
    createEpochSlot: () => slot,
  };

  function Mounted() {
    const active = useControllerEpoch({ defaultValue: [{}] }, runtime);
    if (active !== null) epoch = active;
    return null;
  }

  const mounted = render(<Mounted />);
  if (epoch === undefined) throw new Error('epoch did not activate');
  const actualStoreDispose = epoch.store.dispose.bind(epoch.store);
  (epoch.store as { dispose: () => void }).dispose = () => {
    actualStoreDispose();
    throw storeDisposeError;
  };
  throwOnDeactivate = true;
  let thrown: unknown;
  try {
    mounted.unmount();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(AggregateError);
  expect((thrown as AggregateError).errors).toEqual([
    deactivateError,
    storeDisposeError,
    controllerDisposeError,
  ]);
  expect(activeDuringDeactivate).toBe(false);
  expect(dispose).toHaveBeenCalledOnce();
  expect(() => epoch?.controller.validate()).toThrow(/disposed/i);
});

it('makes an unmounted epoch synchronously inactive', () => {
  const rendered = renderSheet({ defaultValue: [{}] });
  const staleDispatcher = rendered.runtime.dispatcher;
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  rendered.unmount();

  expect(() => staleDispatcher.dispatchRef({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'after unmount',
  })).toThrow(/disposed|inactive/i);
});

it('disposes the controller once when store cleanup throws during epoch teardown', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const unsubscribeError = new Error('unsubscribe failed');
  let controller: WorkbookController | undefined;
  let store: ControllerExternalStore | undefined;
  const dispose = vi.fn();
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    controller = new WorkbookController(input, options);
    const actualSubscribe = controller.subscribe.bind(controller);
    controller.subscribe = listener => {
      const unsubscribe = actualSubscribe(listener);
      return () => {
        unsubscribe();
        throw unsubscribeError;
      };
    };
    const actualDispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      dispose();
      actualDispose();
    };
    return controller;
  };

  function Mounted() {
    const epoch = useControllerEpoch({ defaultValue: [{}] }, { createController });
    if (epoch !== null) store = epoch.store;
    return <output>{epoch?.snapshot.revision ?? 'pending'}</output>;
  }

  const mounted = render(<Mounted />);
  if (store === undefined || controller === undefined) throw new Error('epoch did not activate');
  const activeController = controller;
  store.subscribe(() => undefined);
  let thrown: unknown;
  try {
    mounted.unmount();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBe(unsubscribeError);
  expect(dispose).toHaveBeenCalledOnce();
  expect(() => activeController.validate()).toThrow(/disposed/i);
});

it('aggregates store and controller errors after attempting both epoch cleanups', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const unsubscribeError = new Error('unsubscribe failed');
  const controllerDisposeError = new Error('controller dispose failed');
  let controller: WorkbookController | undefined;
  let store: ControllerExternalStore | undefined;
  const dispose = vi.fn();
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    controller = new WorkbookController(input, options);
    const actualSubscribe = controller.subscribe.bind(controller);
    controller.subscribe = listener => {
      const unsubscribe = actualSubscribe(listener);
      return () => {
        unsubscribe();
        throw unsubscribeError;
      };
    };
    const actualDispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      dispose();
      actualDispose();
      throw controllerDisposeError;
    };
    return controller;
  };

  function Mounted() {
    const epoch = useControllerEpoch({ defaultValue: [{}] }, { createController });
    if (epoch !== null) store = epoch.store;
    return <output>{epoch?.snapshot.revision ?? 'pending'}</output>;
  }

  const mounted = render(<Mounted />);
  if (store === undefined || controller === undefined) throw new Error('epoch did not activate');
  const activeController = controller;
  store.subscribe(() => undefined);
  let thrown: unknown;
  try {
    mounted.unmount();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(AggregateError);
  expect((thrown as AggregateError).errors).toEqual([
    unsubscribeError,
    controllerDisposeError,
  ]);
  expect(dispose).toHaveBeenCalledOnce();
  expect(() => activeController.validate()).toThrow(/disposed/i);
});

it('catches up the external snapshot on delayed first subscribe and reconnect', () => {
  const controller = new WorkbookController([{}]);
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;

  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'before subscribe',
  }, 'ref');
  const first = vi.fn();
  const disconnect = store.subscribe(first);
  expect(store.getSnapshot().revision).toBe(1);
  expect(first).not.toHaveBeenCalled();

  disconnect();
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'while disconnected',
  }, 'ref');
  const second = vi.fn();
  store.subscribe(second);
  expect(store.getSnapshot().revision).toBe(2);
  expect(second).not.toHaveBeenCalled();

  store.dispose();
  controller.dispose();
});

it('adopts a same-revision branch after a disconnected checkpoint restore', () => {
  const controller = new WorkbookController([{}]);
  const base = controller.checkpoint();
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;
  const disconnect = store.subscribe(() => undefined);
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'branch A',
  }, 'ref');
  expect(store.getSnapshot().revision).toBe(1);
  disconnect();

  controller.restore(base);
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'branch B',
  }, 'ref');
  const listener = vi.fn();
  store.subscribe(listener);

  expect(store.getSnapshot().revision).toBe(1);
  expect(store.getSnapshot().value[0]?.rows?.[0]).toMatchObject({
    cells: { 0: { text: 'branch B' } },
  });
  expect(listener).not.toHaveBeenCalled();

  store.dispose();
  controller.dispose();
});

it('makes a failed connection inert when rollback cleanup also throws', () => {
  const controller = new WorkbookController([{}]);
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;
  const connectError = new Error('snapshot refresh failed');
  const cleanupError = new Error('rollback cleanup failed');
  const actualSubscribe = controller.subscribe.bind(controller);
  vi.spyOn(controller, 'subscribe').mockImplementation(listener => {
    actualSubscribe(listener);
    return () => {
      throw cleanupError;
    };
  });
  const getSnapshot = vi.spyOn(controller, 'getSnapshot')
    .mockImplementationOnce(() => {
      throw connectError;
    });

  let thrown: unknown;
  try {
    store.subscribe(vi.fn());
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(AggregateError);
  expect((thrown as AggregateError).errors).toEqual([connectError, cleanupError]);
  getSnapshot.mockRestore();
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'late rollback event',
  }, 'ref');
  expect(store.getSnapshot().revision).toBe(0);

  const liveListener = vi.fn();
  const disconnect = store.subscribe(liveListener);
  expect(liveListener).not.toHaveBeenCalled();
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 1, column: 0 },
    text: 'after reconnect',
  }, 'ref');
  expect(liveListener).toHaveBeenCalledOnce();

  expect(() => disconnect()).toThrow(cleanupError);
  store.dispose();
  controller.dispose();
});

it('notifies every current listener before rethrowing the first listener error', () => {
  const controller = new WorkbookController([{}]);
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;
  const firstError = new Error('first listener failed');
  let shouldThrow = false;
  const first = vi.fn(() => {
    if (shouldThrow) throw firstError;
  });
  const second = vi.fn();
  const disconnectFirst = store.subscribe(first);
  const disconnectSecond = store.subscribe(second);
  first.mockClear();
  second.mockClear();
  shouldThrow = true;

  expect(() => controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'committed despite notification error',
  }, 'ref')).toThrow(firstError);
  expect(first).toHaveBeenCalledOnce();
  expect(second).toHaveBeenCalledOnce();
  expect(controller.getCellText({ sheet, row: 0, column: 0 })).toBe(
    'committed despite notification error',
  );

  shouldThrow = false;
  disconnectFirst();
  disconnectSecond();
  store.dispose();
  controller.dispose();
});

it('makes a disconnected connection inert before a failing cleanup', () => {
  const controller = new WorkbookController([{}]);
  const actualSubscribe = controller.subscribe.bind(controller);
  const cleanupError = new Error('disconnect failed');
  const subscribe = vi.spyOn(controller, 'subscribe').mockImplementation(listener => {
    actualSubscribe(listener);
    return () => {
      throw cleanupError;
    };
  });
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;
  const disconnectFirst = store.subscribe(vi.fn());

  expect(() => disconnectFirst()).toThrow(cleanupError);
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'late disconnected event',
  }, 'ref');
  expect(store.getSnapshot().revision).toBe(0);

  const second = vi.fn();
  const disconnectSecond = store.subscribe(second);
  expect(subscribe).toHaveBeenCalledTimes(2);
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 1, column: 0 },
    text: 'after reconnect',
  }, 'ref');
  expect(second).toHaveBeenCalledOnce();

  expect(() => disconnectSecond()).toThrow(cleanupError);
  store.dispose();
  controller.dispose();
});

it('clears listeners even when controller cleanup throws during dispose', () => {
  const controller = new WorkbookController([{}]);
  const actualSubscribe = controller.subscribe.bind(controller);
  const cleanupError = new Error('dispose disconnect failed');
  vi.spyOn(controller, 'subscribe').mockImplementation(listener => {
    actualSubscribe(listener);
    return () => {
      throw cleanupError;
    };
  });
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;
  const leakedListenerError = new Error('disposed listener leaked');
  let shouldThrow = false;
  const listener = vi.fn(() => {
    if (shouldThrow) throw leakedListenerError;
  });
  store.subscribe(listener);
  listener.mockClear();
  shouldThrow = true;

  expect(() => store.dispose()).toThrow(cleanupError);
  expect(() => controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'after failed dispose',
  }, 'ref')).not.toThrow();
  expect(listener).not.toHaveBeenCalled();

  controller.dispose();
});
