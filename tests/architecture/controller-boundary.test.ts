import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { WorkbookController } from '../../src/core/controller/workbook-controller';
import { createControlledReconciler } from '../../src/react/control/controlled-reconciler';

const root = resolve(import.meta.dirname, '../..');

function sourceFiles(directory: string): readonly string[] {
  return execFileSync('git', ['ls-files', '-z', directory], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(file => /\.tsx?$/.test(file));
}

function imports(file: string): readonly string[] {
  return ts.preProcessFile(readFileSync(resolve(root, file), 'utf8'))
    .importedFiles.map(entry => entry.fileName);
}

it('[ARCH-3] prevents reverse dependencies into React and UI from the engine', () => {
  for (const file of sourceFiles('src/engine')) {
    expect(imports(file), file).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/(?:^|\/)react(?:\/|$)|(?:^|\/)ui(?:\/|$)/),
    ]));
  }
});

it('keeps operations and painters outside the controller mutation boundary', () => {
  const files = [
    ...sourceFiles('src/core/operations'),
    ...sourceFiles('src/engine/canvas').filter(file => /(?:^|\/)[^/]*painter\.ts$/.test(file)),
  ];
  expect(files.length).toBeGreaterThan(10);
  for (const file of files) {
    expect(imports(file), file).not.toEqual(expect.arrayContaining([
      expect.stringMatching(/(?:^|\/)controller(?:\/|$)|workbook-controller/),
    ]));
  }
});

it('[ARCH-7] preserves runtime IDs and history when a controlled checkpoint is acknowledged', () => {
  const controller = new WorkbookController([{ name: 'Controlled' }]);
  const reconciler = createControlledReconciler(controller);
  const sheet = controller.getSheetIds()[0]!;
  const outcome = controller.dispatch({
    type: 'set-cell-text',
    address: { sheet, row: 0, column: 0 },
    text: 'pending',
  }, 'ref');
  if (outcome.status !== 'committed') throw new Error('fixture command must commit');
  reconciler.record(outcome.commit);
  const acknowledged = structuredClone(outcome.commit.value);
  const historyBefore = controller.historySize;

  expect(reconciler.reconcile(acknowledged)).toEqual({ refresh: true });
  expect(controller.getSheetIds()).toEqual([sheet]);
  expect(controller.historySize).toEqual(historyBefore);
  expect(controller.canUndo).toBe(true);
  controller.dispose();
});

it('[ARCH-7] maps selection, scrolling, and editing preservation to active component regressions', () => {
  const reconciliation = readFileSync(
    resolve(root, 'tests/component/controlled-reconciliation.test.tsx'),
    'utf8',
  );
  const editing = readFileSync(resolve(root, 'tests/component/editing.test.tsx'), 'utf8');
  expect(reconciliation).toMatch(/it\('acknowledges the newest checkpoint without replacing IDs, history, or callbacks'/);
  expect(reconciliation).toMatch(/scroll/);
  expect(editing).toMatch(/it\('preserves editing across controlled acknowledgement but cancels on replacement and read-only'/);
});
