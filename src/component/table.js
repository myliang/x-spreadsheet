import alphabet from '../alphabet';
import { getFontSizePxByPt } from '../font';
import _cell from '../cell';
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
  const { cellmm } = data.d;
  const cell = data.getCell(rindex, cindex);

  const style = data.getCellStyle(rindex, cindex);
  // console.log('style:', style);
  const dbox = getDrawBox.call(this, rindex, cindex);
  dbox.bgcolor = style.bgcolor;
  draw.rect(dbox);
  if (cell !== null) {
    // render text
    let cellText = _cell.render(cell.text || '', data.formulam, (y, x) => (cellmm[x] && cellmm[x][y] && cellmm[x][y].text) || '');
    if (cell.format) {
      // console.log(data.formatm, '>>', cell.format);
      cellText = data.formatm[cell.format].render(cellText);
    }
    const font = Object.assign({}, style.font);
    font.size = getFontSizePxByPt(font.size);
    // console.log('style:', style);
    draw.text(cellText, dbox, {
      align: style.align,
      valign: style.valign,
      font,
      color: style.color,
      strikethrough: style.strikethrough,
    }, style.textwrap);
  }
}

function renderCellBorder(cell, ri, ci) {
  const { draw, data } = this;
  if (cell && cell.si !== undefined) {
    // console.log('cell:', cell, ri, ci);
    const style = data.getStyle(cell.si);
    if (style) {
      const {
        bti, bri, bbi, bli,
      } = style;
      // console.log('bti:', bti);
      if (bti !== undefined || bri !== undefined
        || bbi !== undefined || bli !== undefined) {
        // console.log('::::::::::', ri, ci);
        const dbox = getDrawBox.call(this, ri, ci);
        // console.log('ri:', ri, ',ci:', ci, 'style:', style, dbox);
        dbox.setBorders(
          data.getBorder(bti),
          data.getBorder(bri),
          data.getBorder(bbi),
          data.getBorder(bli),
        );
        draw.strokeBorders(dbox);
      }
    }
  }
}

function renderContent(rowStart, rowLen, colStart, colLen, scrollOffset) {
  const { draw, data } = this;
  const { col, row } = data.options;
  draw.save();
  draw.translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

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
    true,
    (cell, ri, ci) => {
      renderCellBorder.call(this, cell, ri, ci);
    },
  );
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
  const { col, row } = data.options;
  draw.save();
  const sumHeight = data.rowSumHeight(0, rowLen) + row.height;
  const sumWidth = data.colSumWidth(0, colLen) + col.indexWidth;
  // draw rect background
  draw.attr(tableFixedHeaderCleanStyle)
    .fillRect(0, 0, col.indexWidth, sumHeight)
    .fillRect(0, 0, sumWidth, row.height);

  const [[sri, sci], [eri, eci]] = data.selector.getRange();
  // console.log(data.selectIndexes);
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle());
  // y-header-text
  data.rowEach(rowStart, rowLen, (i, y1, rowHeight) => {
    const y = y1 + row.height;
    // console.log('y1:', y1, ', i:', i);
    draw.line([0, y], [col.indexWidth, y]);
    if (i !== rowLen) {
      if (sri <= i && i < eri + 1) {
        renderSelectedHeaderCell.call(this, 0, y, col.indexWidth, rowHeight);
      }
      draw.fillText(i + 1, col.indexWidth / 2, y + (rowHeight / 2));
    }
  });
  draw.line([col.indexWidth, 0], [col.indexWidth, sumHeight]);
  // x-header-text
  data.colEach(colStart, colLen, (i, x1, colWidth) => {
    const x = x1 + col.indexWidth;
    // console.log('x1:', x1, ', i:', i);
    draw.line([x, 0], [x, row.height]);
    if (i !== colLen) {
      if (sci <= i && i < eci + 1) {
        renderSelectedHeaderCell.call(this, x, 0, colWidth, row.height);
      }
      draw.fillText(alphabet.stringAt(i), x + (colWidth / 2), row.height / 2);
    }
  });
  draw.line([0, row.height], [sumWidth, row.height]);
  // left-top-cell
  draw.attr({ fillStyle: '#f4f5f8' })
    .fillRect(0, 0, col.indexWidth, row.height)
    .line([col.indexWidth, 0], [col.indexWidth, row.height])
    .line([0, row.height], [col.indexWidth, row.height]);
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
  const [fri, fci] = data.getFreeze();
  const { scroll } = data;
  const sheight = data.rowSumHeight(0, fri);
  const twidth = data.colTotalWidth();
  if (fri > 0) {
    renderContent.call(
      this,
      0,
      fri,
      0,
      data.colLen(),
      { x: scroll.x, y: 0 },
    );
  }
  const theight = data.rowTotalHeight();
  const swidth = data.colSumWidth(0, fci);
  if (fci) {
    renderContent.call(
      this,
      0,
      data.rowLen(),
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
    const view = data.getView();
    this.draw = new Draw(el, view.width(), view.height());
    this.data = data;
  }

  render() {
    // resize canvas
    const view = this.data.getView();
    this.draw.resize(view.width(), view.height());
    //
    this.clear();
    const { data } = this;
    const { indexes } = data.scroll;
    renderAll.call(this, indexes[0], data.rowLen(), indexes[1], data.colLen(), data.scroll);
    const [fri, fci] = data.getFreeze();
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
