/* global window */
import helper from './helper';
import { h } from './component/element';
import DataProxy from './data_proxy';
import Sheet from './component/sheet';
import Toolbar from './component/toolbar';
import './index.less';

const defaultOptions = {
  view: {
    height: () => 800,
  },
  formats: [],
  fonts: [],
  formula: [],
  row: {
    len: 100,
    height: 25,
  },
  col: {
    len: 26,
    width: 100,
    indexWidth: 60,
    minWidth: 60,
  },
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'middle',
    textwrap: false,
    textDecoration: 'normal',
    strikethrough: false,
    color: '#0a0a0a',
    font: {
      name: 'Helvetica',
      size: 10,
      bold: false,
      italic: false,
    },
  },
};

/*
Row: {
  height: number
}
Col: {
  width: number
}
Cell: {
  text: string
  merge: [rowLen, colLen]
  format: string,
  si: style-index
}
*/

/*
  el: element in document
  options: like #defaultOptions
  data: {
    freeze: [0, 0],
    rowm: {}, // Map<int, Row>
    colm: {}, // Map<int, Col>
    cellmm: {}, // Map<int, Map<int, Cell>>
  }
*/

function toolbarChange(type, value) {
  const { data, sheet } = this;
  const style = data.getSelectedCellStyle();
  // const cell = data.getSelectedCell();
  const { font } = style;
  if (type === 'link' || type === 'chart' || type === 'filter') {
  } else {
    if (type === 'bold' || type === 'italic' || type === 'strikethrough') {
      font[type] = !font[type];
    } else if (type === 'textwrap' || type === 'merge') {
      style[type] = !style[type];
    } else if (type === 'font' && font.name !== value.key) {
      font.name = value.key;
    } else if (type === 'font-size' && font.size !== value.pt) {
      font.size = value.pt;
    } else if (type === 'align' || type === 'valign' || type === 'color' || type === 'bgcolor') {
      if (style[type] !== value) style[type] = value;
    } else if (type === 'border') {
      // border
    } else if (type === 'formula') {
      // formula
    } else if (type === 'format') {
      // format
    }
    sheet.reload();
  }
  console.log('type: ', type, ', value:', value);
}

class Spreadsheet {
  constructor(tel, options = {}) {
    this.options = helper.merge(defaultOptions, options);
    this.data = new DataProxy(this.options);
    this.toolbar = new Toolbar(this.data);
    const rootEl = h('div', 'xss')
      .child(this.toolbar.el)
      .on('contextmenu', evt => evt.preventDefault());
    this.sheet = new Sheet(rootEl, this.data);
    // create canvas element
    tel.appendChild(rootEl.el);
    // change event
    this.toolbar.change = (type, value) => toolbarChange.call(this, type, value);
  }

  loadData(data) {
    this.sheet.loadData(data);
    return this;
  }
}

const xspreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.xspreadsheet = xspreadsheet;
}

export default xspreadsheet;
