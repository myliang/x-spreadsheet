/*
  el: element in document
  row: {
    len: number,
    height: number
  }
  col: {
    len: number,
    width: number
  }
*/
import alphabet from '../alphabet';
import helper from '../helper';
// gobal var
const leftFixedCellWidth = 60;

class Table {
  constructor(el, row, col) {
    this.el = el;
    this.context = el.getContext('2d');
    this.row = row;
    this.col = col;
    this.rowm = {}; // {rowIndex: {height: 200},....}
    this.colm = {}; // {colIndex: {width: 200},....}
    this.scrollOffset = { x: 0, y: 0 };
    this.cellmm = {}; // {rowIndex: {colIndex: Cell}}
  }
  render() {
    this.clear();
    this.renderContentGrid();
    this.renderFixedHeaders();
    // this.renderContent();
  }
  // x-scroll, y-scroll
  // offset = {x: , y: }
  scroll(offset) {
    Object.assign(this.scrollOffset, offset);
  }
  setData(data) {
    if (data) {
      this.rowm = data.rowm;
      this.colm = data.colm;
      this.cellmm = data.cellmm;
    }
  }
  clear() {
    const { width, height } = this.el;
    this.context.clearRect(0, 0, width, height);
  }
  /*
  renderContent() {
    const { cellmm } = this;
    Object.keys(cellmm).forEach((v, rindex) => {
      Object.keys(v).forEach((cell, cindex) => this.renderCell(rindex, cindex, cell));
    });
  }
  renderCell(rindex, cindex, cell) {
    const { context } = this;
  }
  getCellOffset(rindex, cindex) {
    let offset = {x: leftFixedCellWidth, y: this.col.width, w: 0, h: 0};
    this.rowEach(rindex, (i, y) => offset.y = y);
    for (let i = 0; i < rindex; i += 1) {
      offset.y += this.getRowHeight(i);
    }
    for (let i = 0; i < cindex; i += 1) {
      offset.x += this.getColWidth(i);
    }
  }
  */
  renderContentGrid() {
    const {
      context, scrollOffset, row, col,
    } = this;
    context.save();
    this.useLineStyle();
    context.translate(leftFixedCellWidth, row.height);
    context.translate(scrollOffset.x, scrollOffset.y);
    // sum
    const colSumWidth = this.colTotalWidth();
    const rowSumHeight = this.rowTotalHeight();
    // console.log('row: ', row, ', col:', col, ', sum:', colSumWidth);
    context.beginPath();
    this.rowEach(row.len, (i, y) => {
      context.moveTo(0, y);
      context.lineTo(colSumWidth, y);
    });
    this.colEach(col.len, (i, x) => {
      context.moveTo(x, 0);
      context.lineTo(x, rowSumHeight);
    });
    context.stroke();
    context.closePath();
    context.restore();
  }
  renderFixedHeaders() {
    const {
      context, row, col, scrollOffset,
    } = this;
    context.save();
    context.fillStyle = '#f4f5f8';
    // y-header
    context.fillRect(0, 0, leftFixedCellWidth, this.rowTotalHeight() + row.height);
    // x-header
    context.fillRect(0, 0, this.colTotalWidth() + leftFixedCellWidth, row.height);
    // text font, align...
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '12px sans-serif';
    context.fillStyle = '#666';
    // y-header-text
    this.useLineStyle();
    context.beginPath();
    this.rowEach(row.len, (i, y1, rowHeight) => {
      const y = y1 + row.height + scrollOffset.y;
      const [tx, ty] = [0 + (leftFixedCellWidth / 2), y + (rowHeight / 2)];
      if (i !== row.len) context.fillText(i + 1, tx, ty);
      context.moveTo(0, y);
      context.lineTo(leftFixedCellWidth, y);
    });
    context.moveTo(leftFixedCellWidth, 0);
    context.lineTo(leftFixedCellWidth, this.rowTotalHeight() + row.height);
    // x-header-text
    this.colEach(col.len, (i, x1, colWidth) => {
      // console.log('::::::', i, x1, colWidth, alphabet.stringAt(i));
      const x = x1 + leftFixedCellWidth + scrollOffset.x;
      const [tx, ty] = [x + (colWidth / 2), 0 + (row.height / 2)];
      if (i !== col.len) context.fillText(alphabet.stringAt(i), tx, ty);
      context.moveTo(x, 0);
      context.lineTo(x, row.height);
    });
    context.moveTo(0, row.height);
    context.lineTo(this.colTotalWidth() + leftFixedCellWidth, row.height);
    context.stroke();
    // left-top-cell
    context.fillStyle = '#f4f5f8';
    context.fillRect(0, 0, leftFixedCellWidth, row.height);
    context.closePath();
    context.restore();
  }
  colTotalWidth() {
    const { col, colm } = this;
    const [cmTotal, cmSize] = helper.sum(colm, v => v.width || 0);
    return ((col.len - cmSize) * col.width) + cmTotal;
  }
  rowTotalHeight() {
    const { row, rowm } = this;
    const [rmTotal, rmSize] = helper.sum(rowm, v => v.height || 0);
    return ((row.len - rmSize) * row.height) + rmTotal;
  }
  colEach(colLen, cb) {
    let x = 0.5;
    for (let i = 0; i <= colLen; i += 1) {
      const colWidth = this.getColWidth(i);
      cb(i, x, colWidth);
      x += colWidth;
    }
  }
  getColWidth(index) {
    const { col, colm } = this;
    return colm[`${index}`] ? colm[`${index}`].width : col.width;
  }
  rowEach(rowLen, cb) {
    let y = 0.5;
    for (let i = 0; i <= rowLen; i += 1) {
      const rowHeight = this.getRowHeight(i);
      cb(i, y, rowHeight);
      y += rowHeight;
    }
  }
  getRowHeight(index) {
    const { row, rowm } = this;
    return rowm[`${index}`] ? rowm[`${index}`].height : row.height;
  }
  useLineStyle() {
    const { context } = this;
    // line width, color
    context.lineWidth = 0.5;
    context.strokeStyle = '#d0d0d0';
  }
}

export default Table;
