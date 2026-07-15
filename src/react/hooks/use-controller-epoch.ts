import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { TegoSheetException } from '../../core';
import {
  WorkbookController,
  type ControllerSnapshot,
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
}

interface EpochState {
  readonly controller: WorkbookController;
  readonly store: ControllerExternalStore;
  readonly mode: ControlMode;
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

export function useControllerEpoch(
  props: Pick<TegoSheetProps, 'value' | 'defaultValue' | 'readOnly'>,
): ControllerEpoch {
  const currentMode = controlMode(props);
  const [epoch] = useState<EpochState>(() => {
    const controller = new WorkbookController(
      props.value ?? props.defaultValue ?? {},
      { readOnly: props.readOnly },
    );
    return {
      controller,
      store: createControllerExternalStore(controller),
      mode: currentMode,
    };
  });

  if (currentMode !== epoch.mode) {
    throw contractViolation(
      `TegoSheet cannot switch from ${epoch.mode} to ${currentMode} mode`,
    );
  }

  const snapshot = useSyncExternalStore(
    epoch.store.subscribe,
    epoch.store.getSnapshot,
    epoch.store.getServerSnapshot,
  );
  const lifecycleGeneration = useRef(0);

  useEffect(() => {
    epoch.controller.setReadOnly(props.readOnly ?? false);
    epoch.store.refresh();
  }, [epoch, props.readOnly]);

  useEffect(() => {
    const generation = lifecycleGeneration.current + 1;
    lifecycleGeneration.current = generation;
    return () => {
      // Strict Mode immediately reconnects the same pure controller epoch after
      // its effect rehearsal. A microtask distinguishes that rehearsal from a
      // final unmount without retaining any browser resource in the interim.
      void Promise.resolve().then(() => {
        if (lifecycleGeneration.current !== generation) return;
        epoch.store.dispose();
        epoch.controller.dispose();
      });
    };
  }, [epoch]);

  return {
    controller: epoch.controller,
    store: epoch.store,
    snapshot,
    mode: epoch.mode,
  };
}
