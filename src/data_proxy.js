/* eslint no-new-wrappers: "error" */
import helper from './helper';
import { formulas as _formulas } from './formula';
import { formats as _formats } from './format';
import { fonts as _fonts } from './font';
import { expr2expr } from './cell';

/*
Cell: {
  text: string
  merge: [rowLen, colLen]
  format: string,
  si: style-index
}
*/
const defaultData = {
  freeze: [0, 0],
  merges: [], // [[[sri, sci], [eri, eci]],...]
  rowm: {}, // Map<int, Row>, len
  colm: {}, // Map<int, Row>, len
  cellmm: {}, // Map<int, Map<int, Cell>>
  styles: [],
  borders: [],
};

class History {
  constructor() {
    this.undoItems = [];
    this.redoItems = [];
  }

  add(data) {
    this.undoItems.push(helper.cloneDeep(data));
    this.redoItems = [];
  }

  canUndo() {
    return this.undoItems.length > 0;
  }

  canRedo() {
    return this.redoItems.length > 0;
  }

  undo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canUndo()) {
      redoItems.push(helper.cloneDeep(currentd));
      cb(undoItems.pop());
    }
  }

  redo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      undoItems.push(helper.cloneDeep(currentd));
      cb(redoItems.pop());
    }
  }
}

class Clipboard {
  constructor() {
    this.sIndexes = null;
    this.eIndexes = null;
    this.state = 'clear';
  }

  copy(sIndexes, eIndexes) {
    this.set(sIndexes, eIndexes, 'copy');
    return this;
  }

  cut(sIndexes, eIndexes) {
    this.set(sIndexes, eIndexes, 'cut');
    return this;
  }

  isCopy() {
    return this.state === 'copy';
  }

  isCut() {
    return this.state === 'cut';
  }

  set(sIndexes, eIndexes, state) {
    this.sIndexes = sIndexes;
    this.eIndexes = eIndexes;
    this.state = state;
    return this;
  }

  get() {
    return [this.sIndexes, this.eIndexes];
  }

  isClear() {
    return this.state === 'clear';
  }

  clear() {
    this.sIndexes = null;
    this.sIndexes = null;
    this.state = 'clear';
  }
}

class Scroll {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.indexes = [0, 0];
  }
}

function addHistory() {
  this.history.add(this.d);
}

function deleteCells() {
  const { d } = this;
  const { cellmm } = d;
  const [[sri, sci], [eri, eci]] = this.selectedIndexes;
  const ndata = {};
  // console.log(sri, sci, eri, eci);
  Object.keys(cellmm).forEach((ri) => {
    if (ri >= sri && ri <= eri) {
      const ncdata = {};
      let ncdataLength = 0;
      Object.keys(cellmm[ri]).forEach((ci) => {
        if (ci < sci || ci > eci) {
          ncdataLength += 1;
          ncdata[ci] = cellmm[ri][ci];
        }
      });
      if (ncdataLength > 0) {
        ndata[ri] = ncdata;
      }
    } else {
      ndata[ri] = cellmm[ri];
    }
  });
  d.cellmm = ndata;
}

function getCellRowByY(y, scrollOffsety) {
  const { options } = this;
  const { row } = options;
  const fsh = this.freezeTotalHeight();
  // console.log('y:', y, ', fsh:', fsh);
  let inits = row.height;
  if (fsh + row.height < y) inits -= scrollOffsety;
  const [ri, top, height] = helper.rangeReduceIf(
    0,
    this.rowLen(),
    inits,
    row.height,
    y,
    i => this.getRowHeight(i),
  );
  if (top <= 0) {
    return { ri: -1, top: 0, height };
  }
  return { ri: ri - 1, top, height };
  // return { ri, top: top - row.height, height };
}

function getCellColByX(x, scrollOffsetx) {
  const { options } = this;
  const { col } = options;
  const fsw = this.freezeTotalWidth();
  let inits = col.indexWidth;
  if (fsw + col.indexWidth < x) inits -= scrollOffsetx;
  const [ci, left, width] = helper.rangeReduceIf(
    0,
    this.colLen(),
    inits,
    col.indexWidth,
    x,
    i => this.getColWidth(i),
  );
  if (left <= 0) {
    return { ci: -1, left: 0, width: col.indexWidth };
  }
  return { ci: ci - 1, left, width };
  // return { ci, left: left - col.indexWidth, width };
}

function eachMerges(cb) {
  const { merges } = this.d;
  // console.log('merges:', merges);
  if (merges.length > 0) {
    for (let i = 0; i < merges.length; i += 1) {
      cb(merges[i]);
    }
  }
}

function inMerges(ri, ci, cb) {
  const { merges } = this.d;
  // console.log('merges:', merges);
  if (merges.length > 0) {
    for (let i = 0; i < merges.length; i += 1) {
      // console.log('merges:', merges);
      const [[sri, sci], [eri, eci]] = merges[i];
      if (ri >= sri && ri <= eri && ci >= sci && ci <= eci) {
        cb(merges[i]);
        break;
      }
    }
  }
}

function deleteMerges([sri, sci], [eri, eci]) {
  const nmerges = [];
  eachMerges.call(this, (merge) => {
    const [[msri, msci], [meri, meci]] = merge;
    if (msri > eri || sri > meri || msci > eci || sci > meci) {
      nmerges.push(merge);
    }
  });
  this.d.merges = nmerges;
}

function addMerges(sIndexes, eIndexes) {
  this.d.merges.push([sIndexes, eIndexes]);
}

function addMergesByCellIndexes(ri, ci) {
  const cell = this.getCell(ri, ci);
  if (cell && cell.merge) {
    const [rn, cn] = cell.merge;
    if (rn <= 0 && cn <= 0) return;
    addMerges.call(this, [ri, ci], [ri + rn, ci + cn]);
  }
}

function moveMerges([sri, sci], [eri, eci], rn, cn) {
  eachMerges.call(this, (merge) => {
    const [[msri, msci], [meri, meci]] = merge;
    if (msri > eri || sri > meri || msci > eci || sci > meci) {
      // no intersection
    } else {
      // console.log('::::::::', merge, rn, cn);
      for (let i = 0; i <= 1; i += 1) {
        const indexes = merge[i];
        indexes[0] += rn;
        indexes[1] += cn;
      }
    }
  });
}

// type: row | col
// i: index
function modifyMerges(type, i, n) {
  const idx = type === 'row' ? 0 : 1;
  eachMerges.call(this, (merge) => {
    const [sIndexes, eIndexes] = merge;
    if (sIndexes[idx] >= i) {
      sIndexes[idx] += n;
      eIndexes[idx] += n;
    } else if (sIndexes[idx] < i && i <= eIndexes[idx]) {
      eIndexes[idx] += n;
      const cell = this.getCell(...sIndexes);
      cell.merge[idx] += n;
    }
  });
}

function copyPaste(srcIndexes, dstIndexes, what, autofill = false) {
  const { cellmm } = this.d;
  const [[sri, sci], [eri, eci]] = srcIndexes;
  const [[dsri, dsci], [deri, deci]] = dstIndexes;
  const rn = eri - sri + 1;
  const cn = eci - sci + 1;
  const drn = deri - dsri + 1;
  const dcn = deci - dsci + 1;
  // console.log(srcIndexes, dstIndexes);
  let isAdd = true;
  let dn = 0;
  if (deri < sri || deci < sci) {
    isAdd = false;
    if (deri < sri) dn = drn;
    else dn = dcn;
  }
  // console.log('drn:', drn, ', dcn:', dcn);
  for (let i = sri; i <= eri; i += 1) {
    if (cellmm[i]) {
      for (let j = sci; j <= eci; j += 1) {
        if (cellmm[i][j]) {
          for (let ii = dsri; ii <= deri; ii += rn) {
            for (let jj = dsci; jj <= deci; jj += cn) {
              const nri = ii + (i - sri);
              const nci = jj + (j - sci);
              const ncell = helper.cloneDeep(cellmm[i][j]);
              // ncell.text
              if (autofill && ncell && ncell.text && ncell.text.length > 0) {
                const { text } = ncell;
                let n = (jj - dsci) + (ii - dsri) + 1;
                // console.log('n:', n);
                if (!isAdd) {
                  n -= dn + 1;
                }
                if (text[0] === '=') {
                  ncell.text = text.replace(/\w{1,3}\d/g, (word) => {
                    let [xn, yn] = [0, 0];
                    if (sri === dsri) {
                      xn = n;
                    } else {
                      yn = n;
                    }
                    // console.log('xn:', xn, ', yn:', yn, expr2expr(word, xn, yn));
                    return expr2expr(word, xn, yn);
                  });
                } else {
                  const result = /[\\.\d]+$/.exec(text);
                  // console.log('result:', result);
                  if (result !== null) {
                    const index = Number(result[0]) + n;
                    ncell.text = text.substring(0, result.index) + index;
                  }
                }
              }
              this.setCell(nri, nci, ncell, what);
              addMergesByCellIndexes.call(this, nri, nci);
            }
          }
        }
      }
    }
  }
}

function cutPaste(srcIndexes, dstIndexes) {
  const { clipboard, d } = this;
  const { cellmm } = d;
  const [[sri, sci], [eri, eci]] = srcIndexes;
  const [[dsri, dsci]] = dstIndexes;
  const ncellmm = {};
  Object.keys(cellmm).forEach((ri) => {
    Object.keys(cellmm[ri]).forEach((ci) => {
      let nri = parseInt(ri, 10);
      let nci = parseInt(ci, 10);
      if (ri >= sri && ri <= eri && ci >= sci && ci <= eci) {
        nri = dsri + (nri - sri);
        nci = dsci + (nci - sci);
      }
      ncellmm[nri] = ncellmm[nri] || {};
      ncellmm[nri][nci] = cellmm[ri][ci];
    });
  });
  // console.log('rn:', nsri - sri, ', cn:', nsci - sci);
  moveMerges.call(this, [sri, sci], [eri, eci], dsri - sri, dsci - sci);
  d.cellmm = ncellmm;
  clipboard.clear();
}

export default class DataProxy {
  constructor(options) {
    this.options = options;
    this.formulam = _formulas(options.formulas);
    this.formatm = _formats(options.formats);
    this.fontm = _fonts(options.fonts);
    this.d = defaultData;
    this.clipboard = new Clipboard();
    this.history = new History();
    this.scroll = new Scroll();
    this.selectedIndexes = [[-1, -1], [-1, -1]];
  }

  load(data) {
    this.d = helper.merge(defaultData, data);
  }

  undo() {
    const { history } = this;
    history.undo(this.d, (d) => {
      this.d = d;
    });
  }

  redo() {
    const { history } = this;
    history.redo(this.d, (d) => {
      this.d = d;
    });
  }

  /* for select start */
  setSelectedIndexes(sIndexes, eIndexes) {
    this.selectedIndexes = [sIndexes, eIndexes];
  }

  xyInSelectedRect(x, y) {
    const {
      left, top, width, height,
    } = this.getSelectedRect();
    const { row, col } = this.options;
    const x1 = x - col.indexWidth;
    const y1 = y - row.height;
    // console.log('x:', x, ',y:', y, 'left:', left, 'top:', top);
    return x1 > left && x1 < (left + width)
      && y1 > top && y1 < (top + height);
  }

  getSelectedRect() {
    return this.getRect(...this.selectedIndexes);
  }

  getClipboardRect() {
    const { clipboard } = this;
    if (!clipboard.isClear()) {
      const [sIndexes, eIndexes] = clipboard.get();
      return this.getRect(sIndexes, eIndexes);
    }
    return { left: -100, top: -100 };
  }

  getRect([sri, sci], [eri, eci]) {
    const { scroll } = this;
    // const [[sri, sci], [eri, eci]] = selectedIndexes;
    // console.log('sri:', sri, ',sci:', sci, ', eri:', eri, ', eci:', eci);
    // no selector
    if (sri < 0 && sci < 0) {
      return {
        left: 0, l: 0, top: 0, t: 0, scroll,
      };
    }
    const { left, top } = this.cellPosition(sri, sci);
    const height = this.rowSumHeight(sri, eri + 1);
    const width = this.colSumWidth(sci, eci + 1);
    // console.log('sri:', sri, ', sci:', sci, ', eri:', eri, ', eci:', eci);
    let left0 = left - scroll.x;
    let top0 = top - scroll.y;
    const fsh = this.freezeTotalHeight();
    const fsw = this.freezeTotalWidth();
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
      scroll,
    };
  }

  getCellRectByXY(x, y) {
    const { scroll } = this;
    let { ri, top, height } = getCellRowByY.call(this, y, scroll.y);
    let { ci, left, width } = getCellColByX.call(this, x, scroll.x);
    if (ci === -1) {
      width = this.colTotalWidth();
    }
    if (ri === -1) {
      height = this.rowTotalHeight();
    }
    if (ri >= 0 || ci >= 0) {
      inMerges.call(this, ri, ci, ([[sri, sci]]) => {
        ri = sri;
        ci = sci;
        ({
          left, top, width, height,
        } = this.cellRect(sri, sci));
      });
    }
    return {
      ri, ci, left, top, width, height,
    };
  }
  /* for selector end */

  calRangeIndexes2(sIndexes, eIndexes) {
    let [sri, sci] = sIndexes;
    let [eri, eci] = eIndexes;
    if (sri >= eri) {
      [sri, eri] = [eri, sri];
    }
    if (sci >= eci) {
      [sci, eci] = [eci, sci];
    }
    eachMerges.call(this, ([[msri, msci], [meri, meci]]) => {
      // console.log(msri, eri, sri, meri, msci, eci, sci, meci);
      if (msri > eri || sri > meri || msci > eci || sci > meci) {
        // console.log('没有交集');
      } else {
        if (msri < sri) sri = msri;
        if (msci < sci) sci = msci;
        if (meri > eri) eri = meri;
        if (meci > eci) eci = meci;
      }
    });
    this.setSelectedIndexes([sri, sci], [eri, eci]);
    return this.selectedIndexes;
  }

  calRangeIndexes(ri, ci) {
    const sIndexes = [ri, ci];
    const eIndexes = [ri, ci];
    if (ri === -1) {
      sIndexes[0] = 0;
      eIndexes[0] = this.rowLen() - 1;
    }
    if (ci === -1) {
      sIndexes[1] = 0;
      eIndexes[1] = this.colLen() - 1;
    }
    let mIndexes = [sIndexes, eIndexes];
    inMerges.call(this, ri, ci, (merge) => {
      // console.log('merge:', merge);
      mIndexes = merge;
    });
    this.setSelectedIndexes(...mIndexes);
    return mIndexes;
  }

  copy() {
    const [sIndexes, eIndexes] = this.selectedIndexes;
    this.clipboard.copy(sIndexes, eIndexes);
  }

  cut() {
    const [sIndexes, eIndexes] = this.selectedIndexes;
    this.clipboard.cut(sIndexes, eIndexes);
  }

  // what: all | text | format
  paste(what = 'all') {
    // console.log('sIndexes:', sIndexes);
    const { clipboard } = this;
    if (clipboard.isClear()) return;

    const [sIndexes, eIndexes] = this.selectedIndexes;
    addHistory.call(this);
    if (clipboard.isCopy()) {
      copyPaste.call(this, clipboard.get(), [sIndexes, eIndexes], what);
    } else if (clipboard.isCut()) {
      cutPaste.call(this, clipboard.get(), [sIndexes, eIndexes]);
    }
  }

  autofill(sIndexes, eIndexes, what) {
    // console.log('clipboard.get:', this.selectedIndexes);
    addHistory.call(this);
    copyPaste.call(this, this.selectedIndexes, [sIndexes, eIndexes], what, true);
  }

  clearClipboard() {
    this.clipboard.clear();
  }

  merge() {
    const [sIndexes, eIndexes] = this.selectedIndexes;
    const [sri, sci] = sIndexes;
    const [eri, eci] = eIndexes;
    const rn = eri - sri;
    const cn = eci - sci;
    if (rn > 0 || cn > 0) {
      addHistory.call(this);
      const cell = this.getCellOrNew(sri, sci);
      cell.merge = [rn, cn];
      addMerges.call(this, sIndexes, eIndexes);
      // delete merge cells
      deleteCells.call(this);
    }
  }

  deleteCell() {
    addHistory.call(this);
    deleteCells.call(this);
    deleteMerges.call(this, ...this.selectedIndexes);
  }

  insertRow(n = 1) {
    addHistory.call(this);
    const { cellmm, rowm } = this.d;
    const [[sri]] = this.selectedIndexes;
    const ndata = {};
    Object.keys(cellmm).forEach((ri) => {
      let nri = parseInt(ri, 10);
      if (nri >= sri) {
        nri += n;
      }
      ndata[nri] = cellmm[ri];
    });
    this.d.cellmm = ndata;
    rowm.len = this.rowLen() + n;
    modifyMerges.call(this, 'row', sri, n);
  }

  deleteRow() {
    addHistory.call(this);
    const { cellmm, rowm } = this.d;
    const [[sri], [eri]] = this.selectedIndexes;
    // console.log('min:', min, ',max:', max);
    const n = eri - sri + 1;
    const ndata = {};
    Object.keys(cellmm).forEach((ri) => {
      const nri = parseInt(ri, 10);
      if (nri < sri) {
        ndata[nri] = cellmm[nri];
      } else if (ri > eri) {
        ndata[nri - n] = cellmm[nri];
      }
    });
    // console.log('cellmm:', cellmm, ', ndata:', ndata);
    this.d.cellmm = ndata;
    rowm.len = this.rowLen() - n;
    modifyMerges.call(this, 'row', sri, -n);
  }

  insertColumn(n = 1) {
    addHistory.call(this);
    const { cellmm, colm } = this.d;
    const [[, sci]] = this.selectedIndexes;
    Object.keys(cellmm).forEach((ri) => {
      const rndata = {};
      Object.keys(cellmm[ri]).forEach((ci) => {
        let nci = parseInt(ci, 10);
        if (nci >= sci) {
          nci += n;
        }
        rndata[nci] = cellmm[ri][ci];
      });
      cellmm[ri] = rndata;
    });
    colm.len = this.colLen() + n;
    modifyMerges.call(this, 'col', sci, n);
  }

  deleteColumn() {
    addHistory.call(this);
    const { cellmm, colm } = this.d;
    const [[, sci], [, eci]] = this.selectedIndexes;
    const n = eci - sci + 1;
    Object.keys(cellmm).forEach((ri) => {
      const rndata = {};
      Object.keys(cellmm[ri]).forEach((ci) => {
        const nci = parseInt(ci, 10);
        if (nci < sci) {
          rndata[nci] = cellmm[ri][ci];
        } else if (nci > eci) {
          rndata[nci - n] = cellmm[ri][ci];
        }
      });
      cellmm[ri] = rndata;
    });
    colm.len = this.colLen() - n;
    // console.log('n:', n);
    modifyMerges.call(this, 'col', sci, -n);
  }

  scrollx(x, cb) {
    const { scroll } = this;
    const [, fci] = this.getFreeze();
    const [
      ci, left, width,
    ] = helper.rangeReduceIf(fci, this.colLen(), 0, 0, x, i => this.getColWidth(i));
    let x1 = left;
    if (x > 0) x1 += width;
    if (scroll.x !== x1) {
      scroll.indexes[1] = x > 0 ? ci - fci : 0;
      scroll.x = x1;
      cb();
    }
  }

  scrolly(y, cb) {
    const { scroll } = this;
    const [fri] = this.getFreeze();
    const [
      ri, top, height,
    ] = helper.rangeReduceIf(fri, this.rowLen(), 0, 0, y, i => this.getRowHeight(i));
    let y1 = top;
    if (y > 0) y1 += height;
    if (scroll.y !== y1) {
      scroll.indexes[0] = y > 0 ? ri : 0;
      scroll.y = y1;
      cb();
    }
  }

  colTotalWidth() {
    return this.colSumWidth(0, this.colLen());
  }

  rowTotalHeight() {
    return this.rowSumHeight(0, this.rowLen());
  }

  cellRect(ri, ci) {
    const { left, top } = this.cellPosition(ri, ci);
    const cell = this.getCell(ri, ci);
    let width = this.getColWidth(ci);
    let height = this.getRowHeight(ri);
    if (cell !== null) {
      if (cell.merge) {
        const [rn, cn] = cell.merge;
        if (rn > 0) {
          for (let i = 1; i <= rn; i += 1) {
            height += this.getRowHeight(ri + i);
          }
        }
        if (cn > 0) {
          for (let i = 1; i <= cn; i += 1) {
            width += this.getColWidth(ci + i);
          }
        }
      }
    }
    return {
      left, top, width, height, cell,
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
    const cell = this.getCellOrNew(ri, ci);
    cell.text = text;
  }

  // what: all | text | format
  setCell(ri, ci, cell, what = 'all') {
    const { cellmm } = this.d;
    cellmm[ri] = cellmm[ri] || {};
    if (what === 'all') {
      cellmm[ri][ci] = cell;
    } else if (what === 'text') {
      cellmm[ri][ci] = cellmm[ri][ci] || {};
      cellmm[ri][ci].text = cell.text;
    } else if (what === 'format') {
      cellmm[ri][ci] = cellmm[ri][ci] || {};
      cellmm[ri][ci].si = cell.si;
    }
  }

  getCellOrNew(ri, ci) {
    const { cellmm } = this.d;
    cellmm[ri] = cellmm[ri] || {};
    cellmm[ri][ci] = cellmm[ri][ci] || {};
    return cellmm[ri][ci];
  }

  getFreeze() {
    return this.d.freeze;
  }

  setFreeze(ri, ci) {
    addHistory.call(this);
    this.d.freeze[0] = ri;
    this.d.freeze[1] = ci;
  }

  freezeTotalWidth() {
    return this.colSumWidth(0, this.d.freeze[1]);
  }

  freezeTotalHeight() {
    return this.rowSumHeight(0, this.d.freeze[0]);
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
    addHistory.call(this);
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
    addHistory.call(this);
    const { rowm } = this.d;
    rowm[`${index}`] = rowm[`${index}`] || {};
    rowm[`${index}`].height = v;
  }

  getFixedHeaderWidth() {
    return this.options.col.indexWidth;
  }

  getFixedHeaderHeight() {
    return this.options.row.height;
  }

  formats() {
    return Object.values(this.formatm);
  }

  fonts() {
    return Object.values(this.fontm);
  }
}
