/* global window */
import helper from './helper';
import DataProxy from './data_proxy';
import Sheet from './component/sheet';
import './index.less';

const defaultOptions = {
  view: {
    height: () => 600,
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
    color: '#333333',
    font: {
      family: 'Arial',
      size: 14,
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
    freezes: [0, 0],
    rowm: {}, // Map<int, Row>
    colm: {}, // Map<int, Col>
    cellmm: {}, // Map<int, Map<int, Cell>>
  }
*/
class Spreadsheet {
  constructor(el, options = {}) {
    this.el = el;
    this.options = helper.merge(defaultOptions, options);
    // create canvas element
    this.sheet = new Sheet(el, this.options);
  }

  loadData(data) {
    this.sheet.loadData(new DataProxy(this.options, data)).freeze(3, 3);
    return this;
  }
}

const xspreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.xspreadsheet = xspreadsheet;
}

export default xspreadsheet;
