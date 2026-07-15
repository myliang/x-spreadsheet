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
  readonly createEpochSlot?: () => ControllerEpochSlot;
}

interface InitialEpoch {
  readonly input: WorkbookData;
  readonly mode: ControlMode;
  readonly readOnly: boolean;
  readonly initialRowCount: number | undefined;
  readonly initialColumnCount: number | undefined;
}

interface ActiveEpoch {
  readonly controller: WorkbookController;
  readonly store: ControllerExternalStore;
  readonly mode: ControlMode;
  readonly isActive: () => boolean;
}

export interface ControllerEpochSlot {
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

export function createControllerEpochSlot(): ControllerEpochSlot {
  let snapshot: ActiveEpoch | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
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

function attempt(errors: unknown[], operation: () => void): void {
  try {
    operation();
  } catch (error) {
    errors.push(error);
  }
}

function throwCollected(errors: readonly unknown[], message: string): never {
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, message);
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
  props: Pick<TegoSheetProps, 'value' | 'defaultValue' | 'readOnly' | 'options'>,
  runtime: ControllerEpochRuntime = {},
): ControllerEpoch | null {
  const currentMode = controlMode(props);
  const [initial] = useState<InitialEpoch>(() => {
    const initialRowCount = props.options?.rows?.initialCount;
    const initialColumnCount = props.options?.columns?.initialCount;
    return {
      input: canonicalizeWorkbook(initialInput(props), {
        rowCount: initialRowCount,
        columnCount: initialColumnCount,
      }),
      mode: currentMode,
      readOnly: props.readOnly ?? false,
      initialRowCount,
      initialColumnCount,
    };
  });
  const createEpochSlot = runtime.createEpochSlot ?? createControllerEpochSlot;
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
    let controller: WorkbookController | null = null;
    let store: ControllerExternalStore | null = null;
    let epoch: ActiveEpoch | null = null;
    try {
      const createdController = createController(initial.input, {
        readOnly: initial.readOnly,
        initialRowCount: initial.initialRowCount,
        initialColumnCount: initial.initialColumnCount,
      });
      controller = createdController;
      const createdStore = createControllerExternalStore(createdController);
      store = createdStore;
      const createdEpoch: ActiveEpoch = {
        controller: createdController,
        store: createdStore,
        mode: initial.mode,
        isActive: () => activeFlag,
      };
      epoch = createdEpoch;
      slot.activate(createdEpoch);
      return () => {
        activeFlag = false;
        const errors: unknown[] = [];
        attempt(errors, () => slot.deactivate(createdEpoch));
        attempt(errors, () => createdStore.dispose());
        attempt(errors, () => createdController.dispose());
        if (errors.length > 0) {
          throwCollected(errors, 'Controller epoch cleanup failed');
        }
      };
    } catch (error) {
      activeFlag = false;
      const errors: unknown[] = [error];
      if (epoch !== null) {
        const activatedEpoch = epoch;
        attempt(errors, () => slot.deactivate(activatedEpoch));
      }
      if (store !== null) {
        const createdStore = store;
        attempt(errors, () => createdStore.dispose());
      }
      if (controller !== null) {
        const createdController = controller;
        attempt(errors, () => createdController.dispose());
      }
      throwCollected(errors, 'Controller epoch setup failed');
    }
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
