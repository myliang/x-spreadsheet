import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ForwardedRef,
} from 'react';
import {
  parseA1,
  parseA1Range,
  rangesIntersect,
  selectCellStyle,
  TegoSheetException,
  type Selection,
  type SheetId,
  type SheetTabsRenderProps,
  type ToolbarAction,
  type ToolbarRenderProps,
} from '../core';
import type { WorkbookCommand } from '../core/commands/workbook-command';
import {
  createEventDispatcher,
  printWorkbook,
} from './adapters/event-dispatcher';
import { deletionSplitsMerge } from '../core/operations/structure';
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
  useTegoSheetHandle,
  type TegoSheetHandleRuntime,
  type TegoSheetRuntimeAuthority,
} from './hooks/use-tego-sheet-handle';
import {
  useMountOptionWarnings,
  type TegoSheetMountOptions,
} from './hooks/use-mount-option-warnings';
import {
  useControlledWorkbook,
  type ControlledWorkbookRuntime,
} from './hooks/use-controlled-workbook';
import type {
  TegoSheetCallbacks,
  TegoSheetHandle,
  TegoSheetProps,
} from './tego-sheet.types';
import { TegoSheetProvider, useTegoSheetContext } from './tego-sheet-context';

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

function clonePublic<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clonePublic) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clonePublic(item)]),
    ) as T;
  }
  return value;
}

function classNames(value: string | undefined): string {
  return value === undefined || value.trim().length === 0
    ? 'tego-sheet'
    : `tego-sheet ${value}`;
}

function contractViolation(message: string): TegoSheetException {
  return new TegoSheetException({
    code: 'INVALID_COMMAND',
    message,
    recoverable: false,
  });
}

const MUTATING_ACTIONS = new Set<ToolbarAction['type']>([
  'undo', 'redo', 'paint-format', 'clear-format', 'set-style', 'set-border',
  'merge', 'unmerge', 'freeze', 'unfreeze', 'insert-row', 'delete-row',
  'hide-row', 'unhide-row', 'insert-column', 'delete-column', 'hide-column',
  'unhide-column', 'set-validation', 'remove-validation', 'set-filter',
  'clear-filter', 'sort',
]);

const SELECTION_ACTIONS = new Set<ToolbarAction['type']>([
  'paint-format', 'clear-format', 'set-style', 'set-border', 'merge', 'unmerge',
  'freeze', 'insert-row', 'delete-row', 'hide-row', 'unhide-row',
  'insert-column', 'delete-column', 'hide-column', 'unhide-column',
  'set-validation', 'remove-validation', 'set-filter', 'sort',
]);

interface SlotRuntime extends TegoSheetHandleRuntime {
  readonly selection: Selection | null;
  readonly readOnly: boolean;
}

type SlotRuntimeAuthority = TegoSheetRuntimeAuthority<SlotRuntime>;

function uiError(runtime: SlotRuntime, message: string): void {
  runtime.dispatcher.reportUiError({
    code: 'INVALID_COMMAND',
    message,
    recoverable: true,
  });
}

function runtimeSheet(runtime: SlotRuntime) {
  const snapshot = runtime.controller.getSnapshot();
  const index = snapshot.sheets.findIndex(sheet => sheet.id === runtime.activeSheet);
  return index < 0 ? null : snapshot.value[index] ?? null;
}

function runtimeMerges(runtime: SlotRuntime) {
  return (runtimeSheet(runtime)?.merges ?? []).map(parseA1Range);
}

function mergedSelection(runtime: SlotRuntime): boolean {
  const selection = runtime.selection;
  return selection !== null
    && runtimeMerges(runtime).some(merge => rangesIntersect(merge, selection.range));
}

function frozenSheet(runtime: SlotRuntime): boolean {
  const point = parseA1(runtimeSheet(runtime)?.freeze ?? 'A1');
  return point.row > 0 || point.column > 0;
}

function disabledToolbarActions(runtime: SlotRuntime): Set<ToolbarAction['type']> {
  const snapshot = runtime.controller.getSnapshot();
  const disabled = new Set<ToolbarAction['type']>();
  const selection = runtime.selection;
  const sheet = runtimeSheet(runtime);
  if (runtime.readOnly || snapshot.readOnly) {
    for (const action of MUTATING_ACTIONS) disabled.add(action);
  }
  if (!snapshot.canUndo) disabled.add('undo');
  if (!snapshot.canRedo) disabled.add('redo');
  if (selection === null) {
    for (const action of SELECTION_ACTIONS) disabled.add(action);
  }
  if (sheet === null) {
    disabled.add('clear-filter');
    disabled.add('sort');
    disabled.add('unfreeze');
  }
  const merged = mergedSelection(runtime);
  const singleCell = selection !== null
    && selection.range.start.row === selection.range.end.row
    && selection.range.start.column === selection.range.end.column;
  if (merged || singleCell) disabled.add('merge');
  if (!merged) disabled.add('unmerge');
  const frozen = frozenSheet(runtime);
  if (frozen) disabled.add('freeze');
  else disabled.add('unfreeze');
  if (selection?.active.row === 0 && selection.active.column === 0) disabled.add('freeze');

  let filterRange: ReturnType<typeof parseA1Range> | null = null;
  const filterReference = sheet?.autofilter?.ref;
  if (filterReference !== undefined) {
    try {
      filterRange = parseA1Range(filterReference);
    } catch {
      filterRange = null;
    }
  }
  if (filterRange === null) {
    disabled.add('clear-filter');
    disabled.add('sort');
  } else if (
    selection === null
    || selection.active.column < filterRange.start.column
    || selection.active.column > filterRange.end.column
  ) disabled.add('sort');

  if (selection !== null && sheet !== null) {
    if (deletionSplitsMerge(
      sheet,
      'row',
      selection.range.start.row,
      selection.range.end.row,
    )) disabled.add('delete-row');
    if (deletionSplitsMerge(
      sheet,
      'column',
      selection.range.start.column,
      selection.range.end.column,
    )) disabled.add('delete-column');
  }
  // Paint format is a two-stage interaction assembled with Task 18 chrome.
  disabled.add('paint-format');
  return disabled;
}

function readonlySet<Value>(source: ReadonlySet<Value>): ReadonlySet<Value> {
  const values = [...source];
  return Object.freeze({
    get size() {
      return values.length;
    },
    has: (value: Value) => source.has(value),
    entries: () => values.map(value => [value, value] as [Value, Value]).values(),
    keys: () => values.values(),
    values: () => values.values(),
    forEach(callback: (value: Value, key: Value, set: ReadonlySet<Value>) => void, thisArg?: unknown) {
      for (const value of values) callback.call(thisArg, value, value, this);
    },
    [Symbol.iterator]: () => values.values(),
  });
}

function toolbarCommand(runtime: SlotRuntime, action: ToolbarAction): WorkbookCommand | null {
  const selection = runtime.selection;
  switch (action.type) {
    case 'print':
    case 'paint-format':
      return null;
    case 'undo':
      return { type: 'undo' };
    case 'redo':
      return { type: 'redo' };
    case 'unfreeze':
      return runtime.activeSheet === null
        ? null
        : { type: 'set-freeze', sheet: runtime.activeSheet, row: 0, column: 0 };
    case 'clear-filter':
      return runtime.activeSheet === null
        ? null
        : { type: 'clear-filter', sheet: runtime.activeSheet };
  }
  if (selection === null) return null;
  const { sheet, active, range } = selection;
  switch (action.type) {
    case 'clear-format':
      return { type: 'clear-format', selection };
    case 'set-style':
      return { type: 'set-style', selection, patch: action.patch };
    case 'set-border':
      return { type: 'set-border', selection, mode: action.mode, line: action.line };
    case 'merge':
    case 'unmerge':
      return { type: action.type, selection };
    case 'freeze':
      return { type: 'set-freeze', sheet, row: active.row, column: active.column };
    case 'insert-row':
    case 'delete-row':
      return { type: action.type, sheet, index: range.start.row, count: range.end.row - range.start.row + 1 };
    case 'insert-column':
    case 'delete-column':
      return { type: action.type, sheet, index: range.start.column, count: range.end.column - range.start.column + 1 };
    case 'hide-row':
    case 'unhide-row':
      return {
        type: 'set-row-hidden',
        sheet,
        row: range.start.row,
        count: range.end.row - range.start.row + 1,
        hidden: action.type === 'hide-row',
      };
    case 'hide-column':
    case 'unhide-column':
      return {
        type: 'set-column-hidden',
        sheet,
        column: range.start.column,
        count: range.end.column - range.start.column + 1,
        hidden: action.type === 'hide-column',
      };
    case 'set-validation':
      return { type: 'set-validation', selection, rule: action.rule };
    case 'remove-validation':
      return { type: 'remove-validation', selection };
    case 'set-filter':
      return { type: 'set-filter', selection, filter: action.filter };
    case 'sort':
      return { type: 'sort', sheet, column: active.column, order: action.order };
  }
}

function executeToolbar(runtime: SlotRuntime, action: ToolbarAction): void {
  if (disabledToolbarActions(runtime).has(action.type)) {
    uiError(runtime, `Toolbar action "${action.type}" is unavailable`);
    return;
  }
  if (action.type === 'print') {
    printWorkbook(runtime.dispatcher);
    return;
  }
  const command = toolbarCommand(runtime, action);
  if (command === null) {
    uiError(runtime, `Toolbar action "${action.type}" cannot run in the current view`);
    return;
  }
  runtime.dispatcher.dispatchUi(command, 'toolbar');
}

function addSheetFromTabs(authority: SlotRuntimeAuthority, name?: string): void {
  const capture = authority.capture();
  const { runtime } = capture;
  if (runtime.readOnly || runtime.controller.getSnapshot().readOnly) {
    uiError(runtime, 'Sheet tabs cannot add a sheet while the workbook is read-only');
    return;
  }
  const wasEmpty = runtime.controller.getSnapshot().sheets.length === 0;
  const outcome = runtime.dispatcher.dispatchUi(
    name === undefined ? { type: 'add-sheet' } : { type: 'add-sheet', name },
    'sheet-tabs',
  );
  if (
    wasEmpty
    && outcome.status === 'committed'
    && typeof outcome.commit.result === 'string'
  ) authority.compareAndSetActiveSheet(capture, outcome.commit.result as SheetId);
}

function deleteSheetFromTabs(authority: SlotRuntimeAuthority, sheet: SheetId): void {
  const capture = authority.capture();
  const { runtime } = capture;
  if (runtime.readOnly || runtime.controller.getSnapshot().readOnly) {
    uiError(runtime, 'Sheet tabs cannot delete a sheet while the workbook is read-only');
    return;
  }
  const before = runtime.controller.getSnapshot();
  const removedIndex = before.sheets.findIndex(item => item.id === sheet);
  const outcome = runtime.dispatcher.dispatchUi({ type: 'delete-sheet', sheet }, 'sheet-tabs');
  if (outcome.status !== 'committed' || runtime.activeSheet !== sheet) return;
  const after = runtime.controller.getSnapshot();
  const replacementIndex = Math.min(removedIndex, after.sheets.length - 1);
  authority.compareAndSetActiveSheet(
    capture,
    replacementIndex < 0 ? null : after.sheets[replacementIndex]!.id,
  );
}

function renameSheetFromTabs(runtime: SlotRuntime, sheet: SheetId, name: string): void {
  if (runtime.readOnly || runtime.controller.getSnapshot().readOnly) {
    uiError(runtime, 'Sheet tabs cannot rename a sheet while the workbook is read-only');
    return;
  }
  runtime.dispatcher.dispatchUi({ type: 'rename-sheet', sheet, name }, 'sheet-tabs');
}

function activateSheetFromTabs(
  authority: SlotRuntimeAuthority,
  runtime: SlotRuntime,
  sheet: SheetId,
): void {
  const snapshot = runtime.controller.getSnapshot();
  const index = snapshot.sheets.findIndex(item => item.id === sheet);
  if (index < 0) {
    uiError(runtime, `Unknown sheet ID: ${sheet}`);
    return;
  }
  authority.activate(sheet);
  runtime.dispatcher.emitActiveSheetChange({ sheet, index, source: 'sheet-tabs' });
}

function ToolbarSlot(props: { readonly renderer: TegoSheetProps['toolbar'] }) {
  const value = useTegoSheetContext().toolbar;
  if (props.renderer === false) return null;
  if (typeof props.renderer === 'function') {
    return <div data-tego-toolbar="custom">{props.renderer(value)}</div>;
  }
  return <div data-tego-toolbar="default" aria-hidden="true" />;
}

function SheetTabsSlot(props: { readonly renderer: TegoSheetProps['sheetTabs'] }) {
  const value = useTegoSheetContext().sheetTabs;
  if (props.renderer === false) return null;
  if (typeof props.renderer === 'function') {
    return <div data-tego-sheet-tabs="custom">{props.renderer(value)}</div>;
  }
  return <div data-tego-sheet-tabs="default" aria-hidden="true" />;
}

function CommitAuthority(props: { readonly commit: () => void }) {
  const { commit } = props;
  useLayoutEffect(() => {
    commit();
  }, [commit]);
  return null;
}

interface RuntimeProps extends TegoSheetProps {
  readonly controlled: ControlledWorkbookRuntime;
  readonly epoch: ControllerEpoch;
  readonly mountOptions: TegoSheetMountOptions;
  readonly mountActiveSheetIndex: number | undefined;
}

function Runtime(
  props: RuntimeProps,
  forwardedRef: ForwardedRef<TegoSheetHandle>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engineSlot] = useState(createEngineAdapterSlot);
  const [callbackStore] = useState(() => createCallbackStore(callbacksFromProps(props)));
  const initialOptions = props.mountOptions;
  const initialActiveSheetIndex = props.mountActiveSheetIndex ?? 0;
  const [initialSheetCount] = useState(() => props.epoch.snapshot.sheets.length);
  const initialWorkbookWasEmpty = initialSheetCount === 0;
  const [activeRequest, setActiveRequest] = useState(() => ({
    index: initialWorkbookWasEmpty ? 0 : initialActiveSheetIndex,
    sheet: null as SheetId | null,
  }));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [engineGeneration, signalEngineReady] = useReducer((value: number) => value + 1, 0);
  const runtimeAuthority = useTegoSheetHandle<SlotRuntime>(forwardedRef);

  const sheets = props.epoch.snapshot.sheets;
  const setActiveSheet = useCallback((sheet: SheetId | null) => {
    setActiveRequest(current => {
      const index = sheet === null
        ? current.index
        : props.epoch.controller.getSheetIds().findIndex(candidate => candidate === sheet);
      const nextIndex = index < 0 ? current.index : index;
      if (current.sheet === sheet && current.index === nextIndex) return current;
      return { index: nextIndex, sheet };
    });
  }, [props.epoch.controller]);
  const activeSheet = sheets.length === 0
    ? null
    : sheets.some(sheet => sheet.id === activeRequest.sheet)
      ? activeRequest.sheet
      : sheets[Math.min(activeRequest.index, sheets.length - 1)]?.id ?? sheets[0]!.id;
  const clippedActiveIndex = activeSheet === null
    ? 0
    : Math.max(0, sheets.findIndex(sheet => sheet.id === activeSheet));

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

  const renderRuntime: SlotRuntime = {
    activeSheet,
    controller: props.epoch.controller,
    defaultStyle: initialOptions.defaultStyle,
    dispatcher,
    engineSlot,
    isActive: props.epoch.isActive,
    readOnly: props.readOnly ?? false,
    root: null,
    selection,
    setActiveSheet,
  };
  const renderToken = {};
  const commitRuntime = () => {
    if (!props.epoch.isActive()) {
      runtimeAuthority.deactivate();
      return;
    }
    callbackStore.set(callbacksFromProps(props));
    if (props.epoch.controller.getSnapshot().readOnly !== renderRuntime.readOnly) {
      props.epoch.controller.setReadOnly(renderRuntime.readOnly);
      props.epoch.store.refresh();
    }
    engineSlot.get()?.updateReadOnly(renderRuntime.readOnly);
    runtimeAuthority.commit(renderToken, { ...renderRuntime, root: rootRef.current });
  };
  const rootCallback = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    if (node === null) runtimeAuthority.deactivate();
  }, [runtimeAuthority]);

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
      || (activeRequest.sheet === activeSheet && activeRequest.index === clippedActiveIndex)
    ) return;
    const capturedRequest = activeRequest;
    // The controller's committed sheet set is external state; identity CAS prevents
    // this synchronization from overwriting a newer explicit active-sheet decision.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveRequest(current => current !== capturedRequest
      ? current
      : { index: clippedActiveIndex, sheet: activeSheet });
  }, [
    activeRequest,
    activeSheet,
    clippedActiveIndex,
    props.epoch,
  ]);

  // Register this layout cleanup before the canvas cleanup so browser listeners
  // are always released before the engine subscription and render scheduler.
  useInteractionManager({
    activeSheet,
    dispatcher,
    engineGeneration,
    engineSlot,
    epoch: props.epoch,
    rootRef,
    showContextMenu: props.options?.showContextMenu,
    minimumColumnWidth: initialOptions.columns?.minimumWidth,
    onSelectionChange: setSelection,
  });
  useCanvasEngine({
    activeSheet,
    canvasRef,
    enabled: sheets.length > 0,
    engineSlot,
    epoch: props.epoch,
    onReady: signalEngineReady,
    onSelectionChange: setSelection,
    rootRef,
    sheetOptions: initialOptions,
    showGrid: props.options?.showGrid,
  });

  useLayoutEffect(() => {
    if (initialOptions.autoFocus === true) rootRef.current?.focus();
  }, [initialOptions.autoFocus]);

  const execute = (action: ToolbarAction) => {
    const runtime = runtimeAuthority.committed(renderToken);
    if (runtime !== null) executeToolbar(runtime, action);
  };
  const tabActions = {
    add(name?: string) {
      if (runtimeAuthority.committed(renderToken) !== null) {
        addSheetFromTabs(runtimeAuthority, name);
      }
    },
    delete(sheet: SheetId) {
      if (runtimeAuthority.committed(renderToken) !== null) {
        deleteSheetFromTabs(runtimeAuthority, sheet);
      }
    },
    rename(sheet: SheetId, name: string) {
      const runtime = runtimeAuthority.committed(renderToken);
      if (runtime !== null) renameSheetFromTabs(runtime, sheet, name);
    },
    activate(sheet: SheetId) {
      const runtime = runtimeAuthority.committed(renderToken);
      if (runtime !== null) activateSheetFromTabs(runtimeAuthority, runtime, sheet);
    },
  };
  const addFirstSheet = () => tabActions.add();
  const activeData = runtimeSheet(renderRuntime);
  const activeStyle = selection === null || activeData === null
    ? initialOptions.defaultStyle ?? {}
    : selectCellStyle(
      activeData,
      selection.active.row,
      selection.active.column,
      initialOptions.defaultStyle,
    );
  const toolbarProps = Object.freeze<ToolbarRenderProps>({
    selection: selection === null ? null : clonePublic(selection),
    activeStyle: clonePublic(activeStyle),
    readOnly: props.readOnly ?? false,
    canUndo: props.epoch.snapshot.canUndo,
    canRedo: props.epoch.snapshot.canRedo,
    merged: mergedSelection(renderRuntime),
    frozen: frozenSheet(renderRuntime),
    disabledActions: readonlySet(disabledToolbarActions(renderRuntime)),
    execute,
  });
  const sheetTabsProps = Object.freeze<SheetTabsRenderProps>({
    sheets: Object.freeze(props.epoch.snapshot.sheets.map(sheet => Object.freeze({
      id: sheet.id,
      index: sheet.index,
      name: sheet.name,
    }))),
    activeSheet,
    readOnly: props.readOnly ?? false,
    ...tabActions,
  });
  const contextValue = Object.freeze({ toolbar: toolbarProps, sheetTabs: sheetTabsProps });

  return (
    <div
      ref={rootCallback}
      className={classNames(props.className)}
      style={props.style}
      data-tego-sheet=""
      data-mode={props.epoch.mode}
      data-grid-visible={props.options?.showGrid === false ? 'false' : 'true'}
      data-context-menu-enabled={props.options?.showContextMenu === false ? 'false' : 'true'}
      tabIndex={0}
    >
      <TegoSheetProvider value={contextValue}>
        <CommitAuthority commit={commitRuntime} />
        <ToolbarSlot renderer={props.toolbar} />
        {sheets.length === 0 ? (
          <div className="tego-sheet__empty" data-empty-workbook="">
            <span>Empty workbook</span>
            {renderRuntime.readOnly ? null : (
              <button type="button" onClick={addFirstSheet}>Add sheet</button>
            )}
          </div>
        ) : <canvas ref={canvasRef} className="tego-sheet__canvas" />}
        <SheetTabsSlot renderer={props.sheetTabs} />
      </TegoSheetProvider>
    </div>
  );
}

const ForwardedRuntime = forwardRef(Runtime);

export const TegoSheet = forwardRef<TegoSheetHandle, TegoSheetProps>(function TegoSheet(
  props,
  ref,
) {
  const mountOptions = useMountOptionWarnings(props.initialActiveSheetIndex, props.options);
  const [mountActiveSheetIndex] = useState(() => props.initialActiveSheetIndex);
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
  return (
    <ForwardedRuntime
      {...props}
      controlled={controlled}
      epoch={epoch}
      mountOptions={mountOptions}
      mountActiveSheetIndex={mountActiveSheetIndex}
      ref={ref}
    />
  );
});

TegoSheet.displayName = 'TegoSheet';
