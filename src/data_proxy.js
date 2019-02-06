/* eslint no-new-wrappers: "error" */
import helper from './helper';
import Language from './language/language';
import { formulas as _formulas } from './formula';
import { formats as _formats } from './format';
import { fonts as _fonts } from './font';
import { expr2expr } from './cell';

/*
Cell: {
  text: string,
  merge: [rowLen, colLen],
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

class Selector {
  constructor() {
    this.indexes = [0, 0];
    this.sIndexes = [-1, -1];
    this.eIndexes = [-1, -1];
  }

  getRange() {
    return [this.sIndexes, this.eIndexes];
  }

  setRange(sIndexes, eIndexes) {
    this.sIndexes = sIndexes;
    this.eIndexes = eIndexes;
  }

  seqe() {
    const [sri, sci] = this.sIndexes;
    const [eri, eci] = this.eIndexes;
    return sri === eri && sci === eci;
  }

  each(cb) {
    const [sri, sci] = this.sIndexes;
    const [eri, eci] = this.eIndexes;
    for (let i = sri; i <= eri; i += 1) {
      for (let j = sci; j <= eci; j += 1) {
        cb(i, j);
      }
    }
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

// what: all | text | format
function deleteCells([sri, sci], [eri, eci], what = 'all') {
  const { d } = this;
  const { cellmm } = d;
  // console.log('cellmm:', cellmm, ', sri:', sri, ', sci:', sci, ', eri:', eri, ', eci:', eci);
  for (let i = sri; i <= eri; i += 1) {
    for (let j = sci; j <= eci; j += 1) {
      const cell = this.getCell(i, j);
      if (cell) {
        if (what === 'all') {
          delete cellmm[i][`${j}`];
        } else if (what === 'text') {
          if (cell.text) delete cell.text;
        } else if (what === 'format') {
          if (cell.si !== undefined) delete cell.si;
          if (cell.merge) delete cell.merge;
        }
      }
    }
  }
  /*
  Object.keys(cellmm).forEach((ri) => {
    // console.log('ri:', ri, ', sri:', sri, ', eri:', eri);
    if (ri >= sri && ri <= eri) {
      Object.keys(cellmm[ri]).forEach((ci) => {
        const cell = cellmm[ri][ci];
        // console.log('cell:', ci, cell);
        if (ci >= sci && ci <= eci) {
          if (what === 'all') {
            // console.log(':row:', cellm[ri]);
            delete cellmm[ri][`${ci}`];
            // console.log(':after.row:', cellm[ri]);
          } else if (what === 'text') {
            if (cell.text) delete cell.text;
          } else if (what === 'format') {
            if (cell.si !== undefined) delete cell.si;
            if (cell.merge) delete cell.si;
          }
        }
      });
    }
  });
  */
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
  deleteMerges.call(this, sIndexes, eIndexes);
  this.d.merges.push([sIndexes, eIndexes]);
}

function addMergesByCellIndexes(ri, ci) {
  const cell = this.getCell(ri, ci);
  if (cell && cell.merge) {
    // console.log('cell:', ri, ci, cell);
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
  // delete dest merge
  if (what === 'all' || what === 'format') {
    deleteCells.call(this, [dsri, dsci], [deri, deci], what);
    deleteMerges.call(this, [dsri, dsci], [deri, deci]);
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
              // console.log('ncell:', nri, nci, ncell);
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

function setStyleBorder(style, [ri, ci], mode, v) {
  const s = style;
  const [[sri, sci], [eri, eci]] = this.selector.getRange();
  // console.log('mode:', mode);
  if (mode === 'all') {
    s.bbi = v;
    s.bti = v;
    s.bri = v;
    s.bli = v;
  } else if (mode === 'inside') {
    if (this.isMultiple()) {
      if (eri !== ri) s.bbi = v;
      if (sri !== ri) s.bti = v;
      if (eci !== ci) s.bri = v;
      if (sci !== ci) s.bli = v;
    }
  } else if (mode === 'horizontal') {
    if (this.isMultiple()) {
      if (eri !== ri) s.bbi = v;
      if (sri !== ri) s.bti = v;
    }
  } else if (mode === 'vertical') {
    if (this.isMultiple()) {
      if (eci !== ci) s.bri = v;
      if (sci !== ci) s.bli = v;
    }
  } else if (mode === 'outside') {
    if (sri === ri) s.bti = v;
    if (eri === ri) s.bbi = v;
    if (sci === ci) s.bli = v;
    if (eci === ci) s.bri = v;
  } else if (mode === 'left') {
    if (sci === ci) s.bli = v;
  } else if (mode === 'top') {
    if (sri === ri) s.bti = v;
  } else if (mode === 'right') {
    if (eci === ci) s.bri = v;
  } else if (mode === 'bottom') {
    if (eri === ri) s.bbi = v;
  } else if (mode === 'none') {
    if (s.bli !== undefined) delete s.bli;
    if (s.bti !== undefined) delete s.bti;
    if (s.bri !== undefined) delete s.bri;
    if (s.bbi !== undefined) delete s.bbi;
  }
}

export default class DataProxy {
  constructor(options) {
    this.options = options;
    this.language = new Language(options.language);
    this.formulam = _formulas(options.formulas);
    this.formatm = _formats(options.formats);
    this.fontm = _fonts(options.fonts);
    this.d = defaultData;
    this.clipboard = new Clipboard();
    this.history = new History();
    this.scroll = new Scroll();
    this.selector = new Selector();
    this.change = () => {};
  }

  getView() {
    return this.options.view;
  }

  load(data) {
    this.d = helper.merge(defaultData, data);
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
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
  isMultiple() {
    const [[sri, sci], [eri, eci]] = this.selector.getRange();
    if (sri === eri && sci === eci) return false;
    const cell = this.getCell(sri, sci);
    if (cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (sri + rn === eri && sci + cn === eci) return false;
    }
    return true;
  }

  setSelectedIndexes(sIndexes, eIndexes) {
    this.selector.setRange(sIndexes, eIndexes);
  }

  setSelectedCurrentIndexes(indexes) {
    this.selector.indexes = indexes;
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

  getSelectedCellStyle() {
    return this.getCellStyle(...this.selector.indexes);
  }

  getSelectedCellOrNew() {
    return this.getCellOrNew(...this.selector.indexes);
  }

  getSelectedCell() {
    return this.getCell(...this.selector.indexes);
  }

  setSelectedCellText(text) {
    this.setCellText(...this.selector.indexes, text);
  }

  getSelectedRect() {
    return this.getRect(...this.selector.getRange());
  }

  setSelectedCellAttr(property, value) {
    addHistory.call(this);
    const { selector } = this;
    const { styles } = this.d;
    if (property === 'merge') {
      if (value) this.merge();
      else this.unmerge();
    } else if (property === 'formula') {
      const cell = this.getCellOrNew(...selector.indexes);
      cell.text = `=${value}()`;
    } else {
      selector.each((ri, ci) => {
        const cell = this.getCellOrNew(ri, ci);
        let cstyle = {};
        if (cell.si !== undefined) {
          cstyle = helper.cloneDeep(styles[cell.si]);
        }
        if (property === 'format') {
          cell.format = value;
        } else if (property === 'border') {
          // const { mode, style, color } = value;
          const bi = this.addBorder(value.style, value.color);
          setStyleBorder.call(this, cstyle, [ri, ci], value.mode, bi);
          // console.log('border.cstyle:', value.mode, cstyle);
          cell.si = this.addStyle(cstyle);
        } else if (property === 'font-bold' || property === 'font-italic'
          || property === 'font-name' || property === 'font-size') {
          const nfont = {};
          nfont[property.split('-')[1]] = value;
          cstyle.font = Object.assign(cstyle.font || {}, nfont);
          cell.si = this.addStyle(cstyle);
        } else if (property === 'strikethrough' || property === 'textwrap'
          || property === 'align' || property === 'valign'
          || property === 'color' || property === 'bgcolor') {
          cstyle[property] = value;
          cell.si = this.addStyle(cstyle);
        }
      });
    }
    this.change(this.d);
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
    return this.selector.getRange();
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
    const { sIndexes, eIndexes } = this.selector;
    this.clipboard.copy(sIndexes, eIndexes);
  }

  cut() {
    const { sIndexes, eIndexes } = this.selector;
    this.clipboard.cut(sIndexes, eIndexes);
  }

  // what: all | text | format
  paste(what = 'all') {
    // console.log('sIndexes:', sIndexes);
    const { clipboard } = this;
    if (clipboard.isClear()) return;

    const { sIndexes, eIndexes } = this.selector;
    addHistory.call(this);
    if (clipboard.isCopy()) {
      copyPaste.call(this, clipboard.get(), [sIndexes, eIndexes], what);
    } else if (clipboard.isCut()) {
      cutPaste.call(this, clipboard.get(), [sIndexes, eIndexes]);
    }
    this.change(this.d);
  }

  autofill(sIndexes, eIndexes, what) {
    addHistory.call(this);
    copyPaste.call(this, this.selector.getRange(), [sIndexes, eIndexes], what, true);
    this.change(this.d);
  }

  clearClipboard() {
    this.clipboard.clear();
  }

  /* merge methods start */
  eachMerges(cb) {
    eachMerges.call(this, cb);
  }

  canUnmerge() {
    const [[sri, sci], [eri, eci]] = this.selector.getRange();
    const cell = this.getCell(sri, sci);
    if (cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (sri + rn === eri && sci + cn === eci) return true;
    }
    return false;
  }

  merge() {
    if (!this.isMultiple()) return;
    const { sIndexes, eIndexes } = this.selector;
    const [sri, sci] = sIndexes;
    const [eri, eci] = eIndexes;
    const rn = eri - sri;
    const cn = eci - sci;
    // console.log('merge:', rn, cn);
    if (rn > 0 || cn > 0) {
      addHistory.call(this);
      const cell = this.getCellOrNew(sri, sci);
      cell.merge = [rn, cn];
      addMerges.call(this, sIndexes, eIndexes);
      // delete merge cells
      deleteCells.call(this, sIndexes, eIndexes);
      // console.log('cell:', cell, this.d);
      this.setCell(sri, sci, cell, 'all');
      this.change(this.d);
    }
  }

  unmerge() {
    if (!this.canUnmerge()) return;
    addHistory.call(this);
    const { sIndexes, eIndexes } = this.selector;
    const cell = this.getCell(...sIndexes);
    delete cell.merge;
    deleteMerges.call(this, sIndexes, eIndexes);
    this.change(this.d);
  }
  /* merge methods end */

  deleteCell(what = 'all') {
    const { sIndexes, eIndexes } = this.selector;
    addHistory.call(this);
    deleteCells.call(this, sIndexes, eIndexes, what);
    if (what === 'all' || what === 'format') {
      deleteMerges.call(this, sIndexes, eIndexes);
    }
    this.change(this.d);
  }

  insertRow(n = 1) {
    addHistory.call(this);
    const { cellmm, rowm } = this.d;
    const [sri] = this.selector.sIndexes;
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
    this.change(this.d);
  }

  deleteRow() {
    addHistory.call(this);
    const { cellmm, rowm } = this.d;
    const [[sri], [eri]] = this.selector.getRange();
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
    this.change(this.d);
  }

  insertColumn(n = 1) {
    addHistory.call(this);
    const { cellmm, colm } = this.d;
    const [, sci] = this.selector.sIndexes;
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
    this.change(this.d);
  }

  deleteColumn() {
    addHistory.call(this);
    const { cellmm, colm } = this.d;
    const [[, sci], [, eci]] = this.selector.getRange();
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
    this.change(this.d);
  }

  scrollx(x, cb) {
    const { scroll } = this;
    const [, fci] = this.getFreeze();
    const [
      ci, left, width,
    ] = helper.rangeReduceIf(fci, this.colLen(), 0, 0, x, i => this.getColWidth(i));
    // console.log('fci:', fci, ', ci:', ci);
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
      scroll.indexes[0] = y > 0 ? ri - fri : 0;
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
        // console.log('cell.merge:', cell.merge);
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
    // console.log('data:', this.d);
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
    return helper.merge(this.options.style, (cell && cell.si !== undefined) ? styles[cell.si] : {});
  }

  setCellText(ri, ci, text) {
    addHistory.call(this);
    const cell = this.getCellOrNew(ri, ci);
    cell.text = text;
    this.change(this.d);
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
      if (cell.merge) cellmm[ri][ci].merge = cell.merge;
    }
  }

  getCellOrNew(ri, ci) {
    const { cellmm } = this.d;
    cellmm[ri] = cellmm[ri] || {};
    cellmm[ri][ci] = cellmm[ri][ci] || {};
    // console.log('ri:', ri, ', ci:', ci, cellmm);
    return cellmm[ri][ci];
  }

  getFreeze() {
    return this.d.freeze;
  }

  freezeIsActive() {
    const [ri, ci] = this.d.freeze;
    return ri > 0 || ci > 0;
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

  rowEach(min, max, cb) {
    let y = 0;
    const { view } = this.options;
    // console.log('min:', min, ', max:', max, ', scroll:', scroll);
    for (let i = min; i <= max; i += 1) {
      const rowHeight = this.getRowHeight(i);
      cb(i, y, rowHeight);
      y += rowHeight;
      if (y > view.height()) break;
    }
  }

  colEach(min, max, cb) {
    let x = 0;
    const { view } = this.options;
    for (let i = min; i <= max; i += 1) {
      const colWidth = this.getColWidth(i);
      cb(i, x, colWidth);
      x += colWidth;
      if (x > view.width()) break;
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
    this.change(this.d);
  }

  getRowHeight(index) {
    const { rowm } = this.d;
    const { row } = this.options;
    // console.log('rowm.index:', rowm[index], rowm[`${index}`]);
    return rowm[`${index}`] ? rowm[`${index}`].height : row.height;
  }

  setRowHeight(index, v) {
    addHistory.call(this);
    const { rowm } = this.d;
    rowm[`${index}`] = rowm[`${index}`] || {};
    rowm[`${index}`].height = v;
    this.change(this.d);
  }

  getFixedHeaderWidth() {
    return this.options.col.indexWidth;
  }

  getFixedHeaderHeight() {
    return this.options.row.height;
  }

  eachCells(cb) {
    const { cellmm } = this.d;
    // console.log('celmm:', cellmm);
    Object.keys(cellmm).forEach((ri) => {
      Object.keys(cellmm[ri]).forEach((ci) => {
        cb(this.getCell(ri, ci), parseInt(ri, 10), parseInt(ci, 10));
      });
    });
  }

  eachCellsInView(rowStart, rowLen, colStart, colLen, jumpMerge = true, cb) {
    const cmerges = [];
    const { view } = this.options;
    let [x, y] = [0, 0];
    for (let i = rowStart; i < rowLen; i += 1) {
      y += this.getRowHeight(i);
      x = 0;
      for (let j = colStart; j < colLen; j += 1) {
        x += this.getColWidth(j);
        if (jumpMerge) {
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
        }
        const cell = this.getCell(i, j);
        cb(cell, i, j);
        // renderCell.call(this, i, j);
        // console.log('cmerges:', cmerges);
        if (jumpMerge && cell && cell.merge) {
          const [rn, cn] = cell.merge;
          // console.log('rn:', rn, ', cn:', cn);
          cmerges.push([i, j, rn, cn]);
          j += cn;
        }
        if (x > view.width()) break;
      }
      if (y > view.height()) break;
    }
  }

  addBorder(style, color) {
    const { borders } = this.d;
    for (let i = 0; i < borders.length; i += 1) {
      const [s, c] = borders[i];
      if (s === style && c === color) {
        return i;
      }
    }
    borders.push([style, color]);
    return borders.length - 1;
  }

  addStyle(nstyle) {
    const { styles } = this.d;
    // console.log('old.styles:', styles, nstyle);
    for (let i = 0; i < styles.length; i += 1) {
      const style = styles[i];
      if (helper.equals(style, nstyle)) return i;
    }
    styles.push(nstyle);
    return styles.length - 1;
  }

  getStyle(index) {
    return this.d.styles[index];
  }

  getBorder(index) {
    return this.d.borders[index];
  }
}
