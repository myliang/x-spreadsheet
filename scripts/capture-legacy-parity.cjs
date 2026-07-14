const fs = require('fs');
const path = require('path');

const DataProxy = require('../src/core/data_proxy').default;
const cell = require('../src/core/cell').default;
const { formulam } = require('../src/core/formula');
const { CellRange } = require('../src/core/cell_range');

const required = new Set(['blank-object', 'empty-array', 'multiple-sheets', 'sheet-fields', 'rows', 'cells', 'columns', 'styles', 'validations', 'autofilter', 'sparse-falsy', 'history', 'structure', 'merge', 'clipboard', 'autofill', 'filter', 'sort', 'formulas', 'freeze', 'printable']);
const captured = new Map();

process.on('beforeExit', () => {
  const missing = [...required].filter(id => !captured.has(id));
  if (missing.length > 0) throw new Error(`Missing legacy fixtures: ${missing.join(', ')}`);
});

const root = path.resolve(__dirname, '..');
const workbookDir = path.join(root, 'tests/parity/fixtures/workbooks');
const operationDir = path.join(root, 'tests/parity/fixtures/operations');
const metadataPath = path.join(root, 'tests/parity/legacy/baseline-meta.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(stable(value), null, 2)}\n`);
}

function createData(name, input) {
  const data = new DataProxy(name, {
    view: {
      height: () => 600,
      width: () => 800,
    },
  });
  if (input !== undefined) data.setData(clone(input));
  return data;
}

function select(data, sri, sci, eri = sri, eci = sci) {
  data.selector.setIndexes(sri, sci);
  data.selector.range = new CellRange(sri, sci, eri, eci);
}

function snapshot(data) {
  return clone(data.getData());
}

function loadWorkbook(input) {
  const sheets = Array.isArray(input) ? input : [input];
  return sheets.map((sheet, index) => {
    const name = sheet && sheet.name ? sheet.name : `sheet${index + 1}`;
    return snapshot(createData(name, sheet || {}));
  });
}

function capture(id, category, value) {
  captured.set(id, { category, value });
}

function captureWorkbook(id, input) {
  capture(id, 'workbooks', {
    id,
    input,
    legacyOutput: loadWorkbook(input),
  });
}

function clipboardState(data) {
  return {
    range: data.clipboard.range ? data.clipboard.range.toString() : null,
    state: data.clipboard.state,
  };
}

function mapEntries(map) {
  return [...map.entries()].map(([from, to]) => ({ from, to }));
}

captureWorkbook('blank-object', {});
captureWorkbook('empty-array', []);
captureWorkbook('multiple-sheets', [
  {
    name: 'Alpha',
    rows: {
      len: 10,
      0: { cells: { 0: { text: 'alpha' } } },
    },
  },
  {
    freeze: 'B2',
    name: 'Beta',
    rows: {
      len: 8,
      1: { cells: { 1: { text: 'beta' } } },
    },
  },
]);
captureWorkbook('sheet-fields', {
  autofilter: {},
  cols: { len: 6 },
  freeze: 'C3',
  merges: ['A1:B2'],
  name: 'Sheet fields',
  rows: {
    len: 12,
    0: { cells: { 0: { merge: [1, 1], text: 'merged' } } },
  },
  styles: [],
  validations: [],
});
captureWorkbook('rows', {
  name: 'Rows',
  rows: {
    len: 25,
    2: { cells: {}, height: 42, style: 1 },
    7: { cells: {}, hide: true },
  },
  styles: [{ bgcolor: '#f5f5f5' }, { font: { bold: true } }],
});
captureWorkbook('cells', {
  name: 'Cells',
  rows: {
    len: 20,
    1: {
      cells: {
        2: {
          editable: false,
          merge: [1, 2],
          printable: false,
          style: 0,
          text: '=A1+1',
          value: 8,
        },
        5: { text: 'plain' },
      },
    },
  },
  styles: [{ format: 'number' }],
});
captureWorkbook('columns', {
  cols: {
    len: 14,
    1: { style: 0, width: 180 },
    4: { hide: true, width: 72 },
  },
  name: 'Columns',
  styles: [{ align: 'right' }],
});
captureWorkbook('styles', {
  name: 'Styles',
  rows: { len: 10, 0: { cells: { 0: { style: 0, text: 'styled' } } } },
  styles: [{
    align: 'center',
    bgcolor: '#ffeeaa',
    border: {
      bottom: ['dashed', '#444444'],
      left: ['thin', '#111111'],
      right: ['medium', '#333333'],
      top: ['double', '#222222'],
    },
    color: '#123456',
    font: {
      bold: true,
      italic: true,
      name: 'Helvetica',
      size: 14,
    },
    format: 'percent',
    strike: true,
    textwrap: true,
    underline: true,
    valign: 'bottom',
  }],
});
captureWorkbook('validations', {
  name: 'Validations',
  validations: [
    {
      mode: 'cell',
      operator: 'be',
      refs: ['A1:A3'],
      required: true,
      type: 'number',
      value: [1, 10],
    },
    {
      mode: 'cell',
      operator: 'in',
      refs: ['B1'],
      required: false,
      type: 'list',
      value: ['red', 'blue'],
    },
  ],
});
captureWorkbook('autofilter', {
  autofilter: {
    filters: [{ ci: 1, operator: 'in', value: ['open', 'closed'] }],
    ref: 'A1:C5',
    sort: { ci: 2, order: 'desc' },
  },
  name: 'Autofilter',
});
captureWorkbook('sparse-falsy', {
  cols: {
    len: 50,
    0: { hide: false, style: 0, width: 0 },
    23: { hide: true, width: 64 },
  },
  freeze: 'A1',
  name: '',
  rows: {
    len: 80,
    0: {
      cells: {
        0: { editable: false, printable: false, style: 0, text: '', value: 0 },
        12: { text: 'edge' },
      },
      height: 0,
      hide: false,
      style: 0,
    },
    47: { cells: { 31: { text: 'sparse' } }, hide: true },
  },
  styles: [{ strike: false, textwrap: false, underline: false }],
});

{
  const data = createData('History', {
    rows: { len: 10, 0: { cells: { 0: { text: 'seed' } } } },
  });
  const before = snapshot(data);
  data.setCellText(0, 0, 'edited', 'finished');
  const afterEdit = {
    canRedo: data.canRedo(),
    canUndo: data.canUndo(),
    sheet: snapshot(data),
  };
  data.undo();
  const afterUndo = {
    canRedo: data.canRedo(),
    canUndo: data.canUndo(),
    sheet: snapshot(data),
  };
  data.redo();
  capture('history', 'operations', {
    afterEdit,
    afterRedo: {
      canRedo: data.canRedo(),
      canUndo: data.canUndo(),
      sheet: snapshot(data),
    },
    afterUndo,
    before,
    id: 'history',
    operations: ['setCellText(0, 0, "edited", "finished")', 'undo()', 'redo()'],
  });
}

{
  const data = createData('Structure', {
    cols: { len: 5, 1: { width: 140 }, 3: { hide: true } },
    rows: {
      len: 6,
      0: { cells: { 0: { text: 'header' }, 2: { text: '=A2+B2' } } },
      1: { cells: { 0: { text: 'one' }, 1: { text: '1' } } },
      2: { cells: { 0: { text: 'two' }, 1: { text: '2' } } },
    },
  });
  const stages = [{ operation: 'initial', sheet: snapshot(data) }];
  select(data, 1, 0);
  data.insert('row');
  stages.push({ operation: 'insert row at 1', sheet: snapshot(data) });
  data.delete('row');
  stages.push({ operation: 'delete row at 1', sheet: snapshot(data) });
  select(data, 0, 1);
  data.insert('column');
  stages.push({ operation: 'insert column at 1', sheet: snapshot(data) });
  data.delete('column');
  stages.push({ operation: 'delete column at 1', sheet: snapshot(data) });
  capture('structure', 'operations', { id: 'structure', stages });
}

{
  const data = createData('Merge', {
    rows: {
      len: 8,
      0: { cells: { 0: { text: 'kept' }, 1: { text: 'removed' } } },
      1: { cells: { 0: { text: 'removed too' }, 1: { text: 'also removed' } } },
    },
  });
  select(data, 0, 0, 1, 1);
  const before = snapshot(data);
  data.merge();
  const merged = snapshot(data);
  data.unmerge();
  capture('merge', 'operations', {
    afterUnmerge: snapshot(data),
    before,
    id: 'merge',
    merged,
    range: 'A1:B2',
  });
}

{
  const data = createData('Clipboard', {
    rows: {
      len: 10,
      0: { cells: { 0: { style: 0, text: 'A' }, 1: { text: 'B' } } },
    },
    styles: [{ font: { bold: true } }],
  });
  select(data, 0, 0, 0, 1);
  data.copy();
  const copied = clipboardState(data);
  select(data, 2, 0, 2, 1);
  const copyPasted = data.paste('all');
  const afterCopyPaste = snapshot(data);
  select(data, 0, 0, 0, 1);
  data.cut();
  const cut = clipboardState(data);
  select(data, 0, 2, 0, 3);
  const cutPasted = data.paste('all');
  capture('clipboard', 'operations', {
    afterCopyPaste,
    afterCutPaste: snapshot(data),
    copied,
    copyPasted,
    cut,
    cutPasted,
    finalClipboard: clipboardState(data),
    id: 'clipboard',
  });
}

{
  const numeric = createData('Autofill numeric', {
    rows: { len: 10, 0: { cells: { 0: { text: 'Item1' } } } },
  });
  select(numeric, 0, 0);
  const numericAccepted = numeric.autofill(new CellRange(1, 0, 3, 0), 'all');
  const formula = createData('Autofill formula', {
    rows: { len: 10, 0: { cells: { 1: { text: '=A1+1' } } } },
  });
  select(formula, 0, 1);
  const formulaAccepted = formula.autofill(new CellRange(1, 1, 3, 1), 'all');
  capture('autofill', 'operations', {
    cases: [
      { accepted: numericAccepted, destination: 'A2:A4', sheet: snapshot(numeric), source: 'A1' },
      { accepted: formulaAccepted, destination: 'B2:B4', sheet: snapshot(formula), source: 'B1' },
    ],
    id: 'autofill',
  });
}

{
  const data = createData('Filter', {
    rows: {
      len: 8,
      0: { cells: { 0: { text: 'id' }, 1: { text: 'status' } } },
      1: { cells: { 0: { text: '1' }, 1: { text: 'keep' } } },
      2: { cells: { 0: { text: '2' }, 1: { text: 'drop' } } },
      3: { cells: { 0: { text: '3' }, 1: { text: 'keep' } } },
    },
  });
  select(data, 0, 0, 3, 1);
  data.autofilter();
  data.setAutoFilter(1, '', 'in', ['keep']);
  capture('filter', 'operations', {
    excludedRows: [...data.exceptRowSet],
    id: 'filter',
    items: data.autoFilter.items(1, (ri, ci) => data.rows.getCell(ri, ci)),
    operation: { ci: 1, operator: 'in', order: '', value: ['keep'] },
    sheet: snapshot(data),
  });
}

{
  const data = createData('Sort', {
    rows: {
      len: 8,
      0: { cells: { 0: { text: 'id' }, 1: { text: 'name' } } },
      1: { cells: { 0: { text: '1' }, 1: { text: 'zebra' } } },
      2: { cells: { 0: { text: '2' }, 1: { text: 'alpha' } } },
      3: { cells: { 0: { text: '3' }, 1: { text: 'mike' } } },
    },
  });
  select(data, 0, 0, 3, 1);
  data.autofilter();
  data.setAutoFilter(1, 'asc', 'all', []);
  const displayedNames = [1, 2, 3].map((rowIndex) => {
    const sourceRow = data.sortedRowMap.get(rowIndex) || rowIndex;
    return data.getCellTextOrDefault(sourceRow, 1);
  });
  capture('sort', 'operations', {
    displayedNames,
    id: 'sort',
    operation: { ci: 1, operator: 'all', order: 'asc', value: [] },
    sheet: snapshot(data),
    sortedRowMap: mapEntries(data.sortedRowMap),
    unsortedRowMap: mapEntries(data.unsortedRowMap),
  });
}

{
  const data = createData('Formulas', {
    rows: {
      len: 12,
      0: {
        cells: {
          0: { text: '2' },
          1: { text: '=SUM(A1:A2)' },
          2: { text: '=AVERAGE(A1:A2)' },
          3: { text: '=MAX(A1:A2)' },
          4: { text: '=MIN(A1:A2)' },
        },
      },
      1: {
        cells: {
          0: { text: '3' },
          1: { text: '=IF(A1<A2, 10, 20)' },
          2: { text: '=AND(A1<A2, A2>0)' },
          3: { text: '=OR(A1>A2, A2>0)' },
          4: { text: '=CONCAT("v", A1, A2)' },
        },
      },
      2: { cells: { 0: { text: '=A1+A2*4' } } },
    },
  });
  const formulaCells = ['B1', 'C1', 'D1', 'E1', 'B2', 'C2', 'D2', 'E2', 'A3'];
  const rendered = formulaCells.map((ref) => {
    const range = CellRange.valueOf(ref);
    const source = data.getCellTextOrDefault(range.sri, range.sci);
    return {
      ref,
      source,
      value: cell.render(
        source,
        formulam,
        (ci, ri) => data.getCellTextOrDefault(ri, ci),
      ),
    };
  });
  capture('formulas', 'operations', {
    id: 'formulas',
    rendered,
    sheet: snapshot(data),
  });
}

{
  const data = createData('Freeze', {
    cols: { len: 8, 0: { width: 80 }, 1: { width: 120 }, 2: { width: 160 } },
    rows: { len: 12, 0: { cells: {}, height: 20 }, 1: { cells: {}, height: 30 } },
  });
  data.setFreeze(2, 3);
  capture('freeze', 'operations', {
    active: data.freezeIsActive(),
    frozenHeight: data.freezeTotalHeight(),
    frozenWidth: data.freezeTotalWidth(),
    id: 'freeze',
    operation: { ci: 3, ri: 2 },
    sheet: snapshot(data),
  });
}

{
  const data = createData('Printable', {
    rows: { len: 8, 1: { cells: { 1: { text: 'confidential' } } } },
  });
  select(data, 1, 1);
  data.setSelectedCellAttr('printable', false);
  capture('printable', 'operations', {
    cell: data.getCell(1, 1),
    id: 'printable',
    operation: { printable: false, range: 'B2' },
    sheet: snapshot(data),
  });
}

const missing = [...required].filter(id => !captured.has(id));
if (missing.length > 0) throw new Error(`Missing legacy fixtures: ${missing.join(', ')}`);

for (const [id, fixture] of captured) {
  const directory = fixture.category === 'workbooks' ? workbookDir : operationDir;
  writeJson(path.join(directory, `${id}.json`), fixture.value);
}

writeJson(metadataPath, {
  build: {
    command: 'NODE_OPTIONS=--openssl-legacy-provider npm run build',
    defaultRuntimeResult: 'fails without the OpenSSL legacy provider',
    workaround: 'NODE_OPTIONS=--openssl-legacy-provider',
  },
  designSpecCommit: '504ccf8',
  legacyTest: {
    knownFailure: {
      actual: '931-+*23+42/+',
      expected: '931-+23+*42/+',
      test: 'infix expression conversion for (9+(3-1))*(2+3)+4/2',
    },
    summary: '134 passing / 1 failing',
  },
  lint: {
    errors: 3,
    findings: [
      { file: 'src/component/sheet.js', line: 340, rule: 'max-len' },
      { file: 'src/core/alphabet.js', line: 33, rule: 'keyword-spacing' },
      { file: 'src/core/alphabet.js', line: 33, rule: 'no-plusplus' },
    ],
    warnings: 0,
  },
  nodeVersion: process.version,
});
