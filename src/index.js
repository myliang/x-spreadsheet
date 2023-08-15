/* global window, document */
import { h } from './component/element';
import DataProxy from './core/data_proxy';
import Sheet from './component/sheet';
import Bottombar from './component/bottombar';
import Event from './component/event'
import { cssPrefix } from './config';
import { locale } from './locale/locale';
import './index.less';


class Spreadsheet {
  constructor(selectors, options = {}) {
    this.destroyed = false;
    const event = new Event();
    this.event = event;
    let targetEl = selectors;
    this.options = { showBottomBar: true, ...options };
    this.sheetIndex = 1;
    this.datas = [];
    if (typeof selectors === 'string') {
      targetEl = document.querySelector(selectors);
    }
    this.bottombar = this.options.showBottomBar ? new Bottombar(event, () => {
      if (this.options.mode === 'read') return;
      const d = this.addSheet();
      this.sheet.resetData(d);
    }, (index) => {
      const d = this.datas[index];
      this.sheet.resetData(d);
    }, () => {
      this.deleteSheet();
    }, (index, value) => {
      this.datas[index].name = value;
      this.sheet.trigger('change');
    }) : null;
    this.data = this.addSheet();
    const rootEl = h('div', `${cssPrefix}`)
      .on('contextmenu', evt => evt.preventDefault());
    this.rootEl = rootEl;
    // create canvas element
    targetEl.appendChild(rootEl.el);
    this.sheet = new Sheet(event, rootEl, this.data);
    if (this.bottombar !== null) {
      rootEl.child(this.bottombar.el);
    }
  }

  addSheet(name, active = true) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    const n = name || `sheet${this.sheetIndex}`;
    const d = new DataProxy(n, this.options);
    d.change = (...args) => {
      this.sheet.trigger('change', ...args);
    };
    this.datas.push(d);
    // console.log('d:', n, d, this.datas);
    if (this.bottombar !== null) {
      this.bottombar.addItem(n, active, this.options);
    }
    this.sheetIndex += 1;
    return d;
  }

  deleteSheet() {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    if (this.bottombar === null) return;

    const [oldIndex, nindex] = this.bottombar.deleteItem();
    if (oldIndex >= 0) {
      this.datas.splice(oldIndex, 1);
      if (nindex >= 0) this.sheet.resetData(this.datas[nindex]);
      this.sheet.trigger('change');
    }
  }

  loadData(data) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    const ds = Array.isArray(data) ? data : [data];
    if (this.bottombar !== null) {
      this.bottombar.clear();
    }
    this.datas = [];
    if (ds.length > 0) {
      for (let i = 0; i < ds.length; i += 1) {
        const it = ds[i];
        const nd = this.addSheet(it.name, i === 0);
        nd.setData(it);
        if (i === 0) {
          this.sheet.resetData(nd);
        }
      }
    }
    return this;
  }

  getData() {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    return this.datas.map(it => it.getData());
  }

  cellText(ri, ci, text, sheetIndex = 0) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    this.datas[sheetIndex].setCellText(ri, ci, text, 'finished');
    return this;
  }

  cell(ri, ci, sheetIndex = 0) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    return this.datas[sheetIndex].getCell(ri, ci);
  }

  cellStyle(ri, ci, sheetIndex = 0) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    return this.datas[sheetIndex].getCellStyle(ri, ci);
  }

  reRender() {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    this.sheet.table.render();
    return this;
  }

  on(eventName, func) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    this.sheet.on(eventName, func);
    return this;
  }

  validate() {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    const { validations } = this.data;
    return validations.errors.size <= 0;
  }

  change(cb) {
    if(this.destroyed) throw new Error('spreadsheet has been destroyed');
    this.sheet.on('change', cb);
    return this;
  }
  
  destroy(){
    this.event.destroy();
    this.rootEl.parent().removeChild(this.rootEl.el);
	this.destroyed = true;
  }
  
  isDestroyed(){
    return this.destroyed;
  }

  static locale(lang, message) {
    locale(lang, message);
  }
}

const spreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.x_spreadsheet = spreadsheet;
  window.x_spreadsheet.locale = (lang, message) => locale(lang, message);
}

export default Spreadsheet;
export {
  spreadsheet,
};
