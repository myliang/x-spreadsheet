import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { canonicalizeWorkbook, TegoSheetException } from '../../core';
import type { WorkbookData, WorkbookInput } from '../../core';
import {
  WorkbookController,
  type ControllerSnapshot,
  type WorkbookControllerOptions,
} from '../../core/controller/workbook-controller';
import {
  createControllerExternalStore,
  type ControllerExternalStore,
} from '../adapters/controller-external-store';
import type { TegoSheetProps } from '../tego-sheet.types';

export type ControlMode = 'controlled' | 'uncontrolled';

export interface ControllerEpoch {
  readonly controller: WorkbookController;
  readonly store: ControllerExternalStore;
  readonly snapshot: ControllerSnapshot;
  readonly mode: ControlMode;
  readonly isActive: () => boolean;
}

export interface ControllerEpochRuntime {
  readonly createController?: (
    input: WorkbookInput,
    options: WorkbookControllerOptions,
  ) => WorkbookController;
}

interface InitialEpoch {
  readonly input: WorkbookData;
  readonly mode: ControlMode;
  readonly readOnly: boolean;
}

interface ActiveEpoch {
  readonly controller: WorkbookController;
  readonly store: ControllerExternalStore;
  readonly mode: ControlMode;
  readonly isActive: () => boolean;
}

interface EpochSlot {
  readonly activate: (epoch: ActiveEpoch) => void;
  readonly deactivate: (epoch: ActiveEpoch) => void;
  readonly getSnapshot: () => ActiveEpoch | null;
  readonly subscribe: (listener: () => void) => () => void;
}

const pendingSubscribe = () => () => undefined;
const pendingSnapshot = () => null;
const defaultCreateController = (
  input: WorkbookInput,
  options: WorkbookControllerOptions,
) => new WorkbookController(input, options);

function createEpochSlot(): EpochSlot {
  let snapshot: ActiveEpoch | null = null;
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

function disposeEpoch(
  store: ControllerExternalStore,
  controller: WorkbookController,
): void {
  const errors: unknown[] = [];
  try {
    store.dispose();
  } catch (error) {
    errors.push(error);
  }
  try {
    controller.dispose();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Controller epoch cleanup failed');
  }
}

function contractViolation(message: string): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message,
    recoverable: false,
  });
}

function controlMode(props: Pick<TegoSheetProps, 'value' | 'defaultValue'>): ControlMode {
  if (props.value !== undefined && props.defaultValue !== undefined) {
    throw contractViolation('value and defaultValue cannot be used together');
  }
  return props.value === undefined ? 'uncontrolled' : 'controlled';
}

function initialInput(props: Pick<TegoSheetProps, 'value' | 'defaultValue'>): WorkbookInput {
  if (props.value !== undefined) return props.value;
  if (props.defaultValue !== undefined) return props.defaultValue;
  return {};
}

export function useControllerEpoch(
  props: Pick<TegoSheetProps, 'value' | 'defaultValue' | 'readOnly'>,
  runtime: ControllerEpochRuntime = {},
): ControllerEpoch | null {
  const currentMode = controlMode(props);
  const [initial] = useState<InitialEpoch>(() => ({
    input: canonicalizeWorkbook(initialInput(props)),
    mode: currentMode,
    readOnly: props.readOnly ?? false,
  }));
  const [slot] = useState(createEpochSlot);
  const createController = runtime.createController ?? defaultCreateController;

  if (currentMode !== initial.mode) {
    throw contractViolation(
      `TegoSheet cannot switch from ${initial.mode} to ${currentMode} mode`,
    );
  }

  const active = useSyncExternalStore(
    slot.subscribe,
    slot.getSnapshot,
    slot.getSnapshot,
  );

  useEffect(() => {
    let activeFlag = true;
    const controller = createController(initial.input, { readOnly: initial.readOnly });
    const store = createControllerExternalStore(controller);
    const epoch: ActiveEpoch = {
      controller,
      store,
      mode: initial.mode,
      isActive: () => activeFlag,
    };
    slot.activate(epoch);
    return () => {
      activeFlag = false;
      slot.deactivate(epoch);
      disposeEpoch(store, controller);
    };
  }, [createController, initial, slot]);

  const snapshot = useSyncExternalStore<ControllerSnapshot | null>(
    active?.store.subscribe ?? pendingSubscribe,
    active?.store.getSnapshot ?? pendingSnapshot,
    active?.store.getServerSnapshot ?? pendingSnapshot,
  );

  useLayoutEffect(() => {
    if (active === null || !active.isActive()) return;
    active.controller.setReadOnly(props.readOnly ?? false);
    active.store.refresh();
  }, [active, props.readOnly]);

  if (active === null || snapshot === null || !active.isActive()) return null;
  return {
    controller: active.controller,
    store: active.store,
    snapshot,
    mode: active.mode,
    isActive: active.isActive,
  };
}
