/* global window, document */
import { h } from './component/element';
import DataProxy from './core/data_proxy';
import Sheet from './component/sheet';
import Bottombar from './component/bottombar';
import { cssPrefix } from './config';
import { locale } from './locale/locale';
import './index.less';


class Spreadsheet {
  constructor(selectors, options = {}) {
    let targetEl = selectors;
    this.options = options;
    this.sheetIndex = 1;
    this.datas = [];
    if (typeof selectors === 'string') {
      targetEl = document.querySelector(selectors);
    }
    this.bottombar = new Bottombar(() => {
      const d = this.addSheet();
      this.sheet.resetData(d);
    }, (index) => {
      const d = this.datas[index];
      this.sheet.resetData(d);
    }, () => {
      const newd = this.deleteSheet();
      if (newd !== null) this.sheet.resetData(newd);
    }, (index, value) => {
      this.datas[index].name = value;
    });
    this.data = this.addSheet();
    const rootEl = h('div', `${cssPrefix}`)
      .on('contextmenu', evt => evt.preventDefault());
    // create canvas element
    targetEl.appendChild(rootEl.el);
    this.sheet = new Sheet(rootEl, this.data);
    rootEl.child(this.bottombar.el);
  }

  addSheet(name) {
    const n = name || `sheet${this.sheetIndex}`;
    const d = new DataProxy(n, this.options);
    this.datas.push(d);
    // console.log('d:', n, d, this.datas);
    this.bottombar.addItem(n, true);
    this.sheetIndex += 1;
    return d;
  }

  deleteSheet() {
    const oldIndex = this.bottombar.deleteItem();
    if (oldIndex >= 0) {
      const [oldd] = this.datas.splice(oldIndex, 1);
      this.sheetIndex -= 1;
      return oldd;
    }
    return null;
  }

  loadData(data) {
    const d = Array.isArray(data) ? data[0] : data;
    this.sheet.loadData(d);
    return this;
  }

  getData() {
    return this.datas.map(it => it.getData());
  }

  validate() {
    const { validations } = this.data;
    return validations.errors.size <= 0;
  }

  change(cb) {
    this.data.change = cb;
    return this;
  }

  static locale(lang, message) {
    locale(lang, message);
  }
}

const spreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.x = window.x || {};
  window.x.spreadsheet = spreadsheet;
  window.x.spreadsheet.locale = (lang, message) => locale(lang, message);
}

export default Spreadsheet;
export {
  spreadsheet,
};
