import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  TegoSheet,
  type SheetId,
  type SheetTabsRenderProps,
  type TegoSheetError,
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

it('supports default, hidden and isolated custom sheet-tab hosts', async () => {
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

it('uses sheet-tab actions for add, rename, activate and delete with read-only UI errors', async () => {
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
