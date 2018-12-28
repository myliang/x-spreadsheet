import helper from './helper';
import { formulas as _formulas } from './formula';

const defaultData = {
  freezes: [0, 0],
  rowm: {}, // Map<int, Row>, len
  colm: {}, // Map<int, Row>, len
  cellmm: {}, // Map<int, Map<int, Cell>>
  styles: [],
  borders: [],
};

export default class DataProxy {
  constructor(options) {
    this.options = options;
    this.formulam = _formulas(options.formulas);
  }

  load(data) {
    this.d = helper.merge(defaultData, data);
  }

  insertRow(index, n = 1) {
    const { cellmm, rowm } = this.d;
    const ndata = {};
    Object.keys(cellmm).forEach((key) => {
      let ikey = parseInt(key, 10);
      if (ikey >= index) {
        ikey += n;
      }
      ndata[ikey] = cellmm[ikey];
    });
    this.d.cellmm = ndata;
    rowm.len = this.rowLen() + n;
  }

  deleteRow(min, max) {
    const { cellmm, rowm } = this.d;
    for (let i = min; i <= max; i += 1) {
      helper.deleteProperty(cellmm, i);
    }
    rowm.len = this.rowLen() - (max - min) - 1;
  }

  colTotalWidth() {
    const { colm } = this.d;
    const { col } = this.options;
    const [cmTotal, cmSize] = helper.sum(colm, v => v.width || 0);
    return ((col.len - cmSize) * col.width) + cmTotal;
  }

  rowTotalHeight() {
    const { rowm } = this.d;
    const { row } = this.options;
    const [rmTotal, rmSize] = helper.sum(rowm, v => v.height || 0);
    return ((row.len - rmSize) * row.height) + rmTotal;
  }

  cellRect(ri, ci) {
    const { left, top } = this.cellPosition(ri, ci);
    return {
      left,
      top,
      width: this.getColWidth(ci),
      height: this.getRowHeight(ri),
    };
  }

  cellPosition(ri, ci) {
    const left = this.colSumWidth(0, ci);
    const top = this.rowSumHeight(0, ri);
    return {
      left, top,
    };
  }

  getCell(ri, ci) {
    const { cellmm } = this.d;
    if (cellmm[ri] !== undefined && cellmm[ri][ci] !== undefined) {
      return cellmm[ri][ci];
    }
    return null;
  }

  getCellStyle(ri, ci) {
    const cell = this.getCell(ri, ci);
    const { styles } = this.d;
    // console.log('options:', this.opitons.style);
    return helper.merge(this.options.style, cell.si !== undefined ? styles[cell.si] : {});
  }

  setCellText(ri, ci, text) {
    const { cellmm } = this.d;
    cellmm[ri] = cellmm[ri] || {};
    cellmm[ri][ci] = cellmm[ri][ci] || {};
    cellmm[ri][ci].text = text;
  }

  getFreezes() {
    return this.d.freezes;
  }

  setFreezes(ri, ci) {
    this.d.freezes[0] = ri;
    this.d.freezes[1] = ci;
  }

  freezeTotalWidth() {
    return this.colSumWidth(0, this.d.freezes[1] - 1);
  }

  freezeTotalHeight() {
    return this.rowSumHeight(0, this.d.freezes[0] - 1);
  }

  colSumWidth(min, max) {
    return helper.rangeSum(min, max, i => this.getColWidth(i));
  }

  rowSumHeight(min, max) {
    return helper.rangeSum(min, max, i => this.getRowHeight(i));
  }

  rowEach(rowLen, cb) {
    let y = 0;
    for (let i = 0; i <= rowLen; i += 1) {
      const rowHeight = this.getRowHeight(i);
      cb(i, y, rowHeight);
      y += rowHeight;
    }
  }

  colEach(colLen, cb) {
    let x = 0;
    for (let i = 0; i <= colLen; i += 1) {
      const colWidth = this.getColWidth(i);
      cb(i, x, colWidth);
      x += colWidth;
    }
  }

  rowLen() {
    return this.d.rowm.len || this.options.row.len;
  }

  colLen() {
    return this.d.colm.len || this.options.col.len;
  }

  getColWidth(index) {
    const { colm } = this.d;
    const { col } = this.options;
    return colm[`${index}`] ? colm[`${index}`].width : col.width;
  }

  setColWidth(index, v) {
    const { colm } = this.d;
    colm[`${index}`] = colm[`${index}`] || {};
    colm[`${index}`].width = v;
  }

  getRowHeight(index) {
    const { rowm } = this.d;
    const { row } = this.options;
    return rowm[`${index}`] ? rowm[`${index}`].height : row.height;
  }

  setRowHeight(index, v) {
    const { rowm } = this.d;
    rowm[`${index}`] = rowm[`${index}`] || {};
    rowm[`${index}`].height = v;
  }
}
