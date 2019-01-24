import alphabet from '../alphabet';
import { getFontSizePxByPt } from '../font';
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
/*
const tableGridStyle = {
  fillStyle: '#fff',
  lineWidth: 0.5,
  strokeStyle: '#e6e6e6',
};
*/

/* private methods */
/*
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
*/

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
  draw.save();
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
    draw.text(cellText, dbox, {
      align: style.align,
      valign: style.valign,
      font,
      color: style.color,
      strikethrough: style.strikethrough,
    }, style.textwrap);
  }
  draw.restore();
}

function renderContent(rowLen, colLen, scrollOffset) {
  const { draw, data } = this;
  const { col, row } = data.options;
  draw.save();
  draw.translate(col.indexWidth, row.height)
    .translate(-scrollOffset.x, -scrollOffset.y);

  // [[ri, ci, rn, cn]]
  const cmerges = [];
  for (let i = 0; i < rowLen; i += 1) {
    for (let j = 0; j < colLen; j += 1) {
      const cmergeIndexes = [];
      cmerges.forEach(([mi, mj, rn, cn], index) => {
        if (mi <= i && i <= mi + rn) {
          if (j === mj) {
            j += cn + 1;
          }
        }
        if (i === mi + rn + 1) {
          cmergeIndexes.push(index);
        }
      });
      cmergeIndexes.forEach((it) => {
        cmerges.splice(it, 1);
      });
      renderCell.call(this, i, j);
      // console.log('cmerges:', cmerges);
      const cell = data.getCell(i, j);
      if (cell && cell.merge) {
        const [rn, cn] = cell.merge;
        // console.log('rn:', rn, ', cn:', cn);
        cmerges.push([i, j, rn, cn]);
        j += cn;
      }
    }
  }
  /*
  data.rowEach(rowLen - 1, (i) => {
    data.colEach(colLen - 1, (j) => {
      renderCell.call(this, i, j);
    });
  });
  */
  // merge
  /*
  data.eachMerges(([[sri, sci]]) => {
    if (sri < rowLen && sci < colLen) {
      renderCell.call(this, sri, sci);
    }
  });
  */
  // border
  data.eachCells((cell, ri, ci) => {
    // console.log('cell:', cell);
    // console.log('ri:', ri, ', ci:', ci, ', rowLen:', rowLen, ', colLen:', colLen);
    if (ri < rowLen && ci < colLen && cell.si !== undefined) {
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
          // console.log('ri:', ri, ',ci:', ci, 'style:', style);
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

  const [[sri, sci], [eri, eci]] = data.selector.getRange();
  // console.log(data.selectIndexes);
  // draw text
  // text font, align...
  draw.attr(tableFixedHeaderStyle);
  // y-header-text
  data.rowEach(rowLen, (i, y1, rowHeight) => {
    const y = y1 + row.height - scrollOffset.y;
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
  data.colEach(colLen, (i, x1, colWidth) => {
    const x = x1 + col.indexWidth - scrollOffset.x;
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
    .fillRect(0, 0, col.indexWidth, row.height);
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
      fri,
      data.colLen(),
      { x: scroll.x, y: 0 },
    );
  }
  const theight = data.rowTotalHeight();
  const swidth = data.colSumWidth(0, fci);
  if (fci) {
    renderContent.call(
      this,
      data.rowLen(),
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

function renderAll(rowLen, colLen, scrollOffset) {
  // const { row, col, scrollOffset } = this;
  // renderContentGrid.call(this, rowLen, colLen, scrollOffset);
  renderContent.call(this, rowLen, colLen, scrollOffset);
  renderFixedHeaders.call(this, rowLen, colLen, scrollOffset);
}

/** end */
class Table {
  constructor(el, data) {
    this.el = el;
    this.context = el.getContext('2d');
    this.draw = new Draw(el);
    this.data = data;
  }

  render() {
    this.clear();
    const { data } = this;
    renderAll.call(this, data.rowLen(), data.colLen(), data.scroll);
    const [fri, fci] = data.getFreeze();
    if (fri > 0 || fci > 0) {
      renderFreezeGridAndContent.call(this);
      renderAll.call(this, fri, fci, { x: 0, y: 0 });
    }
  }

  clear() {
    this.draw.clear();
  }
}

export default Table;
