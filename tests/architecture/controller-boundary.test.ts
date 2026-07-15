import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { WorkbookController } from '../../src/core/controller/workbook-controller';
import { createControlledReconciler } from '../../src/react/control/controlled-reconciler';
import {
  ARCHITECTURE_TEST_TIMEOUT_MS,
  execArchitectureChild,
} from './helpers/architecture-child-process';

const root = resolve(import.meta.dirname, '../..');

function sourceFiles(directory: string): readonly string[] {
  const output: string[] = [];
  const visit = (relative: string): void => {
    for (const entry of readdirSync(resolve(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(file);
      else if (/\.tsx?$/.test(file)) output.push(file);
    }
  };
  visit(directory);
  return output.sort();
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

it('[ARCH-3] keeps controllers on commands instead of importing operations or presentation layers', () => {
  const controllerFiles = sourceFiles('src/core/controller');
  expect(controllerFiles.length).toBeGreaterThan(3);
  for (const file of controllerFiles) {
    expect(imports(file), file).not.toEqual(expect.arrayContaining([
      expect.stringMatching(
        /(?:^|\/)(?:operations|engine|ui|react)(?:\/|$)|(?:^|\/)[^/]*painter(?:\/|$|\.)/,
      ),
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

it('[ARCH-7] executes controlled acknowledgement preservation in the component runtime', () => {
  const cli = resolve(root, 'node_modules/vitest/vitest.mjs');
  const output = execArchitectureChild(process.execPath, [
    cli,
    'run',
    '--project',
    'component',
    'tests/component/controlled-reconciliation.test.tsx',
    'tests/component/editing.test.tsx',
    '-t',
    'acknowledges the newest checkpoint|preserves selection, scroll, and active editing across controlled acknowledgement',
  ], {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  expect(output).toMatch(/Tests\s+2 passed/);
}, ARCHITECTURE_TEST_TIMEOUT_MS);
