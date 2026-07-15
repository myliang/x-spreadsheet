import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  TegoSheet,
  type SheetId,
  type SheetTabsRenderProps,
  type TegoSheetError,
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

it('@parity:structure.sheet-tabs supports default, hidden and isolated custom sheet-tab hosts', async () => {
  const rendered = render(<TegoSheet defaultValue={[{ name: 'A' }]} />);
  await waitFor(() => expect(rendered.container.querySelector('[data-tego-sheet-tabs="default"]')).not.toBeNull());
  rendered.rerender(<TegoSheet defaultValue={[]} sheetTabs={false} />);
  expect(rendered.container.querySelector('[data-tego-sheet-tabs]')).toBeNull();

  let props!: SheetTabsRenderProps;
  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      sheetTabs={value => {
        props = value;
        return <span>custom tabs</span>;
      }}
    />,
  );
  await waitFor(() => expect(rendered.getByText('custom tabs')).toBeTruthy());
  expect(rendered.container.querySelector('[data-tego-sheet-tabs="custom"]')).not.toBeNull();
  expect('controller' in props).toBe(false);
  expect(Object.isFrozen(props.sheets)).toBe(true);
});

it('@parity:workbook.sheet-lifecycle uses sheet-tab actions for add, rename, activate and delete with read-only UI errors', async () => {
  let props!: SheetTabsRenderProps;
  const active: SheetId[] = [];
  const errors: TegoSheetError[] = [];
  const rendered = render(
    <TegoSheet
      defaultValue={[]}
      sheetTabs={value => {
        props = value;
        return null;
      }}
      onActiveSheetChange={event => active.push(event.sheet)}
      onError={error => errors.push(error)}
    />,
  );
  await waitFor(() => expect(props.sheets).toHaveLength(0));
  act(() => props.add('A'));
  await waitFor(() => expect(props.sheets).toHaveLength(1));
  const a = props.sheets[0]!.id;
  act(() => props.rename(a, 'Renamed'));
  expect(props.sheets[0]?.name).toBe('Renamed');
  act(() => props.activate(a));
  expect(active).toEqual([a]);
  act(() => props.delete(a));
  expect(props.sheets).toHaveLength(0);

  rendered.rerender(
    <TegoSheet
      defaultValue={[]}
      readOnly
      sheetTabs={value => {
        props = value;
        return null;
      }}
      onError={error => errors.push(error)}
    />,
  );
  await waitFor(() => expect(props.readOnly).toBe(true));
  act(() => props.add('blocked'));
  expect(errors.at(-1)).toMatchObject({ code: 'INVALID_COMMAND' });
});

it('routes retained stale tab actions to the current onError and makes them inert after unmount', async () => {
  let retained!: SheetTabsRenderProps;
  const firstError = vi.fn();
  const latestError = vi.fn();
  const rendered = render(
    <TegoSheet
      value={[{ name: 'A' }]}
      sheetTabs={props => {
        retained = props;
        return null;
      }}
      onError={firstError}
    />,
  );
  await waitFor(() => expect(retained.sheets).toHaveLength(1));
  const stale = retained.sheets[0]!.id;
  const staleActivate = retained.activate;
  let latest!: SheetTabsRenderProps;

  rendered.rerender(
    <TegoSheet
      value={[{ name: 'Replacement' }]}
      sheetTabs={props => {
        latest = props;
        return null;
      }}
      onError={latestError}
    />,
  );
  await waitFor(() => expect(latest.sheets[0]?.name).toBe('Replacement'));
  act(() => staleActivate(stale));
  expect(firstError).not.toHaveBeenCalled();
  expect(latestError).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_COMMAND' }));

  const calls = latestError.mock.calls.length;
  rendered.unmount();
  expect(() => staleActivate(stale)).not.toThrow();
  expect(latestError).toHaveBeenCalledTimes(calls);
});

it('does not let an outer add overwrite a nested add/delete activation decision', async () => {
  const ref = createRef<TegoSheetHandle>();
  let tabs!: SheetTabsRenderProps;
  let nested = false;
  render(
    <TegoSheet
      ref={ref}
      defaultValue={[]}
      sheetTabs={props => {
        tabs = props;
        return null;
      }}
      onChange={() => {
        if (nested) return;
        nested = true;
        const temporary = ref.current!.addSheet('Temporary');
        ref.current!.deleteSheet(temporary);
        const winner = ref.current!.addSheet('Nested winner');
        ref.current!.activateSheet(winner);
      }}
    />,
  );
  await waitFor(() => expect(tabs.sheets).toHaveLength(0));

  act(() => tabs.add('Outer'));

  await waitFor(() => expect(tabs.sheets).toHaveLength(2));
  const active = tabs.sheets.find(sheet => sheet.id === tabs.activeSheet);
  expect(active?.name).toBe('Nested winner');
});

it('does not let an outer delete overwrite a reentrant tab activation', async () => {
  let tabs!: SheetTabsRenderProps;
  let reenter = false;
  render(
    <TegoSheet
      defaultValue={[{ name: 'A' }, { name: 'B' }, { name: 'C' }]}
      initialActiveSheetIndex={1}
      sheetTabs={props => {
        tabs = props;
        return null;
      }}
      onChange={() => {
        if (!reenter) return;
        reenter = false;
        tabs.activate(tabs.sheets[0]!.id);
      }}
    />,
  );
  await waitFor(() => expect(tabs.sheets).toHaveLength(3));
  const b = tabs.sheets[1]!.id;
  reenter = true;

  act(() => tabs.delete(b));

  expect(tabs.sheets.map(sheet => sheet.name)).toEqual(['A', 'C']);
  expect(tabs.sheets.find(sheet => sheet.id === tabs.activeSheet)?.name).toBe('A');
});

it('keeps the latest controlled replacement activation during a reentrant delete', async () => {
  let tabs!: SheetTabsRenderProps;
  let replace = false;

  function Host() {
    const [value, setValue] = useState([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    return (
      <TegoSheet
        value={value}
        initialActiveSheetIndex={1}
        sheetTabs={props => {
          tabs = props;
          return null;
        }}
        onChange={() => {
          if (!replace) return;
          replace = false;
          flushSync(() => setValue([{ name: 'R1' }, { name: 'R2' }, { name: 'R3' }]));
          tabs.activate(tabs.sheets[0]!.id);
        }}
      />
    );
  }

  render(<Host />);
  await waitFor(() => expect(tabs.sheets).toHaveLength(3));
  replace = true;
  act(() => tabs.delete(tabs.sheets[1]!.id));

  await waitFor(() => expect(tabs.sheets.map(sheet => sheet.name)).toEqual(['R1', 'R2', 'R3']));
  expect(tabs.sheets.find(sheet => sheet.id === tabs.activeSheet)?.name).toBe('R1');
});

it('drops add/delete post-dispatch decisions after synchronous unmount', async () => {
  let tabs!: SheetTabsRenderProps;
  let hide!: () => void;
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  function Host() {
    const [shown, setShown] = useState(true);
    hide = () => flushSync(() => setShown(false));
    return shown ? (
      <TegoSheet
        defaultValue={[]}
        sheetTabs={props => {
          tabs = props;
          return null;
        }}
        onChange={hide}
      />
    ) : null;
  }

  const rendered = render(<Host />);
  await waitFor(() => expect(tabs.sheets).toHaveLength(0));
  expect(() => act(() => tabs.add('Unmounting'))).not.toThrow();
  expect(rendered.container.querySelector('[data-tego-sheet]')).toBeNull();
  expect(consoleError).not.toHaveBeenCalled();
});
