/* global document */
import { h } from './component/element';
import DataProxy from './core/data_proxy';
import Sheet from './component/sheet';
import Bottombar from './component/bottombar';
import { cssPrefix } from './config';
import { locale } from './locale/locale';
import Cr from './core/cell_range';

class Spreadsheet {
  constructor(selectors, options = {}) {
    this.selectors = selectors;
    let targetEl = selectors;
    this.options = { showBottomBar: true, ...options };
    this.sheetIndex = 1;
    this.dataSet = [];
    if (typeof selectors === 'string') {
      targetEl = document.querySelector(selectors);
    }
    this.bottombar = this.options.showBottomBar ? new Bottombar(() => {
      if (this.options.mode === 'read') return;
      const sheetIdx = this.addSheet();
      this.sheet.resetData(sheetIdx, this.dataSet);
    }, (index) => {
      this.sheet.resetData(index, this.dataSet);
    }, () => {
      this.deleteSheet();
    }, (index, value) => {
      this.dataSet[index].name = value;
      this.sheet.trigger('change');
    }) : null;
    this.dataIndex = this.addSheet();
    const rootEl = h('div', `${cssPrefix}`)
      .on('contextmenu', evt => evt.preventDefault());
    // create canvas element
    targetEl.appendChild(rootEl.el);
    this.sheet = new Sheet(rootEl, this.dataIndex, this.dataSet, this.options.insertAtEnd);
    if (this.bottombar !== null) {
      rootEl.child(this.bottombar.el);
    }
  }

  get data() {
    return this.dataSet[this.dataIndex];
  }

  addSheet(name, active = true) {
    const n = name || `Sheet${this.sheetIndex}`;
    const d = new DataProxy(n, this.options);
    d.change = (...args) => {
      this.sheet.trigger('change', ...args);
    };
    this.dataSet.push(d);
    if (this.bottombar !== null) {
      this.bottombar.addItem(n, active, this.options);
    }
    this.sheetIndex += 1;
    return this.dataSet.findIndex(({ name: dname }) => dname === n);
  }

  deleteSheet() {
    if (this.bottombar === null) return;

    const [oldIndex, nindex] = this.bottombar.deleteItem();
    if (oldIndex >= 0) {
      this.dataSet.splice(oldIndex, 1);
      if (nindex >= 0) this.sheet.resetData(this.dataSet[nindex]);
      this.sheet.trigger('change');
    }
  }

  loadData(data) {
    const ds = Array.isArray(data) ? data : [data];
    if (this.bottombar !== null) {
      this.bottombar.clear();
    }
    this.dataSet = [];
    this.sheetIndex = 1; // reset sheet index
    if (ds.length > 0) {
      for (let i = 0; i < ds.length; i += 1) {
        const it = ds[i];
        const ndi = this.addSheet(it.name, i === 0);
        this.dataSet[ndi].setData(it, true);
        if (i === 0) {
          this.sheet.resetData(ndi, this.dataSet);
        }
      }
    }
    return this;
  }

  getData() {
    return this.dataSet.map(it => it.getData());
  }

  cellText(ri, ci, text, force = false, sheetIndex = 0) {
    this.dataSet[sheetIndex].setCellTextRaw(ri, ci, text, force);
    return this;
  }

  resetCellText(sri, sci, eri, eci, force = false, reRender = true, sheetIndex = 0) {
    const cr = new Cr(sri, sci, eri, eci);
    cr.each((ri, ci) => {
      this.dataSet[sheetIndex].setCellTextRaw(ri, ci, null, force);
    });
    if (reRender) {
      this.reRender();
    }
  }

  cell(ri, ci, sheetIndex = 0) {
    return this.dataSet[sheetIndex].getCell(ri, ci);
  }

  cellStyle(ri, ci, sheetIndex = 0) {
    return this.dataSet[sheetIndex].getCellStyle(ri, ci);
  }

  reRender() {
    this.sheet.table.render();
    return this;
  }

  setCellStyle(ri, ci, style, reRender = true, sheetIndex = 0) {
    this.dataSet[sheetIndex].setCellStyle(ri, ci, style);
    if (reRender) {
      this.reRender();
    }
  }

  highlightCell(ri, ci, { error = false, color = '#ffff01' } = {}, reRender = true, sheetIndex = 0) {
    this.setCellStyle(ri, ci, { bgcolor: error ? '#fe0000' : color }, reRender, sheetIndex);
  }

  resetCellStyle(sri, sci, eri, eci, reRender = true, sheetIndex = 0) {
    const cr = new Cr(sri, sci, eri, eci);
    const rows = new Set();
    const cols = new Set();
    cr.each((ri, ci) => {
      this.dataSet[sheetIndex].resetCellStyle(ri, ci);
      rows.add(ri);
      cols.add(ci);
    });
    this.dataSet[sheetIndex].setColProperties(Array.from(rows), Array.from(cols));
    if (reRender) {
      this.reRender();
    }
  }

  getLastUsedRowIndex(sheetIndex = 0) {
    const { rows } = this.dataSet[sheetIndex];
    for (let ri = rows.len - 1; ri >= 0; ri -= 1) {
      const row = rows.get(ri);
      if (!row || !row.cells) {
        // eslint-disable-next-line no-continue
        continue;
      }
      for (const [, cell] of Object.entries(row.cells)) {
        if (cell.text !== null) {
          return ri;
        }
      }
    }
    return -1;
  }

  getLastUsedColumnIndex(offset = 0, sheetIndex = 0) {
    const { rows, cols } = this.dataSet[sheetIndex];
    for (let ci = cols.len - 1; ci >= 0; ci -= 1) {
      for (let ri = 0; ri <= rows.len - 1; ri += 1) {
        if (offset - 1 === ri) {
          // eslint-disable-next-line no-continue
          continue;
        }
        const { text } = rows.getCell(ri, ci);
        if (text !== null || text) {
          return ci;
        }
      }
    }
    return -1;
  }

  getChangedCells(sheetIndex = 0) {
    return this.dataSet[sheetIndex].history.getChangedCellValues();
  }

  getCellsGroupedByRow(sheetIndex = 0) {
    return this.dataSet[sheetIndex].getCellsGroupedByRow();
  }

  resetHistory(sheetIndex = 0) {
    this.dataSet[sheetIndex].history.init();
  }

  getHistoryInitialState(sheetIndex = 0) {
    const { rows, cols } = this.dataSet[sheetIndex].history.initialState;
    return ({ rows, cols });
  }

  on(eventName, func) {
    this.sheet.on(eventName, func);
    return this;
  }

  validate() {
    const { validations } = this.data;
    return validations.errors.size <= 0;
  }

  change(cb) {
    this.sheet.on('change', cb);
    return this;
  }

  static locale(lang, message) {
    locale(lang, message);
  }

  static getInstance(selectors, options = {}) {
    if (!Spreadsheet.instance || Spreadsheet.instance.selectors !== selectors) {
      delete Spreadsheet.instance; // clean up old instance if any
      Spreadsheet.instance = new Spreadsheet(selectors, options);
    }
    Spreadsheet.instance.options = { ...this.options, ...options };
    Spreadsheet.instance.reRender();
    return Spreadsheet.instance;
  }
}

const spreadsheet = (el, options = {}) => new Spreadsheet(el, options);

export default Spreadsheet;
export {
  spreadsheet,
};
