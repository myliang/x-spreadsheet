import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ForwardedRef,
} from 'react';
import {
  selectCell,
  selectCellStyle,
  TegoSheetException,
  type CellAddress,
  type CellStyle,
  type ChangeSource,
  type SheetId,
} from '../core';
import type { WorkbookCommand } from '../core/commands/workbook-command';
import { createEventDispatcher } from './adapters/event-dispatcher';
import {
  createEngineAdapterSlot,
  useCanvasEngine,
} from './hooks/use-canvas-engine';
import {
  useControllerEpoch,
  type ControllerEpoch,
} from './hooks/use-controller-epoch';
import { useInteractionManager } from './hooks/use-interaction-manager';
import {
  useControlledWorkbook,
  type ControlledWorkbookRuntime,
} from './hooks/use-controlled-workbook';
import type {
  TegoSheetCallbacks,
  TegoSheetHandle,
  TegoSheetProps,
} from './tego-sheet.types';

function callbacksFromProps(props: TegoSheetProps): TegoSheetCallbacks {
  return {
    onActiveSheetChange: props.onActiveSheetChange,
    onCellEdit: props.onCellEdit,
    onChange: props.onChange,
    onError: props.onError,
    onPaste: props.onPaste,
    onSelectionChange: props.onSelectionChange,
  };
}

interface CallbackStore {
  readonly get: () => TegoSheetCallbacks;
  readonly set: (callbacks: TegoSheetCallbacks) => void;
}

function createCallbackStore(initial: TegoSheetCallbacks): CallbackStore {
  let current = initial;
  return {
    get: () => current,
    set(callbacks) {
      current = callbacks;
    },
  };
}

function classNames(value: string | undefined): string {
  return value === undefined || value.trim().length === 0
    ? 'tego-sheet'
    : `tego-sheet ${value}`;
}

function invalid(message: string): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message,
    recoverable: true,
  });
}

function contractViolation(message: string): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message,
    recoverable: false,
  });
}

function committedResult(
  dispatcher: ReturnType<typeof createEventDispatcher>,
  command: WorkbookCommand,
  source: ChangeSource,
): unknown {
  const outcome = dispatcher.dispatchRef(command, source);
  return outcome.status === 'committed' ? outcome.commit.result : undefined;
}

interface ImperativeRuntime {
  readonly activeSheet: SheetId | null;
  readonly controller: ControllerEpoch['controller'];
  readonly defaultStyle: CellStyle | undefined;
  readonly dispatcher: ReturnType<typeof createEventDispatcher>;
  readonly engineSlot: ReturnType<typeof createEngineAdapterSlot>;
  readonly isActive: () => boolean;
  readonly root: HTMLDivElement | null;
  readonly setActiveSheet: (sheet: SheetId | null) => void;
}

interface ImperativeRuntimeCapture {
  readonly activeDecisionVersion: number;
  readonly runtime: ImperativeRuntime;
}

interface ImperativeRuntimeSlot {
  readonly capture: () => ImperativeRuntimeCapture;
  readonly compareAndSetActiveSheet: (
    capture: ImperativeRuntimeCapture,
    sheet: SheetId | null,
  ) => boolean;
  readonly deactivate: () => void;
  readonly require: () => ImperativeRuntime;
  readonly setActiveSheet: (sheet: SheetId | null) => void;
  readonly update: (runtime: ImperativeRuntime) => void;
}

function inactiveRuntime(): TegoSheetException {
  return invalid('TegoSheet handle runtime is inactive');
}

function createImperativeRuntimeSlot(): ImperativeRuntimeSlot {
  let current: ImperativeRuntime | null = null;
  let activeDecisionVersion = 0;
  const requireRuntime = () => {
    if (current === null || !current.isActive()) throw inactiveRuntime();
    return current;
  };
  const applyActiveSheet = (runtime: ImperativeRuntime, sheet: SheetId | null) => {
    activeDecisionVersion += 1;
    current = { ...runtime, activeSheet: sheet };
    runtime.setActiveSheet(sheet);
  };
  return {
    capture() {
      return { activeDecisionVersion, runtime: requireRuntime() };
    },
    compareAndSetActiveSheet(capture, sheet) {
      const runtime = current;
      if (
        runtime === null
        || !runtime.isActive()
        || runtime.controller !== capture.runtime.controller
        || activeDecisionVersion !== capture.activeDecisionVersion
      ) return false;
      applyActiveSheet(runtime, sheet);
      return true;
    },
    deactivate() {
      activeDecisionVersion += 1;
      current = null;
    },
    require() {
      return requireRuntime();
    },
    setActiveSheet(sheet) {
      const runtime = current;
      if (runtime === null || !runtime.isActive()) throw inactiveRuntime();
      applyActiveSheet(runtime, sheet);
    },
    update(runtime) {
      current = runtime;
    },
  };
}

function runtimeSheet(runtime: ImperativeRuntime, address: CellAddress) {
  const snapshot = runtime.controller.getSnapshot();
  const index = snapshot.sheets.findIndex(sheet => sheet.id === address.sheet);
  if (index < 0) throw invalid(`Unknown sheet ID: ${address.sheet}`);
  return snapshot.value[index]!;
}

function createStableHandle(slot: ImperativeRuntimeSlot): TegoSheetHandle {
  return {
    focus() {
      slot.require().root?.focus();
    },
    getValue: () => slot.require().controller.getValue(),
    getCell(address) {
      const runtime = slot.require();
      runtime.controller.getCellText(address);
      return selectCell(runtimeSheet(runtime, address), address.row, address.column);
    },
    getCellStyle(address) {
      const runtime = slot.require();
      runtime.controller.getCellText(address);
      return selectCellStyle(
        runtimeSheet(runtime, address),
        address.row,
        address.column,
        runtime.defaultStyle,
      );
    },
    setCellText(address, text) {
      slot.require().dispatcher.dispatchRef({ type: 'set-cell-text', address, text }, 'ref');
    },
    addSheet(name) {
      const capture = slot.capture();
      const { runtime } = capture;
      const wasEmpty = runtime.controller.getSnapshot().sheets.length === 0;
      const result = committedResult(
        runtime.dispatcher,
        name === undefined ? { type: 'add-sheet' } : { type: 'add-sheet', name },
        'ref',
      );
      if (typeof result !== 'string') throw invalid('Adding a sheet did not return a sheet ID');
      const sheet = result as SheetId;
      if (wasEmpty) slot.compareAndSetActiveSheet(capture, sheet);
      return sheet;
    },
    deleteSheet(sheet) {
      const capture = slot.capture();
      const { runtime } = capture;
      const before = runtime.controller.getSnapshot();
      const removedIndex = before.sheets.findIndex(item => item.id === sheet);
      runtime.dispatcher.dispatchRef({ type: 'delete-sheet', sheet }, 'ref');
      if (runtime.activeSheet !== sheet) return;
      const after = runtime.controller.getSnapshot();
      const replacementIndex = Math.min(removedIndex, after.sheets.length - 1);
      slot.compareAndSetActiveSheet(
        capture,
        replacementIndex < 0 ? null : after.sheets[replacementIndex]!.id,
      );
    },
    renameSheet(sheet, name) {
      slot.require().dispatcher.dispatchRef({ type: 'rename-sheet', sheet, name }, 'ref');
    },
    activateSheet(sheet) {
      const runtime = slot.require();
      const index = runtime.controller.getSnapshot().sheets.findIndex(item => item.id === sheet);
      if (index < 0) throw invalid(`Unknown sheet ID: ${sheet}`);
      slot.setActiveSheet(sheet);
      runtime.dispatcher.emitActiveSheetChange({ sheet, index, source: 'ref' });
    },
    undo() {
      slot.require().dispatcher.dispatchRef({ type: 'undo' }, 'ref');
    },
    redo() {
      slot.require().dispatcher.dispatchRef({ type: 'redo' }, 'ref');
    },
    validate: () => slot.require().controller.validate(),
    print() {
      slot.require();
      window.print();
    },
    recalculateLayout() {
      slot.require().engineSlot.get()?.recalculateLayout();
    },
  };
}

interface RuntimeProps extends TegoSheetProps {
  readonly controlled: ControlledWorkbookRuntime;
  readonly epoch: ControllerEpoch;
}

function Runtime(
  props: RuntimeProps,
  forwardedRef: ForwardedRef<TegoSheetHandle>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engineSlot] = useState(createEngineAdapterSlot);
  const [callbackStore] = useState(() => createCallbackStore(callbacksFromProps(props)));
  const [initialOptions] = useState(() => props.options);
  const [initialActiveSheetIndex] = useState(() => props.initialActiveSheetIndex ?? 0);
  const [initialSheetCount] = useState(() => props.epoch.snapshot.sheets.length);
  const initialWorkbookWasEmpty = initialSheetCount === 0;
  const [activeRequest, setActiveRequest] = useState(() => ({
    decision: 0,
    index: initialWorkbookWasEmpty ? 0 : initialActiveSheetIndex,
    sheet: null as SheetId | null,
  }));
  const replacementVersion = useRef(props.controlled.replacementVersion);
  const [engineGeneration, signalEngineReady] = useReducer((value: number) => value + 1, 0);
  const [runtimeSlot] = useState(createImperativeRuntimeSlot);
  const [handle] = useState(() => createStableHandle(runtimeSlot));

  useLayoutEffect(() => {
    callbackStore.set(callbacksFromProps(props));
  });

  const sheets = props.epoch.snapshot.sheets;
  const setActiveSheet = useCallback((sheet: SheetId | null) => {
    setActiveRequest(current => {
      const index = sheet === null
        ? current.index
        : props.epoch.controller.getSheetIds().findIndex(candidate => candidate === sheet);
      const nextIndex = index < 0 ? current.index : index;
      if (current.sheet === sheet && current.index === nextIndex) return current;
      return { decision: current.decision + 1, index: nextIndex, sheet };
    });
  }, [props.epoch.controller]);
  const activeSheet = sheets.length === 0
    ? null
    : sheets.some(sheet => sheet.id === activeRequest.sheet)
      ? activeRequest.sheet
      : sheets[Math.min(activeRequest.index, sheets.length - 1)]?.id ?? sheets[0]!.id;

  const dispatcher = useMemo(() => createEventDispatcher({
    controller: props.epoch.controller,
    getCallbacks: callbackStore.get,
    getControlledNotificationVersion: props.controlled.getNotificationVersion,
    isActive: props.epoch.isActive,
    recordControlledCheckpoint: props.controlled.recordCheckpoint,
    schedulePaint: () => engineSlot.get()?.render(
      props.epoch.controller.getSnapshot(),
      activeSheet,
    ),
  }), [
    activeSheet,
    callbackStore,
    engineSlot,
    props.controlled.getNotificationVersion,
    props.controlled.recordCheckpoint,
    props.epoch.controller,
    props.epoch.isActive,
  ]);

  if (
    !initialWorkbookWasEmpty
    && initialSheetCount > 0
    && (
      !Number.isSafeInteger(initialActiveSheetIndex)
      || initialActiveSheetIndex < 0
      || initialActiveSheetIndex >= initialSheetCount
    )
  ) {
    throw contractViolation('initialActiveSheetIndex must refer to an initial sheet');
  }

  useLayoutEffect(() => {
    if (
      !props.epoch.isActive()
      || replacementVersion.current === props.controlled.replacementVersion
    ) return;
    replacementVersion.current = props.controlled.replacementVersion;
    const capturedDecision = activeRequest.decision;
    const clippedIndex = activeSheet === null
      ? 0
      : Math.max(0, sheets.findIndex(sheet => sheet.id === activeSheet));
    // A genuine replacement is an external state transition. The functional
    // guard preserves any explicit active-sheet decision made in the same commit stack.
    setActiveRequest(current => current.decision !== capturedDecision
      ? current
      : { ...current, index: clippedIndex, sheet: activeSheet });
  }, [
    activeRequest.decision,
    activeSheet,
    props.controlled.replacementVersion,
    props.epoch,
    sheets,
  ]);

  useLayoutEffect(() => {
    runtimeSlot.update({
      activeSheet,
      controller: props.epoch.controller,
      defaultStyle: initialOptions?.defaultStyle,
      dispatcher,
      engineSlot,
      isActive: props.epoch.isActive,
      root: rootRef.current,
      setActiveSheet,
    });
  }, [
    activeSheet,
    dispatcher,
    engineSlot,
    initialOptions?.defaultStyle,
    props.epoch.controller,
    props.epoch.isActive,
    runtimeSlot,
    setActiveSheet,
  ]);
  useLayoutEffect(() => () => runtimeSlot.deactivate(), [runtimeSlot]);

  // Register this layout cleanup before the canvas cleanup so browser listeners
  // are always released before the engine subscription and render scheduler.
  useInteractionManager({
    activeSheet,
    dispatcher,
    engineGeneration,
    engineSlot,
    epoch: props.epoch,
    rootRef,
  });
  useCanvasEngine({
    activeSheet,
    canvasRef,
    enabled: sheets.length > 0,
    engineSlot,
    epoch: props.epoch,
    onReady: signalEngineReady,
    rootRef,
    sheetOptions: initialOptions,
  });

  useImperativeHandle(forwardedRef, () => handle, [handle]);

  const addFirstSheet = () => {
    const outcome = dispatcher.dispatchUi({ type: 'add-sheet' }, 'sheet-tabs');
    if (outcome.status === 'committed' && typeof outcome.commit.result === 'string') {
      setActiveSheet(outcome.commit.result as SheetId);
    }
  };

  return (
    <div
      ref={rootRef}
      className={classNames(props.className)}
      style={props.style}
      data-tego-sheet=""
      data-mode={props.epoch.mode}
      tabIndex={0}
    >
      {sheets.length === 0 ? (
        <div className="tego-sheet__empty" data-empty-workbook="">
          <span>Empty workbook</span>
          {props.epoch.snapshot.readOnly ? null : (
            <button type="button" onClick={addFirstSheet}>Add sheet</button>
          )}
        </div>
      ) : <canvas ref={canvasRef} className="tego-sheet__canvas" />}
    </div>
  );
}

const ForwardedRuntime = forwardRef(Runtime);

export const TegoSheet = forwardRef<TegoSheetHandle, TegoSheetProps>(function TegoSheet(
  props,
  ref,
) {
  const epoch = useControllerEpoch(props);
  const controlled = useControlledWorkbook({
    epoch,
    value: props.value,
    onError: props.onError,
  });
  if (epoch === null) {
    return (
      <div
        className={classNames(props.className)}
        style={props.style}
        data-tego-sheet=""
        data-mode="initializing"
      />
    );
  }
  return <ForwardedRuntime {...props} controlled={controlled} epoch={epoch} ref={ref} />;
});

TegoSheet.displayName = 'TegoSheet';
