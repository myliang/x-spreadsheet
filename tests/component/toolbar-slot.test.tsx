import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef, useLayoutEffect } from 'react';
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
