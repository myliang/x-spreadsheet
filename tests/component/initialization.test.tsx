import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { expect, it, vi } from 'vitest';
import {
  WorkbookController,
  type WorkbookControllerOptions,
} from '../../src/core/controller/workbook-controller';
import type { WorkbookInput } from '../../src/core';
import { createControllerExternalStore } from '../../src/react/adapters/controller-external-store';
import { useControllerEpoch } from '../../src/react/hooks/use-controller-epoch';
import { renderSheet } from '../helpers/render-sheet';

it('initializes a single blank sheet from an empty object', () => {
  const rendered = renderSheet({ defaultValue: {} });

  expect(rendered.container.querySelector('output')?.getAttribute('data-mode')).toBe(
    'uncontrolled',
  );
  expect(rendered.container.querySelector('output')?.getAttribute('data-sheets')).toBe('1');
  expect(rendered.runtime.epoch.controller.getValue()).toHaveLength(1);
});

it('preserves an empty array as an empty workbook', () => {
  const rendered = renderSheet({ defaultValue: [] });

  expect(rendered.container.querySelector('output')?.getAttribute('data-sheets')).toBe('0');
  expect(rendered.runtime.epoch.controller.getValue()).toEqual([]);
});

it('reads defaultValue only for the controller epoch initialization', () => {
  const rendered = renderSheet({ defaultValue: [{ name: 'Initial' }] });

  rendered.rerenderProps({ defaultValue: [{ name: 'Ignored' }] });

  expect(rendered.runtime.epoch.controller.getValue()[0]?.name).toBe('Initial');
});

it('keeps the controller epoch usable through Strict Mode effect replay', () => {
  const rendered = renderSheet({ defaultValue: [{}] }, { strict: true });
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  expect(() => act(() => {
    rendered.runtime.dispatchRef({
      type: 'set-cell-text',
      address: { sheet, row: 0, column: 0 },
      text: 'strict',
    });
  })).not.toThrow();
});

it('creates no controller for an aborted render and disposes every Strict Mode epoch once', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let created = 0;
  let disposed = 0;
  const createController = (input: WorkbookInput, options: WorkbookControllerOptions) => {
    created += 1;
    const controller = new WorkbookController(input, options);
    const dispose = controller.dispose.bind(controller);
    controller.dispose = () => {
      disposed += 1;
      dispose();
    };
    return controller;
  };

  function Aborted(): never {
    useControllerEpoch({ defaultValue: [{}] }, { createController });
    throw new Error('abort render');
  }
  expect(() => render(<Aborted />)).toThrow('abort render');
  expect(created).toBe(0);

  function Mounted() {
    const epoch = useControllerEpoch({ defaultValue: [{}] }, { createController });
    return <output>{epoch?.snapshot.revision ?? 'pending'}</output>;
  }
  const mounted = render(<StrictMode><Mounted /></StrictMode>);
  expect(created).toBe(2);
  expect(disposed).toBe(1);
  mounted.unmount();
  expect(disposed).toBe(2);
});

it('makes an unmounted epoch synchronously inactive', () => {
  const rendered = renderSheet({ defaultValue: [{}] });
  const staleDispatcher = rendered.runtime.dispatcher;
  const sheet = rendered.runtime.epoch.snapshot.sheets[0]!.id;

  rendered.unmount();

  expect(() => staleDispatcher.dispatchRef({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'after unmount',
  })).toThrow(/disposed|inactive/i);
});

it('catches up the external snapshot on delayed first subscribe and reconnect', () => {
  const controller = new WorkbookController([{}]);
  const store = createControllerExternalStore(controller);
  const sheet = controller.getSheetIds()[0]!;

  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'before subscribe',
  }, 'ref');
  const first = vi.fn();
  const disconnect = store.subscribe(first);
  expect(store.getSnapshot().revision).toBe(1);
  expect(first).toHaveBeenCalledOnce();

  disconnect();
  controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'while disconnected',
  }, 'ref');
  const second = vi.fn();
  store.subscribe(second);
  expect(store.getSnapshot().revision).toBe(2);
  expect(second).toHaveBeenCalledOnce();

  store.dispose();
  controller.dispose();
});
