import { stringAt } from '../core/alphabet';
import { getFontSizePxByPt } from '../core/font';
import _cell from '../core/cell';
import { formulam } from '../core/formula';
import { formatm } from '../core/format';

import {
  Draw, DrawBox, thinLineWidth, npx,
} from '../canvas/draw';
// gobal var
const cellPaddingWidth = 5;
const tableFixedHeaderCleanStyle = { fillStyle: '#f4f5f8' };
function tableFixedHeaderStyle() {
  return {
    textAlign: 'center',
    textBaseline: 'middle',
    font: `500 ${npx(12)}px Source Sans Pro`,
    fillStyle: '#585757',
    lineWidth: thinLineWidth(),
    strokeStyle: '#e6e6e6',
  };
}

function getDrawBox(rindex, cindex) {
  const { data } = this;
  const {
    left, top, width, height,
  } = data.cellRect(rindex, cindex);
  return new DrawBox(left, top, width, height, cellPaddingWidth);
}

function renderCell(rindex, cindex) {
  const { draw, data } = this;
  const cell = data.getCell(rindex, cindex);

  const style = data.getCellStyleOrDefault(rindex, cindex);
  // console.log('style:', style);
  const dbox = getDrawBox.call(this, rindex, cindex);
  dbox.bgcolor = style.bgcolor;
  draw.rect(dbox, () => {
    if (cell !== null) {
      // render text
      let cellText = _cell.render(rindex, cindex, cell.text || '', formulam, (y, x) => (data.getCellTextOrDefault(x, y)));
      if (style.format) {
        // console.log(data.formatm, '>>', cell.format);
        cellText = formatm[style.format].render(cellText);
      }
      const font = Object.assign({}, style.font);
      font.size = getFontSizePxByPt(font.size);
      // console.log('style:', style);
      draw.text(cellText, dbox, {
        align: style.align,
        valign: style.valign,
        font,
        color: style.color,
        strike: style.strike,
        underline: style.underline,
      }, style.textwrap);
    }
  });
}

function renderCellBorder(ri, ci) {
  const { draw, data } = this;
  const style = data.getCellStyle(ri, ci);
  if (style && style.border) {
    const dbox = getDrawBox.call(this, ri, ci);
    dbox.setBorders(style.border);
    draw.strokeBorders(dbox);
  }
}

/*
function renderCellBorder(ri, ci, bs) {
  const {
    bt, br, bb, bl,
  } = bs;
  const { draw } = this;
  if (bt !== undefined || br !== undefined
    || bb !== undefined || bl !== undefined) {
    const dbox = getDrawBox.call(this, ri, ci);
    dbox.setBorders(bt, br, bb, bl);
    draw.strokeBorders(dbox);
  }
}
*/

function renderContent(rowStart, rowLen, colStart, colLen, scrollOffset) {
  const { draw, data } = this;
  const { cols, rows } = data;
  draw.save();
  draw.translate(cols.indexWidth, rows.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

  const viewRange = data.viewRange(rowStart, rowLen, colStart, colLen);
  // console.log('data.scroll:', data.scroll.indexes, ':', viewRangeIndexes);
  // render cell at first
  data.eachCellsInView(viewRange, (ri, ci) => {
    renderCell.call(this, ri, ci);
  });
  // render mergeCell at second
  data.eachMergesInView(viewRange, ({ sri, sci }) => {
    renderCell.call(this, sri, sci);
  });
  // render border at last
  data.eachCellsInView(viewRange, (ri, ci, mri, mci) => {
    // renderCellBorder.call(this, ri, ci, bt, br, bb, bl);
    renderCellBorder.call(this, mri, mci);
  });

  /*
  data.eachCellsInView(
    rowStart,
    rowLen,
    colStart,
    colLen,
    true,
    (cell, ri, ci) => {
      renderCell.call(this, ri, ci);
    },
  );
  // border
  data.eachCellsInView(
    rowStart,
    rowLen,
    colStart,
    colLen,
    false,
    (cell, ri, ci) => {
      renderCellBorder.call(this, cell, ri, ci);
    },
  );
  */
  draw.restore();
}

function renderSelectedHeaderCell(x, y, w, h) {
  const { draw } = this;
  draw.save();
  draw.attr({ fillStyle: 'rgba(75, 137, 255, 0.08)' })
    .fillRect(x, y, w, h);
  draw.restore();
}

function renderFixedHeaders(rowStart, rowLen, colStart, colLen) {
  const { draw, data } = this;
  const { cols, rows } = data;
  draw.save();
  const sumHeight = rows.sumHeight(0, rowLen) + rows.height;
  const sumWidth = cols.sumWidth(0, colLen) + cols.indexWidth;
  // draw rect background
  draw.attr(tableFixedHeaderCleanStyle)
    .fillRect(0, 0, cols.indexWidth, sumHeight)
    .fillRect(0, 0, sumWidth, rows.height);

  const {
    sri, sci, eri, eci,
  } = data.selector.range;
  // console.log(data.selectIndexes);
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle());
  // y-header-text
  data.rowEach(rowStart, rowLen, (i, y1, rowHeight) => {
    const y = y1 + rows.height;
    // console.log('y1:', y1, ', i:', i);
    draw.line([0, y], [cols.indexWidth, y]);
    if (i !== rowLen) {
      if (sri <= i && i < eri + 1) {
        renderSelectedHeaderCell.call(this, 0, y, cols.indexWidth, rowHeight);
      }
      draw.fillText(i + 1, cols.indexWidth / 2, y + (rowHeight / 2));
    }
  });
  draw.line([cols.indexWidth, 0], [cols.indexWidth, sumHeight]);
  // x-header-text
  data.colEach(colStart, colLen, (i, x1, colWidth) => {
    const x = x1 + cols.indexWidth;
    // console.log('x1:', x1, ', i:', i);
    draw.line([x, 0], [x, rows.height]);
    if (i !== colLen) {
      if (sci <= i && i < eci + 1) {
        renderSelectedHeaderCell.call(this, x, 0, colWidth, rows.height);
      }
      draw.fillText(stringAt(i), x + (colWidth / 2), rows.height / 2);
    }
  });
  draw.line([0, rows.height], [sumWidth, rows.height]);
  // left-top-cell
  draw.attr({ fillStyle: '#f4f5f8' })
    .fillRect(0, 0, cols.indexWidth, rows.height)
    .line([cols.indexWidth, 0], [cols.indexWidth, rows.height])
    .line([0, rows.height], [cols.indexWidth, rows.height]);
  // context.closePath();
  draw.restore();
}

/*
function renderFreezeGridAndContent0(rowLen, colLen, width, height, scrollOffset) {
  const { draw, data } = this;
  const { col, row } = data.options;
  draw.save()
    .translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

  // draw.fillRect(0, 0, width, height);
  // draw.line([0, 0], [width, 0]);
  // draw.line([0, 0], [0, height]);
  data.rowEach(rowLen - 1, (i, y1, rowHeight) => {
    // const y = y1 + rowHeight;
    // console.log('y:', y);
    // if (y >= 0) {
    // draw.line([0, y], [width, y]);
    data.colEach(colLen - 1, (j, x) => {
      // if (x >= 0) {
        // draw.line([x, y - rowHeight], [x, y]);
      renderCell.call(this, i, j);
      // }
    });
  });
  draw.restore();
}
*/

function renderFreezeHighlightLine(p1, p2, scrollOffset) {
  const { draw, data } = this;
  const { rows, cols } = data;
  draw.save()
    .translate(cols.indexWidth, rows.height)
    .translate(-scrollOffset.x, -scrollOffset.y)
    .attr({ strokeStyle: 'rgba(75, 137, 255, .6)' });
  draw.line(p1, p2);
  draw.restore();
}

function renderFreezeGridAndContent() {
  const { data } = this;
  const [fri, fci] = data.freeze;
  const { scroll, cols, rows } = data;
  const sheight = rows.sumHeight(0, fri);
  const twidth = cols.totalWidth();
  if (fri > 0) {
    renderContent.call(
      this,
      0,
      fri,
      0,
      cols.len,
      { x: scroll.x, y: 0 },
    );
  }
  const theight = rows.totalHeight();
  const swidth = cols.sumWidth(0, fci);
  if (fci) {
    renderContent.call(
      this,
      0,
      rows.len,
      0,
      fci,
      { x: 0, y: scroll.y },
    );
  }
  renderFreezeHighlightLine.call(
    this, [0, sheight], [twidth, sheight], { x: scroll.x, y: 0 },
  );
  renderFreezeHighlightLine.call(
    this, [swidth, 0], [swidth, theight], { x: 0, y: scroll.y },
  );
}

function renderAll(rowStart, rowLen, colStart, colLen, scrollOffset) {
  // const { row, col, scrollOffset } = this;
  // renderContentGrid.call(this, rowLen, colLen, scrollOffset);
  renderContent.call(this, rowStart, rowLen, colStart, colLen, scrollOffset);
  renderFixedHeaders.call(this, rowStart, rowLen, colStart, colLen);
}

/** end */
class Table {
  constructor(el, data) {
    this.el = el;
    this.draw = new Draw(el, data.viewWidth(), data.viewHeight());
    this.data = data;
  }

  render() {
    // resize canvas
    const { data } = this;
    const { rows, cols } = data;
    this.draw.resize(data.viewWidth(), data.viewHeight());
    //
    this.clear();
    const { ri, ci } = data.scroll;
    renderAll.call(this, ri, rows.len, ci, cols.len, data.scroll);
    const [fri, fci] = data.freeze;
    if (fri > 0 || fci > 0) {
      renderFreezeGridAndContent.call(this);
      renderAll.call(this, 0, fri, 0, fci, { x: 0, y: 0 });
    }
  }

  clear() {
    this.draw.clear();
  }
}

export default Table;
