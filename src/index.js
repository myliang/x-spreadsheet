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
    wrapText: false,
    textDecoration: 'normal',
    strikethrough: false,
    color: '#0a0a0a',
    font: {
      name: 'Source Sans Pro',
      size: 13,
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
class Spreadsheet {
  constructor(tel, options = {}) {
    this.options = helper.merge(defaultOptions, options);
    this.data = new DataProxy(this.options);
    this.toolbar = new Toolbar(this.data);
    this.el = h('div', 'xss')
      .child(this.toolbar.el)
      .on('contextmenu', evt => evt.preventDefault());
    tel.appendChild(this.el.el);
    // create canvas element
    this.sheet = new Sheet(this.el, this.data);
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
