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
  type ActiveSheetChangeEvent,
  type CellAddress,
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

interface RuntimeProps extends TegoSheetProps {
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
  const [initialWorkbookWasEmpty] = useState(() => props.epoch.snapshot.sheets.length === 0);
  const [requestedActiveSheet, setActiveSheet] = useState<SheetId | null>(null);
  const [engineGeneration, signalEngineReady] = useReducer((value: number) => value + 1, 0);

  useLayoutEffect(() => {
    callbackStore.set(callbacksFromProps(props));
  });

  const sheets = props.epoch.snapshot.sheets;
  const activeSheet = sheets.length === 0
    ? null
    : sheets.some(sheet => sheet.id === requestedActiveSheet)
      ? requestedActiveSheet
      : sheets[initialWorkbookWasEmpty ? 0 : initialActiveSheetIndex]?.id ?? sheets[0]!.id;

  const dispatcher = useMemo(() => createEventDispatcher({
    controller: props.epoch.controller,
    getCallbacks: callbackStore.get,
    isActive: props.epoch.isActive,
    schedulePaint: () => engineSlot.get()?.render(
      props.epoch.controller.getSnapshot(),
      activeSheet,
    ),
  }), [
    activeSheet,
    callbackStore,
    engineSlot,
    props.epoch.controller,
    props.epoch.isActive,
  ]);

  if (
    !initialWorkbookWasEmpty
    && sheets.length > 0
    && (
      !Number.isSafeInteger(initialActiveSheetIndex)
      || initialActiveSheetIndex < 0
      || initialActiveSheetIndex >= sheets.length
    )
  ) {
    throw contractViolation('initialActiveSheetIndex must refer to an initial sheet');
  }

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

  const emitActiveSheet = useCallback((
    sheet: SheetId,
    source: ActiveSheetChangeEvent['source'],
  ) => {
    const index = props.epoch.controller.getSnapshot().sheets.findIndex(item => item.id === sheet);
    if (index < 0) throw invalid(`Unknown sheet ID: ${sheet}`);
    setActiveSheet(sheet);
    dispatcher.emitActiveSheetChange({ sheet, index, source });
  }, [dispatcher, props.epoch.controller]);

  const addSheet = useCallback((name: string | undefined, source: ChangeSource): SheetId => {
    const wasEmpty = props.epoch.controller.getSnapshot().sheets.length === 0;
    const result = committedResult(
      dispatcher,
      name === undefined ? { type: 'add-sheet' } : { type: 'add-sheet', name },
      source,
    );
    if (typeof result !== 'string') throw invalid('Adding a sheet did not return a sheet ID');
    const sheet = result as SheetId;
    if (wasEmpty) setActiveSheet(sheet);
    return sheet;
  }, [dispatcher, props.epoch.controller]);

  const requireSheet = useCallback((address: CellAddress) => {
    const snapshot = props.epoch.controller.getSnapshot();
    const index = snapshot.sheets.findIndex(sheet => sheet.id === address.sheet);
    if (index < 0) throw invalid(`Unknown sheet ID: ${address.sheet}`);
    return snapshot.value[index]!;
  }, [props.epoch.controller]);

  useImperativeHandle(forwardedRef, () => ({
    focus() {
      rootRef.current?.focus();
    },
    getValue: () => props.epoch.controller.getValue(),
    getCell(address) {
      props.epoch.controller.getCellText(address);
      return selectCell(requireSheet(address), address.row, address.column);
    },
    getCellStyle(address) {
      props.epoch.controller.getCellText(address);
      return selectCellStyle(
        requireSheet(address),
        address.row,
        address.column,
        props.options?.defaultStyle,
      );
    },
    setCellText(address, text) {
      dispatcher.dispatchRef({ type: 'set-cell-text', address, text }, 'ref');
    },
    addSheet: name => addSheet(name, 'ref'),
    deleteSheet(sheet) {
      const before = props.epoch.controller.getSnapshot();
      const removedIndex = before.sheets.findIndex(item => item.id === sheet);
      dispatcher.dispatchRef({ type: 'delete-sheet', sheet }, 'ref');
      if (activeSheet !== sheet) return;
      const after = props.epoch.controller.getSnapshot();
      const replacement = after.sheets[Math.min(Math.max(removedIndex - 1, 0), after.sheets.length - 1)];
      setActiveSheet(replacement?.id ?? null);
    },
    renameSheet(sheet, name) {
      dispatcher.dispatchRef({ type: 'rename-sheet', sheet, name }, 'ref');
    },
    activateSheet: sheet => emitActiveSheet(sheet, 'ref'),
    undo() {
      dispatcher.dispatchRef({ type: 'undo' }, 'ref');
    },
    redo() {
      dispatcher.dispatchRef({ type: 'redo' }, 'ref');
    },
    validate: () => props.epoch.controller.validate(),
    print() {
      window.print();
    },
    recalculateLayout() {
      engineSlot.get()?.recalculateLayout();
    },
  }), [
    activeSheet,
    addSheet,
    dispatcher,
    emitActiveSheet,
    engineSlot,
    props.epoch.controller,
    props.options?.defaultStyle,
    requireSheet,
  ]);

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
  return <ForwardedRuntime {...props} epoch={epoch} ref={ref} />;
});

TegoSheet.displayName = 'TegoSheet';
