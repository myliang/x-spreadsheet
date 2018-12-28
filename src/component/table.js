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
  const { draw, data } = this;
  const { row, col } = data.options;
  draw.save();
  draw.attr(tableGridStyle);
  // console.log(col.indexWidth, ':', row.height, scrollOffset);
  draw.translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);
  const sumWidth = data.colSumWidth(0, colLen);
  const sumHeight = data.rowSumHeight(0, rowLen);
  draw.fillRect(0, 0, sumWidth, sumHeight);
  data.rowEach(rowLen, (i, y) => {
    draw.line([0, y], [sumWidth, y]);
  });
  data.colEach(colLen, (i, x) => {
    draw.line([x, 0], [x, sumHeight]);
  });
  draw.restore();
}

function getDrawBox(rindex, cindex) {
  const { data } = this;
  let x; let y; let width; let height;
  data.rowEach(rindex, (i, y1, rowHeight) => {
    y = y1;
    height = rowHeight;
  });
  data.colEach(cindex, (i, x1, colWidth) => {
    x = x1;
    width = colWidth;
  });
  return new DrawBox(x, y, width, height, cellPaddingWidth);
}

function renderCell(rindex, cindex) {
  const { draw, data } = this;
  const { cellmm, borders } = data.d;
  const cell = data.getCell(rindex, cindex);
  if (cell === null) return;

  const style = data.getCellStyle(rindex, cindex);
  // console.log('style:', style);
  const dbox = getDrawBox.call(this, rindex, cindex);
  // render cell style
  const {
    bgcolor, bi, bti, bri, bbi, bli,
  } = style;
  dbox.bgcolor = bgcolor;
  dbox.setBorders(
    borders[bi],
    borders[bti],
    borders[bri],
    borders[bbi],
    borders[bli],
  );
  draw.save();
  // border, background....
  draw.rect(dbox);
  // render text
  const cellText = _cell.render(cell.text, data.formulam, (x, y) => (cellmm[x] && cellmm[x][y] && cellmm[x][y].text) || '');
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
  const { draw, data } = this;
  const { col, row } = data.options;
  const { cellmm } = data.d;
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
  const { draw, data } = this;
  const { col, row } = data.options;
  draw.save();
  const sumHeight = data.rowSumHeight(0, rowLen) + row.height;
  const sumWidth = data.colSumWidth(0, colLen) + col.indexWidth;
  // draw rect background
  draw.attr(tableFixedHeaderCleanStyle)
    .fillRect(0, 0, col.indexWidth, sumHeight)
    .fillRect(0, 0, sumWidth, row.height);

  const [[sri, sci], [eri, eci]] = this.selectRectIndexes;
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle);
  // y-header-text
  data.rowEach(rowLen, (i, y1, rowHeight) => {
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
  data.colEach(colLen, (i, x1, colWidth) => {
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
  const { draw, data } = this;
  const { col, row } = data.options;
  draw.save()
    .attr(tableGridStyle)
    .translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

  draw.fillRect(0, 0, width, height);
  draw.line([0, 0], [width, 0]);
  draw.line([0, 0], [0, height]);
  data.rowEach(rowLen - 1, (i, y1, rowHeight) => {
    const y = y1 + rowHeight;
    if (y > 0) {
      draw.line([0, y], [width, y]);
      data.colEach(colLen - 1, (j, x) => {
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
  const { draw, data } = this;
  const { row, col } = data.options;
  draw.save()
    .translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y)
    .attr({ strokeStyle: 'rgba(75, 137, 255, .6)' });
  draw.line(p1, p2);
  draw.restore();
}


function renderFreezeGridAndContent() {
  const { data } = this;
  const [fri, fci] = data.getFreezes();
  const { scrollOffset } = this;
  const { row, col } = data.options;
  const sheight = data.rowSumHeight(0, fri - 1);
  const twidth = data.colTotalWidth();
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
  const theight = data.rowTotalHeight();
  const swidth = data.colSumWidth(0, fci - 1);
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
  const { data, scrollOffset } = this;
  const { row } = data.options;
  const fsh = data.freezeTotalHeight();
  // console.log('y:', y, ', fsh:', fsh);
  let inits = row.height;
  if (fsh + row.height < y) inits -= scrollOffset.y;
  const [ri, top, height] = helper.rangeReduceIf(
    0,
    row.len,
    inits,
    row.height,
    y,
    i => data.getRowHeight(i),
  );
  if (top <= 0) {
    return { ri: 0, top: 0, height };
  }
  return { ri, top, height };
}

function getCellColByX(x) {
  const { scrollOffset, data } = this;
  const { col } = data.options;
  const fsw = data.freezeTotalWidth();
  let inits = col.indexWidth;
  if (fsw + col.indexWidth < x) inits -= scrollOffset.x;
  const [ci, left, width] = helper.rangeReduceIf(
    0,
    col.len,
    inits,
    col.indexWidth,
    x,
    i => data.getColWidth(i),
  );
  if (left <= 0) {
    return { ci: 0, left: 0, width: col.indexWidth };
  }
  return { ci, left, width };
}

/** end */
class Table {
  constructor(el, data) {
    this.el = el;
    this.context = el.getContext('2d');
    this.draw = new Draw(el);
    this.scrollOffset = { x: 0, y: 0 };
    this.scrollIndexes = [0, 0];
    this.selectRectIndexes = [[0, 0], [0, 0]];
    this.data = data;
  }

  render() {
    this.clear();
    const {
      scrollOffset, data,
    } = this;
    renderAll.call(this, data.rowLen(), data.colLen(), scrollOffset);
    const [fri, fci] = data.getFreezes();
    if (fri > 1 || fci > 1) {
      renderFreezeGridAndContent.call(this);
      renderAll.call(this, fri - 1, fci - 1, { x: 0, y: 0 });
    }
  }

  // x-scroll, y-scroll
  // offset = {x: , y: }
  scroll(offset) {
    // console.log('scroll.offset:', offset);
    const { x, y } = offset;
    const { scrollOffset, data } = this;
    const [fri, fci] = data.getFreezes();
    // const fRect = this.cellRect(fri - 2, fci - 2);
    // console.log(':::::::::', fRect);
    if (x !== undefined) {
      const [
        ci, left, width,
      ] = helper.rangeReduceIf(fci - 1, data.colLen(), 0, 0, x, i => data.getColWidth(i));
      // console.log('x:', x, ', ci:', ci, ', left:', left, ', width:', width);
      let x1 = left;
      if (x > 0) x1 += width;
      if (scrollOffset.x !== x1) {
        this.scrollIndexes[1] = x > 0 ? ci - (fci - 1) : 0;
        // cb(x1 - scrollOffset.x);
        scrollOffset.x = x1;
        this.render();
      }
    }
    if (y !== undefined) {
      const [
        ri, top, height,
      ] = helper.rangeReduceIf(fri - 1, data.rowLen(), 0, 0, y, i => data.getRowHeight(i));
      let y1 = top;
      if (y > 0) y1 += height;
      if (scrollOffset.y !== y1) {
        this.scrollIndexes[0] = y > 0 ? ri : 0;
        // cb(y1 - scrollOffset.y);
        scrollOffset.y = y1;
        this.render();
      }
    }
  }

  setFreezeIndexes([ri, ci]) {
    this.data.setFreezes(ri, ci);
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
    const { data } = this;
    const { row, col } = data.options;
    // console.log('ri:', ri, ', ci:', ci, ', left:', left, ', top:', top);
    if (ri >= 0 && ci === 0) {
      const nwidth = forSelector ? data.colTotalWidth() : width;
      const ntop = forSelector ? top - row.height : top;
      return {
        ri, ci, left: 0, top: ntop, width: nwidth, height,
      };
    }
    if (ri === 0 && ci >= 0) {
      const nheight = forSelector ? data.rowTotalHeight() : height;
      const nleft = forSelector ? left - col.indexWidth : left;
      return {
        ri, ci, left: nleft, top: 0, width, height: nheight,
      };
    }
    return {
      ri, ci, left: left - col.indexWidth, top: top - row.height, width, height,
    };
  }

  getSelectRect() {
    const { scrollOffset, data } = this;
    const [[sri, sci], [eri, eci]] = this.selectRectIndexes;
    // no selector
    if (sri <= 0 && sci <= 0) {
      return {
        left: 0, l: 0, top: 0, t: 0, scroll: scrollOffset,
      };
    }
    const { left, top } = data.cellPosition(sri - 1, sci - 1);
    let height = data.rowSumHeight(sri - 1, eri);
    let width = data.colSumWidth(sci - 1, eci);
    // console.log('sri:', sri, ', sci:', sci, ', eri:', eri, ', eci:', eci);
    if (eri >= 0 && eci === 0) {
      width = data.colTotalWidth();
    }
    if (eri === 0 && eci >= 0) {
      height = data.rowTotalHeight();
    }
    let left0 = left - scrollOffset.x;
    let top0 = top - scrollOffset.y;
    const fsh = data.freezeTotalHeight();
    const fsw = data.freezeTotalWidth();
    if (fsw > 0 && fsw > left) {
      left0 = left;
    }
    if (fsh > 0 && fsh > top) {
      top0 = top;
    }
    return {
      l: left,
      t: top,
      left: left0,
      top: top0,
      height,
      width,
      scroll: scrollOffset,
    };
  }
}

export default Table;
