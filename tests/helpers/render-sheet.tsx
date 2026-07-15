import { cleanup, render, type RenderResult } from '@testing-library/react';
import { StrictMode, useMemo, useRef } from 'react';
import { afterEach } from 'vitest';
import type { WorkbookCommand } from '../../src/core/commands/workbook-command';
import type { CommandCommit } from '../../src/core/commands/command-result';
import type { ChangeSource, Selection } from '../../src/core';
import {
  createEventDispatcher,
  type EventDispatcher,
} from '../../src/react/adapters/event-dispatcher';
import { useControllerEpoch } from '../../src/react/hooks/use-controller-epoch';
import type { TegoSheetCallbacks, TegoSheetProps } from '../../src/react/tego-sheet.types';

afterEach(cleanup);

export interface RenderSheetOptions {
  readonly recordControlledCheckpoint?: (
    commit: CommandCommit<unknown, WorkbookCommand>,
  ) => void;
  readonly schedulePaint?: () => void;
  readonly strict?: boolean;
}

export interface SheetRuntime {
  readonly dispatcher: EventDispatcher;
  readonly epoch: ReturnType<typeof useControllerEpoch>;
  dispatchUi: EventDispatcher['dispatchUi'];
  dispatchRef: EventDispatcher['dispatchRef'];
  dispatchUiWithSelection(
    command: WorkbookCommand,
    source: ChangeSource,
    selection: Selection,
  ): ReturnType<EventDispatcher['dispatchUi']>;
}

export interface RenderedSheet extends RenderResult {
  readonly runtime: SheetRuntime;
  rerenderProps(props: TegoSheetProps): void;
}

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

export function renderSheet(
  initialProps: TegoSheetProps,
  options: RenderSheetOptions = {},
): RenderedSheet {
  let runtime: SheetRuntime | null = null;

  function BoundaryHarness(props: TegoSheetProps) {
    const epoch = useControllerEpoch(props);
    const callbacks = useRef<TegoSheetCallbacks>(callbacksFromProps(props));
    callbacks.current = callbacksFromProps(props);
    const dispatcher = useMemo(
      () => createEventDispatcher({
        controller: epoch.controller,
        getCallbacks: () => callbacks.current,
        recordControlledCheckpoint: options.recordControlledCheckpoint,
        schedulePaint: options.schedulePaint,
      }),
      [epoch.controller],
    );

    runtime = {
      dispatcher,
      epoch,
      dispatchUi: dispatcher.dispatchUi,
      dispatchRef: dispatcher.dispatchRef,
      dispatchUiWithSelection: (command, source, selection) =>
        dispatcher.dispatchUi(command, source, { selectionAfterCommit: selection }),
    };

    return (
      <output
        data-mode={epoch.mode}
        data-revision={epoch.snapshot.revision}
        data-sheets={epoch.snapshot.sheets.length}
      >
        {JSON.stringify(epoch.snapshot.value)}
      </output>
    );
  }

  const boundary = (props: TegoSheetProps) => options.strict
    ? <StrictMode><BoundaryHarness {...props} /></StrictMode>
    : <BoundaryHarness {...props} />;
  const result = render(boundary(initialProps));
  const rendered = Object.defineProperty(result, 'runtime', {
    enumerable: true,
    get() {
      if (runtime === null) throw new Error('React boundary runtime is unavailable');
      return runtime;
    },
  }) as RenderedSheet;
  rendered.rerenderProps = (props) => result.rerender(boundary(props));
  return rendered;
}
