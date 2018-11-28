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
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'middle',
    wrapText: false,
    textDecoration: 'normal',
    color: '#333333',
    bi: border-index
    bti: border-index
    bri: border-index
    bbi: border-index
    bli: border-index
    font: {
      name: 'Arial',
      size: 14,
      bold: false,
      italic: false,
    },
  }
  border: [width, style, color]
*/
import alphabet from '../alphabet';
import helper from '../helper';
import _cell from '../cell';
import { Draw, DrawBox } from '../canvas/draw';
// gobal var
const cellPaddingWidth = 5;
const tableFixedHeaderCleanStyle = { fillStyle: '#f4f5f8' };
const tableFixedHeaderStyle = {
  textAlign: 'center',
  textBaseline: 'middle',
  font: '500 12px sans-serif',
  fillStyle: '#585757',
  lineWidth: 0.5,
  strokeStyle: '#e6e6e6',
};
const tableGridStyle = {
  fillStyle: '#fff',
  lineWidth: 0.5,
  strokeStyle: '#e6e6e6',
};

/* private methods */
function renderContentGrid(rowLen, colLen, scrollOffset) {
  const {
    draw, row, col,
  } = this;
  draw.save();
  draw.attr(tableGridStyle);
  // console.log(col.indexWidth, ':', row.height, scrollOffset);
  draw.translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);
  const sumWidth = this.colSumWidth(0, colLen);
  const sumHeight = this.rowSumHeight(0, rowLen);
  draw.fillRect(0, 0, sumWidth, sumHeight);
  this.rowEach(rowLen, (i, y) => {
    draw.line([0, y], [sumWidth, y]);
  });
  this.colEach(colLen, (i, x) => {
    draw.line([x, 0], [x, sumHeight]);
  });
  draw.restore();
}

function getDrawBox(rindex, cindex) {
  let x; let y; let width; let height;
  this.rowEach(rindex, (i, y1, rowHeight) => {
    y = y1;
    height = rowHeight;
  });
  this.colEach(cindex, (i, x1, colWidth) => {
    x = x1;
    width = colWidth;
  });
  return new DrawBox(x, y, width, height, cellPaddingWidth);
}

function renderCell(rindex, cindex) {
  const {
    styles, formulam, cellmm, draw,
  } = this;
  if (cellmm[rindex] === undefined || cellmm[rindex][cindex] === undefined) return;
  // if (rindex >= rowLen && cindex >= colLen) return;

  const cell = cellmm[rindex][cindex];
  const style = helper.merge(this.style, cell.si !== undefined ? styles[cell.si] : {});
  // console.log('style:', style);
  const dbox = getDrawBox.call(this, rindex, cindex);
  // render cell style
  const {
    bgcolor, bi, bti, bri, bbi, bli,
  } = style;
  dbox.bgcolor = bgcolor;
  dbox.setBorders(
    this.borders[bi],
    this.borders[bti],
    this.borders[bri],
    this.borders[bbi],
    this.borders[bli],
  );
  draw.save();
  // border, background....
  draw.rect(dbox);
  // render text
  const cellText = _cell.render(cell.text, formulam, (x, y) => (cellmm[x] && cellmm[x][y] && cellmm[x][y].text) || '');
  const font = Object.assign({}, style.font);
  draw.text(cellText, dbox, {
    align: style.align,
    valign: style.valign,
    font,
    color: style.color,
  }, style.wrapText);
  draw.restore();
}

function renderContent(rowLen, colLen, scrollOffset) {
  const {
    draw, cellmm, row, col,
  } = this;
  draw.save();
  draw.translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);
  Object.keys(cellmm).forEach((rindex) => {
    if (rindex < rowLen) {
      Object.keys(cellmm[rindex]).forEach((cindex) => {
        if (cindex < colLen) {
          renderCell.call(this, rindex, cindex);
        }
      });
    }
  });
  draw.restore();
}

function renderSelectedHeaderCell(x, y, w, h) {
  const { draw } = this;
  draw.save();
  draw.attr({ fillStyle: 'rgba(75, 137, 255, 0.08)' })
    .fillRect(x, y, w, h);
  draw.restore();
}

function renderFixedHeaders(rowLen, colLen, scrollOffset) {
  const {
    draw, row, col,
  } = this;
  draw.save();
  const sumHeight = this.rowSumHeight(0, rowLen) + row.height;
  const sumWidth = this.colSumWidth(0, colLen) + col.indexWidth;
  // draw rect background
  draw.attr(tableFixedHeaderCleanStyle)
    .fillRect(0, 0, col.indexWidth, sumHeight)
    .fillRect(0, 0, sumWidth, row.height);

  const [[sri, sci], [eri, eci]] = this.selectRectIndexes;
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle);
  // y-header-text
  this.rowEach(rowLen, (i, y1, rowHeight) => {
    const y = y1 + row.height - scrollOffset.y;
    draw.line([0, y], [col.indexWidth, y]);
    if (i !== rowLen) {
      if (sri - 1 <= i && i < eri) {
        renderSelectedHeaderCell.call(this, 0, y, col.indexWidth, rowHeight);
      }
      draw.fillText(i + 1, col.indexWidth / 2, y + (rowHeight / 2));
    }
  });
  draw.line([col.indexWidth, 0], [col.indexWidth, sumHeight]);
  // x-header-text
  this.colEach(colLen, (i, x1, colWidth) => {
    const x = x1 + col.indexWidth - scrollOffset.x;
    draw.line([x, 0], [x, row.height]);
    if (i !== colLen) {
      if (sci - 1 <= i && i < eci) {
        renderSelectedHeaderCell.call(this, x, 0, colWidth, row.height);
      }
      draw.fillText(alphabet.stringAt(i), x + (colWidth / 2), row.height / 2);
    }
  });
  draw.line([0, row.height], [sumWidth, row.height]);
  // left-top-cell
  draw.attr({ fillStyle: '#f4f5f8' })
    .fillRect(0, 0, col.indexWidth, row.height);
  // context.closePath();
  draw.restore();
}

function renderFreezeGridAndContent0(rowLen, colLen, width, height, scrollOffset) {
  const { draw, col, row } = this;
  draw.save()
    .attr(tableGridStyle)
    .translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

  draw.fillRect(0, 0, width, height);
  draw.line([0, 0], [width, 0]);
  draw.line([0, 0], [0, height]);
  this.rowEach(rowLen - 1, (i, y1, rowHeight) => {
    const y = y1 + rowHeight;
    if (y > 0) {
      draw.line([0, y], [width, y]);
      this.colEach(colLen - 1, (j, x) => {
        if (x > 0) {
          draw.line([x, y - rowHeight], [x, y]);
          renderCell.call(this, i, j);
        }
      });
    }
  });
  draw.restore();
}

function renderFreezeHighlightLine(p1, p2, scrollOffset) {
  const { draw, row, col } = this;
  draw.save()
    .translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y)
    .attr({ strokeStyle: 'rgba(75, 137, 255, .6)' });
  draw.line(p1, p2);
  draw.restore();
}


function renderFreezeGridAndContent() {
  const [fri, fci] = this.freezeIndexes;
  const {
    row, col, scrollOffset,
  } = this;
  const sheight = this.rowSumHeight(0, fri - 1);
  const twidth = this.colTotalWidth();
  if (fri > 1) {
    renderFreezeGridAndContent0.call(
      this,
      fri - 1,
      col.len,
      twidth,
      sheight,
      { x: scrollOffset.x, y: 0 },
    );
  }
  const theight = this.rowTotalHeight();
  const swidth = this.colSumWidth(0, fci - 1);
  if (fci > 1) {
    renderFreezeGridAndContent0.call(
      this,
      row.len,
      fci - 1,
      swidth,
      theight,
      { x: 0, y: scrollOffset.y },
    );
  }
  renderFreezeHighlightLine.call(
    this, [0, sheight], [twidth, sheight], { x: scrollOffset.x, y: 0 },
  );
  renderFreezeHighlightLine.call(
    this, [swidth, 0], [swidth, theight], { x: 0, y: scrollOffset.y },
  );
}

function renderAll(rowLen, colLen, scrollOffset) {
  // const { row, col, scrollOffset } = this;
  renderContentGrid.call(this, rowLen, colLen, scrollOffset);
  renderContent.call(this, rowLen, colLen, scrollOffset);
  renderFixedHeaders.call(this, rowLen, colLen, scrollOffset);
}

function getCellRowByY(y) {
  const { row, scrollOffset } = this;
  const fsh = this.freezeSumHeight();
  // console.log('y:', y, ', fsh:', fsh);
  let inits = row.height;
  if (fsh + row.height < y) inits -= scrollOffset.y;
  const [ri, top, height] = helper.rangeReduceIf(
    0,
    row.len,
    inits,
    row.height,
    y,
    i => this.getRowHeight(i),
  );
  if (top <= 0) {
    return { ri: 0, top: 0, height };
  }
  return { ri, top, height };
}

function getCellColByX(x) {
  const { col, scrollOffset } = this;
  const fsw = this.freezeSumWidth();
  let inits = col.indexWidth;
  if (fsw + col.indexWidth < x) inits -= scrollOffset.x;
  const [ci, left, width] = helper.rangeReduceIf(
    0,
    col.len,
    inits,
    col.indexWidth,
    x,
    i => this.getColWidth(i),
  );
  if (left <= 0) {
    return { ci: 0, left: 0, width: col.indexWidth };
  }
  return { ci, left, width };
}

/** end */
class Table {
  constructor(el, row, col, style, formulam) {
    this.el = el;
    this.context = el.getContext('2d');
    this.draw = new Draw(el);
    this.row = row;
    this.col = col;
    this.formulam = formulam;
    this.rowm = {}; // {rowIndex: {height: 200},....}
    this.colm = {}; // {colIndex: {width: 200},....}
    this.scrollOffset = { x: 0, y: 0 };
    this.scrollIndexes = [0, 0];
    this.cellmm = {}; // {rowIndex: {colIndex: Cell}}
    this.style = style;
    this.styles = []; // style array
    this.borders = []; // border array
    this.selectRectIndexes = [[0, 0], [0, 0]];
    this.freezeIndexes = [3, 3]; // freeze index of row, col
  }

  render() {
    this.clear();
    const { row, col, scrollOffset } = this;
    renderAll.call(this, row.len, col.len, scrollOffset);
    const [fri, fci] = this.freezeIndexes;
    if (fri > 1 || fci > 1) {
      renderFreezeGridAndContent.call(this);
      renderAll.call(this, fri - 1, fci - 1, { x: 0, y: 0 });
    }
  }

  // x-scroll, y-scroll
  // offset = {x: , y: }
  scroll(offset, cb = () => {}) {
    // console.log('scroll.offset:', offset);
    const { x, y } = offset;
    const { scrollOffset, col, row } = this;
    const [fri, fci] = this.freezeIndexes;
    // const fRect = this.cellRect(fri - 2, fci - 2);
    // console.log(':::::::::', fRect);
    if (x !== undefined) {
      const [
        ci, left, width,
      ] = helper.rangeReduceIf(fci - 1, col.len, 0, 0, x, i => this.getColWidth(i));
      // console.log('x:', x, ', ci:', ci, ', left:', left, ', width:', width);
      let x1 = left;
      if (x > 0) x1 += width;
      if (scrollOffset.x !== x1) {
        this.scrollIndexes[1] = x > 0 ? ci - (fci - 1) : 0;
        cb(x1 - scrollOffset.x);
        scrollOffset.x = x1;
        this.render();
      }
    }
    if (y !== undefined) {
      const [
        ri, top, height,
      ] = helper.rangeReduceIf(fri - 1, row.len, 0, 0, y, i => this.getRowHeight(i));
      let y1 = top;
      if (y > 0) y1 += height;
      if (scrollOffset.y !== y1) {
        this.scrollIndexes[0] = y > 0 ? ri : 0;
        cb(y1 - scrollOffset.y);
        scrollOffset.y = y1;
        this.render();
      }
    }
  }

  setData(data) {
    if (data) {
      const {
        rowm, colm, cellmm, styles, borders,
      } = data;
      if (rowm) this.rowm = rowm;
      if (colm) this.colm = colm;
      if (cellmm) this.cellmm = cellmm;
      if (styles) this.styles = styles;
      if (borders) this.borders = borders;
    }
  }

  setSelectRectIndexes(indexes) {
    this.selectRectIndexes = indexes;
    return this;
  }

  clear() {
    this.draw.clear();
  }

  getCellRectWithIndexes(x, y, forSelector = true) {
    // console.log('x: ', x, ', y: ', y);
    // 根据鼠标坐标点，获得所在的cell矩形信息(ri, ci, offsetX, offsetY, width, height)
    const { ri, top, height } = getCellRowByY.call(this, y);
    const { ci, left, width } = getCellColByX.call(this, x);
    const { row, col } = this;
    // console.log('ri:', ri, ', ci:', ci, ', left:', left, ', top:', top);
    if (ri >= 0 && ci === 0) {
      const nwidth = forSelector ? this.colTotalWidth() : width;
      const ntop = forSelector ? top - row.height : top;
      return {
        ri, ci, left: 0, top: ntop, width: nwidth, height,
      };
    }
    if (ri === 0 && ci >= 0) {
      const nheight = forSelector ? this.rowTotalHeight() : height;
      const nleft = forSelector ? left - col.indexWidth : left;
      return {
        ri, ci, left: nleft, top: 0, width, height: nheight,
      };
    }
    return {
      ri, ci, left: left - col.indexWidth, top: top - row.height, width, height,
    };
  }

  colTotalWidth() {
    const { col, colm } = this;
    const [cmTotal, cmSize] = helper.sum(colm, v => v.width || 0);
    return ((col.len - cmSize) * col.width) + cmTotal;
  }

  rowTotalHeight() {
    const { row, rowm } = this;
    const [rmTotal, rmSize] = helper.sum(rowm, v => v.height || 0);
    // console.log('rmTotal:', rmTotal, ', rmSize:', rmSize);
    return ((row.len - rmSize) * row.height) + rmTotal;
  }

  getSelectRect() {
    const { scrollOffset } = this;
    const [[sri, sci], [eri, eci]] = this.selectRectIndexes;
    const { left, top } = this.cellPosition(sri - 1, sci - 1);
    let height = this.rowSumHeight(sri - 1, eri);
    let width = this.colSumWidth(sci - 1, eci);
    // console.log('sri:', sri, ', sci:', sci, ', eri:', eri, ', eci:', eci);
    if (eri >= 0 && eci === 0) {
      width = this.colTotalWidth();
    }
    if (eri === 0 && eci >= 0) {
      height = this.rowTotalHeight();
    }
    let left0 = left - scrollOffset.x;
    let top0 = top - scrollOffset.y;
    const fsh = this.freezeSumHeight();
    const fsw = this.freezeSumWidth();
    if (fsw > 0 && fsw > left) {
      left0 = left;
    }
    if (fsh > 0 && fsh > top) {
      top0 = top;
    }
    return {
      left_: left,
      top_: top,
      left: left0,
      top: top0,
      height,
      width,
    };
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

  freezeSumWidth() {
    return this.colSumWidth(0, this.freezeIndexes[1] - 1);
  }

  freezeSumHeight() {
    return this.rowSumHeight(0, this.freezeIndexes[0] - 1);
  }

  colSumWidth(min, max) {
    return helper.rangeSum(min, max, i => this.getColWidth(i));
  }

  rowSumHeight(min, max) {
    return helper.rangeSum(min, max, i => this.getRowHeight(i));
  }

  colEach(colLen, cb) {
    let x = 0;
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

  setColWidth(index, v) {
    this.colm[`${index}`] = this.colm[`${index}`] || {};
    this.colm[`${index}`].width = v;
    this.render();
  }

  rowEach(rowLen, cb) {
    let y = 0;
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

  setRowHeight(index, v) {
    this.rowm[`${index}`] = this.rowm[`${index}`] || {};
    this.rowm[`${index}`].height = v;
    this.render();
  }
}

export default Table;
