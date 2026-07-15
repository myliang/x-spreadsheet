import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import {
  Component,
  createRef,
  startTransition,
  Suspense,
  useLayoutEffect,
  type ReactNode,
} from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  TegoSheet,
  type TegoSheetError,
  type ToolbarAction,
  type ToolbarRenderProps,
  type TegoSheetHandle,
} from '../../src';
import { createCanvasHarness } from '../helpers/canvas-harness';

beforeEach(() => {
  const context = createCanvasHarness().canvas.getContext('2d');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('supports default, hidden and custom toolbar hosts without leaking a controller', async () => {
  const rendered = render(<TegoSheet defaultValue={[{ name: 'A' }]} />);
  await waitFor(() => expect(rendered.container.querySelector('[data-tego-toolbar="default"]')).not.toBeNull());
  rendered.rerender(<TegoSheet defaultValue={[]} toolbar={false} />);
  expect(rendered.container.querySelector('[data-tego-toolbar]')).toBeNull();

  let props!: ToolbarRenderProps;
  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      toolbar={value => {
        props = value;
        return <button type="button">custom toolbar</button>;
      }}
    />,
  );
  await waitFor(() => expect(rendered.getByText('custom toolbar')).toBeTruthy());
  expect(rendered.container.querySelector('[data-tego-toolbar="custom"]')).not.toBeNull();
  expect('controller' in props).toBe(false);
  expect('renderer' in props).toBe(false);
  expect(props.disabledActions).not.toBeInstanceOf(Set);
  expect('add' in props.disabledActions).toBe(false);
});

it('dispatches public actions through the command pipeline and reports forced disabled actions', async () => {
  let props!: ToolbarRenderProps;
  const errors: TegoSheetError[] = [];
  const changes: string[] = [];
  const rendered = render(
    <TegoSheet
      defaultValue={[{ name: 'A' }]}
      toolbar={value => {
        props = value;
        return null;
      }}
      onChange={(_value, change) => changes.push(change.kind)}
      onError={error => errors.push(error)}
    />,
  );
  await waitFor(() => expect(props.selection).not.toBeNull());
  const actions: readonly ToolbarAction[] = [
    { type: 'set-style', patch: { font: { bold: true } } },
    { type: 'set-border', mode: 'bottom', line: ['thin', '#000'] },
    { type: 'merge' },
    { type: 'freeze' },
    { type: 'set-validation', rule: { mode: 'cell', type: 'number', required: false, operator: 'gte', value: '0' } },
  ];
  act(() => actions.forEach(action => props.execute(action)));
  expect(changes).toEqual(['style', 'style', 'validation']);

  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      readOnly
      toolbar={value => {
        props = value;
        return null;
      }}
      onError={error => errors.push(error)}
    />,
  );
  await waitFor(() => expect(props.readOnly).toBe(true));
  expect(props.disabledActions.has('set-style')).toBe(true);
  act(() => props.execute({ type: 'set-style', patch: { color: 'red' } }));
  expect(errors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND', recoverable: true });
});

it('keeps paint-format disabled and applies the latest read-only gate to retained actions', async () => {
  let retained: ToolbarRenderProps['execute'] | undefined;
  const changes: string[] = [];
  const errors: TegoSheetError[] = [];
  function Probe(props: ToolbarRenderProps) {
    retained ??= props.execute;
    useLayoutEffect(() => {
      if (props.readOnly) retained?.({ type: 'set-style', patch: { color: 'blocked' } });
    }, [props.readOnly]);
    return null;
  }
  const rendered = render(
    <TegoSheet
      defaultValue={[{ name: 'A' }]}
      toolbar={props => <Probe {...props} />}
      onChange={(_value, change) => changes.push(change.kind)}
      onError={error => errors.push(error)}
    />,
  );
  await waitFor(() => expect(retained).toBeTypeOf('function'));
  let current!: ToolbarRenderProps;
  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      readOnly
      toolbar={props => {
        current = props;
        return <Probe {...props} />;
      }}
      onChange={(_value, change) => changes.push(change.kind)}
      onError={error => errors.push(error)}
    />,
  );
  expect(changes).toEqual([]);
  expect(errors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND' });
  expect(current.disabledActions.has('paint-format')).toBe(true);
  act(() => retained?.({ type: 'paint-format' }));
  expect(errors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND' });

  const count = errors.length;
  rendered.unmount();
  expect(() => retained?.({ type: 'set-style', patch: { color: 'after-unmount' } })).not.toThrow();
  expect(errors).toHaveLength(count);
});

it('uses range starts for structural actions even when the active cell is inside the range', async () => {
  const ref = createRef<TegoSheetHandle>();
  let props!: ToolbarRenderProps;
  const rendered = render(
    <TegoSheet
      ref={ref}
      defaultValue={[{
        name: 'A',
        rows: { len: 3, 0: { cells: { 0: { text: 'anchor' } } } },
        cols: { len: 3 },
      }]}
      toolbar={value => {
        props = value;
        return null;
      }}
    />,
  );
  await waitFor(() => expect(props.selection).not.toBeNull());
  const root = rendered.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(root);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
  expect(props.selection).toMatchObject({
    active: { row: 1, column: 1 },
    range: { start: { row: 0, column: 0 }, end: { row: 2, column: 2 } },
  });
  const sheet = props.selection!.sheet;

  act(() => {
    props.execute({ type: 'insert-row' });
    props.execute({ type: 'insert-column' });
  });
  expect(ref.current!.getCell({ sheet, row: 3, column: 3 })?.text).toBe('anchor');
  expect(ref.current!.getCell({ sheet, row: 0, column: 0 })).toBeNull();
});

it('allows active-sheet-only actions when a zero-sized grid has no selection', async () => {
  let props!: ToolbarRenderProps;
  const changes: string[] = [];
  render(
    <TegoSheet
      defaultValue={[{
        name: 'A',
        rows: { len: 0 },
        cols: { len: 0 },
        freeze: 'B2',
        autofilter: { ref: 'A1', filters: [{ ci: 0, operator: 'all', value: [] }] },
      }]}
      toolbar={value => {
        props = value;
        return null;
      }}
      onChange={(_value, change) => changes.push(change.kind)}
    />,
  );
  await waitFor(() => expect(props.selection).toBeNull());
  expect(props.selection).toBeNull();
  expect(props.disabledActions.has('unfreeze')).toBe(false);
  expect(props.disabledActions.has('clear-filter')).toBe(false);
  act(() => {
    props.execute({ type: 'unfreeze' });
    props.execute({ type: 'clear-filter' });
  });
  expect(changes).toEqual(['structure', 'filter']);
});

it.each(['suspend', 'throw'] as const)(
  'does not run toolbar actions from a render that will %s',
  async mode => {
    const ref = createRef<TegoSheetHandle>();
    const changes = vi.fn();
    const errors = vi.fn();
    const suspended = new Promise<never>(() => undefined);
    let attack = false;

    class ErrorBoundary extends Component<{ readonly children: ReactNode }, { failed: boolean }> {
      state = { failed: false };

      static getDerivedStateFromError() {
        return { failed: true };
      }

      render() {
        return this.state.failed ? <output data-render-error="" /> : this.props.children;
      }
    }

    function AbortAfterSheet() {
      if (!attack) return null;
      if (mode === 'suspend') throw suspended;
      throw new Error('abort pending toolbar render');
    }

    function Mounted() {
      const content = (
        <>
          <TegoSheet
            ref={ref}
            defaultValue={[{ name: 'A' }]}
            toolbar={props => {
              if (attack) props.execute({ type: 'set-style', patch: { color: 'aborted' } });
              return null;
            }}
            onChange={changes}
            onError={errors}
          />
          <AbortAfterSheet />
        </>
      );
      return mode === 'suspend'
        ? <Suspense fallback={<output data-suspended="" />}>{content}</Suspense>
        : <ErrorBoundary>{content}</ErrorBoundary>;
    }

    const rendered = render(<Mounted />);
    await waitFor(() => expect(ref.current).not.toBeNull());
    const before = ref.current!.getValue();
    attack = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => {
      startTransition(() => rendered.rerender(<Mounted />));
    });

    expect(changes).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
    if (mode === 'suspend') expect(ref.current!.getValue()).toEqual(before);
  },
);

it('disables payload-independent actions that are already known to be unavailable', async () => {
  const baseErrors: TegoSheetError[] = [];
  const baseChanges = vi.fn();
  let base!: ToolbarRenderProps;
  render(
    <TegoSheet
      defaultValue={[{ name: 'A', rows: { len: 3 }, cols: { len: 3 } }]}
      toolbar={props => {
        base = props;
        return null;
      }}
      onChange={baseChanges}
      onError={error => baseErrors.push(error)}
    />,
  );
  await waitFor(() => expect(base.selection).not.toBeNull());
  for (const type of ['merge', 'freeze', 'clear-filter', 'sort'] as const) {
    expect(base.disabledActions.has(type), type).toBe(true);
    const before = baseErrors.length;
    act(() => {
      if (type === 'sort') base.execute({ type, order: 'asc' });
      else base.execute({ type });
    });
    expect(baseErrors, type).toHaveLength(before + 1);
    expect(baseErrors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND' });
  }
  expect(baseChanges).not.toHaveBeenCalled();

  const overlapErrors: TegoSheetError[] = [];
  const overlapChanges = vi.fn();
  let overlap!: ToolbarRenderProps;
  const overlapRender = render(
    <TegoSheet
      defaultValue={[{ name: 'Overlap', rows: { len: 3 }, cols: { len: 3 }, merges: ['B1:C2'] }]}
      toolbar={props => {
        overlap = props;
        return null;
      }}
      onChange={overlapChanges}
      onError={error => overlapErrors.push(error)}
    />,
  );
  await waitFor(() => expect(overlap.selection).not.toBeNull());
  const overlapRoot = overlapRender.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(overlapRoot);
  fireEvent.keyDown(window, { key: 'ArrowRight', shiftKey: true });
  expect(overlap.disabledActions.has('merge')).toBe(true);
  act(() => overlap.execute({ type: 'merge' }));
  expect(overlapErrors).toHaveLength(1);
  expect(overlapChanges).not.toHaveBeenCalled();

  const sortErrors: TegoSheetError[] = [];
  const sortChanges = vi.fn();
  let outsideFilter!: ToolbarRenderProps;
  render(
    <TegoSheet
      defaultValue={[{
        name: 'Filter',
        rows: { len: 3 },
        cols: { len: 3 },
        autofilter: { ref: 'B1:C3', filters: [] },
      }]}
      toolbar={props => {
        outsideFilter = props;
        return null;
      }}
      onChange={sortChanges}
      onError={error => sortErrors.push(error)}
    />,
  );
  await waitFor(() => expect(outsideFilter.selection).not.toBeNull());
  expect(outsideFilter.disabledActions.has('sort')).toBe(true);
  act(() => outsideFilter.execute({ type: 'sort', order: 'asc' }));
  expect(sortErrors).toHaveLength(1);
  expect(sortChanges).not.toHaveBeenCalled();

  const rowErrors: TegoSheetError[] = [];
  const rowChanges = vi.fn();
  let rowDelete!: ToolbarRenderProps;
  const rowRender = render(
    <TegoSheet
      defaultValue={[{ name: 'Rows', rows: { len: 4 }, cols: { len: 3 }, merges: ['A2:A3'] }]}
      toolbar={props => {
        rowDelete = props;
        return null;
      }}
      onChange={rowChanges}
      onError={error => rowErrors.push(error)}
    />,
  );
  await waitFor(() => expect(rowDelete.selection).not.toBeNull());
  const rowRoot = rowRender.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(rowRoot);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  fireEvent.keyDown(window, { key: ' ', shiftKey: true });
  expect(rowDelete.disabledActions.has('delete-row')).toBe(true);
  act(() => rowDelete.execute({ type: 'delete-row' }));
  expect(rowErrors).toHaveLength(1);
  expect(rowChanges).not.toHaveBeenCalled();

  const columnErrors: TegoSheetError[] = [];
  const columnChanges = vi.fn();
  let columnDelete!: ToolbarRenderProps;
  const columnRender = render(
    <TegoSheet
      defaultValue={[{ name: 'Columns', rows: { len: 3 }, cols: { len: 4 }, merges: ['B1:C1'] }]}
      toolbar={props => {
        columnDelete = props;
        return null;
      }}
      onChange={columnChanges}
      onError={error => columnErrors.push(error)}
    />,
  );
  await waitFor(() => expect(columnDelete.selection).not.toBeNull());
  const columnRoot = columnRender.container.querySelector<HTMLElement>('[data-tego-sheet]')!;
  fireEvent.focusIn(columnRoot);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: ' ', ctrlKey: true });
  expect(columnDelete.disabledActions.has('delete-column')).toBe(true);
  act(() => columnDelete.execute({ type: 'delete-column' }));
  expect(columnErrors).toHaveLength(1);
  expect(columnChanges).not.toHaveBeenCalled();
});
