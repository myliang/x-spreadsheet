import { useLayoutEffect, type RefObject } from 'react';
import type { SheetId } from '../../core';
import type { Selection } from '../../core';
import type { EventDispatcher } from '../adapters/event-dispatcher';
import { createInteractionAdapter } from '../adapters/interaction-adapter';
import type { ControllerEpoch } from './use-controller-epoch';
import type { EngineAdapterSlot } from './use-canvas-engine';

export interface UseInteractionManagerOptions {
  readonly dispatcher: EventDispatcher;
  readonly activeSheet: SheetId | null;
  readonly engineGeneration: number;
  readonly engineSlot: EngineAdapterSlot;
  readonly epoch: ControllerEpoch;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly showContextMenu?: boolean;
  readonly minimumColumnWidth?: number;
  readonly onSelectionChange?: (selection: Selection | null) => void;
}

export function useInteractionManager(options: UseInteractionManagerOptions): void {
  const {
    activeSheet,
    dispatcher,
    engineGeneration,
    engineSlot,
    epoch,
    rootRef,
    showContextMenu,
    minimumColumnWidth,
    onSelectionChange,
  } = options;
  const { controller, isActive } = epoch;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const engine = engineSlot.get();
    if (
      root === null
      || engine === null
      || !isActive()
      || typeof window === 'undefined'
    ) return;
    engine.render(controller.getSnapshot(), activeSheet);
    const manager = createInteractionAdapter({
      controller,
      dispatcher,
      engine,
      root,
      globalTarget: window,
      contextMenuEnabled: () => showContextMenu !== false,
      minimumColumnWidth,
      onSelectionChange,
    });
    if (manager !== null && document.activeElement === root) manager.focus();
    return () => manager?.dispose();
  }, [
    controller,
    activeSheet,
    dispatcher,
    engineGeneration,
    engineSlot,
    isActive,
    rootRef,
    showContextMenu,
    minimumColumnWidth,
    onSelectionChange,
  ]);
}
