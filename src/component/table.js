import { stringAt } from '../core/alphabet';
import { getFontSizePxByPt } from '../core/font';
import _cell from '../core/cell';
import { formulam } from '../core/formula';
import { formatm } from '../core/format';
import { CellRange } from '../core/cell_range';

import {
  Draw, DrawBox, thinLineWidth, npx,
} from '../canvas/draw';
// gobal var
const cellPaddingWidth = 5;
const tableFixedHeaderCleanStyle = { fillStyle: '#f4f5f8' };
const tableGridStyle = {
  fillStyle: '#fff',
  lineWidth: thinLineWidth,
  strokeStyle: '#e6e6e6',
};
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

function renderCellBorders() {
  const { draw, bboxes } = this;
  if (bboxes) {
    bboxes.forEach(box => draw.strokeBorders(box));
  }
}

function renderCell(rindex, cindex) {
  const { draw, data } = this;
  const cell = data.getCell(rindex, cindex);
  if (cell === null) return;

  const style = data.getCellStyleOrDefault(rindex, cindex);
  // console.log('style:', style);
  const dbox = getDrawBox.call(this, rindex, cindex);
  dbox.bgcolor = style.bgcolor;
  if (style.border !== undefined) {
    dbox.setBorders(style.border);
    this.bboxes.push(dbox);
  }
  draw.rect(dbox, () => {
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
    // error
    const error = data.validations.getError(rindex, cindex);
    if (error) {
      // console.log('error:', rindex, cindex, error);
      draw.error(dbox);
    }
  });
}

function renderContent(viewRange, scrollOffset) {
  const { draw, data } = this;
  const { cols, rows } = data;
  draw.save();
  draw.translate(cols.indexWidth, rows.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

  // 1 render cell
  this.bboxes = [];
  viewRange.each((ri, ci) => {
    renderCell.call(this, ri, ci);
  });
  // 2 render cell border
  renderCellBorders.call(this);
  this.bboxes = [];
  // 3 render mergeCell
  data.eachMergesInView(viewRange, (r) => {
    renderCell.call(this, r.sri, r.sci);
  });
  // 4 render mergeCell border
  renderCellBorders.call(this);

  draw.restore();
}

function renderSelectedHeaderCell(x, y, w, h) {
  const { draw } = this;
  draw.save();
  draw.attr({ fillStyle: 'rgba(75, 137, 255, 0.08)' })
    .fillRect(x, y, w, h);
  draw.restore();
}

function renderFixedHeaders(viewRange) {
  const { draw, data } = this;
  const { cols, rows } = data;
  draw.save();
  const sumHeight = rows.sumHeight(viewRange.sri, viewRange.eri + 1) + rows.height;
  const sumWidth = cols.sumWidth(viewRange.sci, viewRange.eci + 1) + cols.indexWidth;
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
  data.rowEach(viewRange.sri, viewRange.eri, (i, y1, rowHeight) => {
    const y = y1 + rows.height;
    // console.log('y1:', y1, ', i:', i);
    draw.line([0, y], [cols.indexWidth, y]);
    if (sri <= i && i < eri + 1) {
      renderSelectedHeaderCell.call(this, 0, y, cols.indexWidth, rowHeight);
    }
    draw.fillText(i + 1, cols.indexWidth / 2, y + (rowHeight / 2));
  });
  draw.line([0, sumHeight], [cols.indexWidth, sumHeight]);
  draw.line([cols.indexWidth, 0], [cols.indexWidth, sumHeight]);
  // x-header-text
  data.colEach(viewRange.sci, viewRange.eci, (i, x1, colWidth) => {
    const x = x1 + cols.indexWidth;
    // console.log('x1:', x1, ', i:', i);
    draw.line([x, 0], [x, rows.height]);
    if (sci <= i && i < eci + 1) {
      renderSelectedHeaderCell.call(this, x, 0, colWidth, rows.height);
    }
    draw.fillText(stringAt(i), x + (colWidth / 2), rows.height / 2);
  });
  draw.line([sumWidth, 0], [sumWidth, rows.height]);
  draw.line([0, rows.height], [sumWidth, rows.height]);
  // left-top-cell
  draw.attr({ fillStyle: '#f4f5f8' })
    .fillRect(0, 0, cols.indexWidth, rows.height)
    .line([cols.indexWidth, 0], [cols.indexWidth, rows.height])
    .line([0, rows.height], [cols.indexWidth, rows.height]);
  // context.closePath();
  draw.restore();
}

function renderContentGrid({
  sri, sci, eri, eci,
}, scrollOffset = { x: 0, y: 0 }) {
  const { draw, data } = this;
  const { cols, rows, settings } = data;

  draw.save();
  draw.attr(tableGridStyle)
    .translate(cols.indexWidth, rows.height)
    .translate(scrollOffset.x, scrollOffset.y);
  const sumWidth = cols.sumWidth(sci, eci + 1);
  const sumHeight = rows.sumHeight(sri, eri + 1);
  // console.log('sumWidth:', sumWidth);
  draw.clearRect(0, 0, sumWidth, sumHeight);
  if (!settings.showGrid) return;
  // console.log('rowStart:', rowStart, ', rowLen:', rowLen);
  data.rowEach(sri, eri, (i, y, h) => {
    // console.log('y:', y);
    draw.line([0, y], [sumWidth, y]);
    if (i === eri) {
      draw.line([0, y + h], [sumWidth, y + h]);
    }
  });
  data.colEach(sci, eci, (i, x, w) => {
    draw.line([x, 0], [x, sumHeight]);
    if (i === eci) {
      draw.line([x + w, 0], [x + w, sumHeight]);
    }
  });
  draw.restore();
}

function renderFreezeHighlightLine() {
  const { draw, data } = this;
  const { rows, cols } = data;
  const twidth = data.viewWidth();
  const theight = data.viewHeight();
  const ftw = data.freezeTotalWidth();
  const fth = data.freezeTotalHeight();
  draw.save()
    .translate(cols.indexWidth, rows.height)
    .attr({ strokeStyle: 'rgba(75, 137, 255, .6)' });
  draw.line([0, fth], [twidth, fth]);
  draw.line([ftw, 0], [ftw, theight]);
  draw.restore();
}

function renderFreezeGridAndContent({ eri, eci }) {
  const { data } = this;
  const [fri, fci] = data.freeze;
  const { scroll } = data;
  const ftw = data.freezeTotalWidth();
  const fth = data.freezeTotalHeight();
  if (fri > 0) {
    renderContentGrid.call(
      this,
      new CellRange(0, fci + data.scroll.ci, fri - 1, eci),
      { x: ftw, y: 0 },
    );
    renderContent.call(
      this,
      new CellRange(0, fci, fri - 1, eci),
      { x: scroll.x, y: 0 },
    );
  }
  if (fci > 0) {
    renderContentGrid.call(
      this,
      new CellRange(fri + data.scroll.ri, 0, eri, fci - 1),
      { x: 0, y: fth },
    );
    renderContent.call(
      this,
      new CellRange(fri, 0, eri, fci - 1),
      { x: 0, y: scroll.y },
    );
  }
}

function renderAll(viewRange, scrollOffset) {
  // const { row, col, scrollOffset } = this;
  // console.log('viewRange:', viewRange);
  renderContentGrid.call(this, viewRange);
  renderContent.call(this, viewRange, scrollOffset);
  renderFixedHeaders.call(this, viewRange);
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
    this.draw.resize(data.viewWidth(), data.viewHeight());
    this.clear();
    const viewRange = data.viewRange();
    renderAll.call(this, viewRange, data.scroll);
    const [fri, fci] = data.freeze;
    if (fri > 0 || fci > 0) {
      renderFreezeGridAndContent.call(this, viewRange);
      renderAll.call(this, data.freezeViewRange(), { x: 0, y: 0 });
      renderFreezeHighlightLine.call(this);
    }
  }

  clear() {
    this.draw.clear();
  }
}

export default Table;
