import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { SheetId, SheetTabsRenderProps } from '../../src';
import { sheetId } from '../../src/core';
import { SheetTabs } from '../../src/ui/tabs/sheet-tabs';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sheets = [
  { id: sheetId('sheet-a'), index: 0, name: 'A' },
  { id: sheetId('sheet-b'), index: 1, name: 'B' },
  { id: sheetId('sheet-c'), index: 2, name: 'C' },
] as const;

function TabsHarness(props: { readonly readOnly?: boolean; readonly onActivate: (sheet: SheetId) => void }) {
  const [activeSheet, setActiveSheet] = useState<SheetId>(sheets[0].id);
  const tabs: SheetTabsRenderProps = {
    sheets,
    activeSheet,
    readOnly: props.readOnly ?? false,
    add: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn(),
    activate: sheet => {
      props.onActivate(sheet);
      setActiveSheet(sheet);
    },
  };
  return <SheetTabs tabs={tabs} t={(_path, fallback) => fallback} />;
}

it('uses a roving tab stop and activates tabs with wrapped arrow, Home and End navigation', () => {
  const activate = vi.fn();
  const rendered = render(<TabsHarness onActivate={activate} />);
  const tabs = rendered.getAllByRole('tab');

  expect(tabs.map(tab => tab.tabIndex)).toEqual([0, -1, -1]);
  tabs[0]!.focus();

  fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
  expect(activate).toHaveBeenLastCalledWith(sheets[1].id);
  expect(document.activeElement).toBe(tabs[1]);
  expect(tabs.map(tab => tab.tabIndex)).toEqual([-1, 0, -1]);

  fireEvent.keyDown(tabs[1]!, { key: 'End' });
  expect(activate).toHaveBeenLastCalledWith(sheets[2].id);
  expect(document.activeElement).toBe(tabs[2]);

  fireEvent.keyDown(tabs[2]!, { key: 'Home' });
  expect(activate).toHaveBeenLastCalledWith(sheets[0].id);
  expect(document.activeElement).toBe(tabs[0]);

  fireEvent.keyDown(tabs[0]!, { key: 'ArrowLeft' });
  expect(activate).toHaveBeenLastCalledWith(sheets[2].id);
  expect(document.activeElement).toBe(tabs[2]);
});

it('keeps keyboard activation available in read-only mode while mutation controls stay disabled', () => {
  const activate = vi.fn();
  const rendered = render(<TabsHarness readOnly onActivate={activate} />);
  const tabs = rendered.getAllByRole('tab');

  tabs[0]!.focus();
  fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });

  expect(activate).toHaveBeenCalledWith(sheets[1].id);
  expect(document.activeElement).toBe(tabs[1]);
  expect(rendered.getByRole('button', { name: 'Add sheet' }).hasAttribute('disabled')).toBe(true);
  for (const button of rendered.getAllByRole('button', { name: /Delete sheet/ })) {
    expect(button.hasAttribute('disabled')).toBe(true);
  }
});
