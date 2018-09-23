/* global window */
import helper from './helper';
import Table from './canvas/table';

const defaultOptions = {
  formats: [],
  fonts: [],
  formula: [],
  row: {
    len: 10,
    height: 25,
  },
  col: {
    len: 5,
    width: 100,
  },
  cell: {
    style: {
      color: '#ffffff',
      align: 'left',
      valign: 'middle',
      wrapText: false,
      font: {
        name: 'Arial',
        size: 14,
        color: '#666666',
        bitmap: 0,
      },
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
  value: string
  merge: [rowLen, colLen]
  formula: string,
  format: string,
}
*/

/*
  el: element in document
  options: like #defaultOptions
  data: {
    rowm: {}, // Map<int, Row>
    colm: {}, // Map<int, Col>
    cellmm: {}, // Map<int, Map<int, Cell>>
  }
*/
class Spreadsheet {
  constructor(el, options = {}) {
    this.el = el;
    this.options = helper.merge(defaultOptions, options);
    this.data = null;
    const { row, col } = this.options;
    this.table = new Table(el, row, col);
    this.render();
  }
  loadData(data) {
    this.data = data;
    return this;
  }
  render() {
    this.table.render();
  }
}

const xspreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.xspreadsheet = xspreadsheet;
}

export default xspreadsheet;
