/* global window */
import helper from './helper';
import Table from './canvas/table';
import { formulas as _formulas } from './formula';

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
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'top',
    wrapText: true,
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
    const {
      row, col, style, formulas,
    } = this.options;
    this.table = new Table(el, row, col, style, _formulas(formulas));
    this.render();
  }
  loadData(data) {
    this.data = data;
    return this;
  }
  render() {
    this.table.setData({
      borders: [
        [1, 'dashed', '#0366d6'],
      ],
      styles: [
        { bgcolor: '#dddddd', bi: 0, color: '#900b09' },
      ],
      cellmm: {
        1: {
          1: { text: 'testing测试testtestetst', si: 0 },
        },
      },
    });
    this.table.render();
  }
}

const xspreadsheet = (el, options = {}) => new Spreadsheet(el, options);

if (window) {
  window.xspreadsheet = xspreadsheet;
}

export default xspreadsheet;
