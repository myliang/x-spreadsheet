import { useCallback, useLayoutEffect, useRef } from 'react';
import type { CommandCommit } from '../../core/commands/command-result';
import type { WorkbookCommand } from '../../core/commands/workbook-command';
import type { WorkbookInput } from '../../core';
import {
  createControlledReconciler,
  type ControlledReconciler,
} from '../control/controlled-reconciler';
import type { ControllerEpoch } from './use-controller-epoch';
import type { TegoSheetCallbacks } from '../tego-sheet.types';

interface ControlledSlot {
  readonly controller: ControllerEpoch['controller'];
  readonly reconciler: ControlledReconciler;
}

export interface ControlledWorkbookRuntime {
  readonly getNotificationVersion: () => number;
  readonly recordCheckpoint: (commit: CommandCommit<unknown, WorkbookCommand>) => void;
}

export interface UseControlledWorkbookOptions {
  readonly epoch: ControllerEpoch | null;
  readonly value: WorkbookInput | undefined;
  readonly onError: TegoSheetCallbacks['onError'];
}

export function useControlledWorkbook(
  options: UseControlledWorkbookOptions,
): ControlledWorkbookRuntime {
  const { epoch, onError, value } = options;
  const slot = useRef<ControlledSlot | null>(null);

  useLayoutEffect(() => {
    if (epoch === null || epoch.mode !== 'controlled' || value === undefined) return;
    let current = slot.current;
    if (current === null || current.controller !== epoch.controller) {
      current = {
        controller: epoch.controller,
        reconciler: createControlledReconciler(epoch.controller),
      };
      slot.current = current;
    }
    const result = current.reconciler.reconcile(value);
    if (result.refresh) epoch.store.refresh();
    if (result.error !== undefined) onError?.(result.error);
  }, [epoch, onError, value]);

  useLayoutEffect(() => {
    const controller = epoch?.controller;
    return () => {
      if (slot.current?.controller === controller) slot.current = null;
    };
  }, [epoch?.controller]);

  const recordCheckpoint = useCallback((commit: CommandCommit<unknown, WorkbookCommand>) => {
    slot.current?.reconciler.record(commit);
  }, []);
  const getNotificationVersion = useCallback(
    () => slot.current?.reconciler.getNotificationVersion() ?? 0,
    [],
  );

  return { getNotificationVersion, recordCheckpoint };
}
