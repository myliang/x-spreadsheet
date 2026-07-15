import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { LocaleDefinition, SheetId, SheetOptions } from '../../core';
import type { ControllerEpoch } from './use-controller-epoch';
import {
  createEngineAdapter,
  type EngineAdapter,
} from '../adapters/engine-adapter';

export interface UseCanvasEngineOptions {
  readonly activeSheet: SheetId | null;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly enabled: boolean;
  readonly engineSlot: EngineAdapterSlot;
  readonly epoch: ControllerEpoch;
  readonly onReady: () => void;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly sheetOptions?: SheetOptions;
  readonly showGrid?: boolean;
  readonly locale?: LocaleDefinition;
  readonly onRenderError?: (cause: unknown) => void;
  readonly onSelectionChange?: (selection: import('../../core').Selection | null) => void;
}

export interface EngineAdapterSlot {
  readonly clear: (adapter: EngineAdapter) => void;
  readonly get: () => EngineAdapter | null;
  readonly set: (adapter: EngineAdapter) => void;
}

export function createEngineAdapterSlot(): EngineAdapterSlot {
  let current: EngineAdapter | null = null;
  return {
    clear(adapter) {
      if (current === adapter) current = null;
    },
    get: () => current,
    set(adapter) {
      current = adapter;
    },
  };
}

function append(errors: unknown[], operation: () => void): void {
  try {
    operation();
  } catch (error) {
    errors.push(error);
  }
}

function throwCleanup(errors: readonly unknown[]): never {
  if (errors.length === 1) throw errors[0];
  throw new AggregateError(errors, 'Canvas runtime cleanup failed');
}

export function useCanvasEngine(options: UseCanvasEngineOptions): void {
  const {
    activeSheet,
    canvasRef,
    enabled,
    engineSlot,
    epoch,
    onReady,
    rootRef,
    locale,
    onRenderError,
    sheetOptions,
    showGrid,
    onSelectionChange,
  } = options;
  const { controller, isActive } = epoch;
  const onRenderErrorRef = useRef(onRenderError);

  useLayoutEffect(() => {
    onRenderErrorRef.current = onRenderError;
  }, [onRenderError]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!enabled || root === null || canvas === null || !isActive()) return;
    let adapter: EngineAdapter | null = null;
    let unsubscribe: (() => void) | null = null;
    const token = { active: true };
    try {
      adapter = createEngineAdapter({
        root,
        canvas,
        sheetOptions,
        locale,
        onRenderError: cause => {
          const handler = onRenderErrorRef.current;
          if (handler === undefined) throw cause;
          handler(cause);
        },
      });
      engineSlot.set(adapter);
      adapter.refresh(controller.getSnapshot());
      unsubscribe = controller.subscribe(event => {
        if (token.active && isActive()) {
          adapter?.refresh(event.snapshot);
        }
      });
      onReady();
      return () => {
        token.active = false;
        if (adapter !== null) engineSlot.clear(adapter);
        const errors: unknown[] = [];
        if (unsubscribe !== null) append(errors, unsubscribe);
        if (adapter !== null) append(errors, adapter.dispose);
        if (errors.length > 0) throwCleanup(errors);
      };
    } catch (error) {
      token.active = false;
      if (adapter !== null) engineSlot.clear(adapter);
      const errors: unknown[] = [error];
      if (unsubscribe !== null) append(errors, unsubscribe);
      if (adapter !== null) append(errors, adapter.dispose);
      if (errors.length === 1) throw error;
      throw new AggregateError(errors, 'Canvas runtime setup failed', { cause: error });
    }
  }, [
    canvasRef,
    controller,
    enabled,
    engineSlot,
    isActive,
    locale,
    onReady,
    rootRef,
    sheetOptions,
  ]);

  useLayoutEffect(() => {
    if (!isActive()) return;
    const engine = engineSlot.get();
    engine?.render(epoch.snapshot, activeSheet);
    onSelectionChange?.(engine?.publicSelection() ?? null);
  }, [activeSheet, engineSlot, epoch.snapshot, isActive, onSelectionChange]);

  useLayoutEffect(() => {
    if (!isActive()) return;
    engineSlot.get()?.updateLiveOptions({ showGrid });
  }, [engineSlot, isActive, showGrid]);
}
