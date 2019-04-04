/* global document */

import Selector from './selector';
import Scroll from './scroll';
import History from './history';
import Clipboard from './clipboard';
import { Merges } from './merge';
import helper from './helper';
import { Rows } from './row';
import { Cols } from './col';
import { Validations } from './validation';
import { CellRange } from './cell_range';
import { expr2xy, xy2expr } from './alphabet';

// private methods
/*
 * {
 *  name: ''
 *  freeze: [0, 0],
 *  formats: [],
 *  styles: [
 *    {
 *      bgcolor: '',
 *      align: '',
 *      valign: '',
 *      textwrap: false,
 *      strike: false,
 *      underline: false,
 *      color: '',
 *      format: 1,
 *      border: {
 *        left: [style, color],
 *        right: [style, color],
 *        top: [style, color],
 *        bottom: [style, color],
 *      },
 *      font: {
 *        family: 'Helvetica',
 *        size: 10,
 *        bold: false,
 *        italic: false,
 *      }
 *    }
 *  ],
 *  merges: [
 *    'A1:F11',
 *    ...
 *  ],
 *  rows: {
 *    1: {
 *      height: 50,
 *      style: 1,
 *      cells: {
 *        1: {
 *          style: 2,
 *          type: 'string',
 *          text: '',
 *          value: '', // cal result
 *        }
 *      }
 *    },
 *    ...
 *  },
 *  cols: {
 *    2: { width: 100, style: 1 }
 *  }
 * }
 */
const defaultSettings = {
  view: {
    height: () => document.documentElement.clientHeight,
    width: () => document.documentElement.clientWidth,
  },
  showGrid: true,
  showToolbar: true,
  row: {
    len: 100,
    height: 25,
  },
  col: {
    len: 26,
    width: 100,
    indexWidth: 60,
    minWidth: 60,
  },
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'middle',
    textwrap: false,
    strike: false,
    underline: false,
    color: '#0a0a0a',
    font: {
      name: 'Arial',
      size: 10,
      bold: false,
      italic: false,
    },
  },
};

const toolbarHeight = 41;

function copyPaste(srcCellRange, dstCellRange, what, autofill = false) {
  const { rows, merges } = this;
  // delete dest merge
  if (what === 'all' || what === 'format') {
    rows.deleteCells(dstCellRange, what);
    merges.deleteWithin(dstCellRange);
  }
  rows.copyPaste(srcCellRange, dstCellRange, what, autofill, (ri, ci, cell) => {
    if (cell && cell.merge) {
      // console.log('cell:', ri, ci, cell);
      const [rn, cn] = cell.merge;
      if (rn <= 0 && cn <= 0) return;
      merges.add(new CellRange(ri, ci, ri + rn, ci + cn));
    }
  });
}

function cutPaste(srcCellRange, dstCellRange) {
  const { clipboard, rows, merges } = this;
  rows.cutPaste(srcCellRange, dstCellRange);
  merges.move(srcCellRange,
    dstCellRange.sri - srcCellRange.sri,
    dstCellRange.sci - srcCellRange.sci);
  clipboard.clear();
}

// bss: { top, bottom, left, right }
function setStyleBorder(ri, ci, bss) {
  const { styles, rows } = this;
  const cell = rows.getCellOrNew(ri, ci);
  let cstyle = {};
  if (cell.style !== undefined) {
    cstyle = helper.cloneDeep(styles[cell.style]);
  }
  Object.assign(cstyle, { border: bss });
  cell.style = this.addStyle(cstyle);
}

function setStyleBorders({ mode, style, color }) {
  const { styles, selector, rows } = this;
  const {
    sri, sci, eri, eci,
  } = selector.range;
  const multiple = !this.isSignleSelected();
  if (!multiple) {
    if (mode === 'inside' || mode === 'horizontal' || mode === 'vertical') {
      return;
    }
  }
  if (mode === 'outside' && !multiple) {
    setStyleBorder.call(this, sri, sci, {
      top: [style, color], bottom: [style, color], left: [style, color], right: [style, color],
    });
  } else if (mode === 'none') {
    selector.range.each((ri, ci) => {
      const cell = rows.getCell(ri, ci);
      if (cell && cell.style !== undefined) {
        const ns = helper.cloneDeep(styles[cell.style]);
        delete ns.border;
        // ['bottom', 'top', 'left', 'right'].forEach((prop) => {
        //   if (ns[prop]) delete ns[prop];
        // });
        cell.style = this.addStyle(ns);
      }
    });
  } else if (mode === 'all' || mode === 'inside' || mode === 'outside'
    || mode === 'horizontal' || mode === 'vertical') {
    const merges = [];
    for (let ri = sri; ri <= eri; ri += 1) {
      for (let ci = sci; ci <= eci; ci += 1) {
        // jump merges -- start
        const mergeIndexes = [];
        for (let ii = 0; ii < merges.length; ii += 1) {
          const [mri, mci, rn, cn] = merges[ii];
          if (ri === mri + rn + 1) mergeIndexes.push(ii);
          if (mri <= ri && ri <= mri + rn) {
            if (ci === mci) {
              ci += cn + 1;
              break;
            }
          }
        }
        mergeIndexes.forEach(it => merges.splice(it, 1));
        if (ci > eci) break;
        // jump merges -- end
        const cell = rows.getCell(ri, ci);
        let [rn, cn] = [0, 0];
        if (cell && cell.merge) {
          [rn, cn] = cell.merge;
          merges.push([ri, ci, rn, cn]);
        }
        const mrl = rn > 0 && ri + rn === eri;
        const mcl = cn > 0 && ci + cn === eci;
        let bss = {};
        if (mode === 'all') {
          bss = {
            bottom: [style, color],
            top: [style, color],
            left: [style, color],
            right: [style, color],
          };
        } else if (mode === 'inside') {
          if (!mcl && ci < eci) bss.right = [style, color];
          if (!mrl && ri < eri) bss.bottom = [style, color];
        } else if (mode === 'horizontal') {
          if (!mrl && ri < eri) bss.bottom = [style, color];
        } else if (mode === 'vertical') {
          if (!mcl && ci < eci) bss.right = [style, color];
        } else if (mode === 'outside' && multiple) {
          if (sri === ri) bss.top = [style, color];
          if (mrl || eri === ri) bss.bottom = [style, color];
          if (sci === ci) bss.left = [style, color];
          if (mcl || eci === ci) bss.right = [style, color];
        }
        if (Object.keys(bss).length > 0) {
          setStyleBorder.call(this, ri, ci, bss);
        }
        ci += cn;
      }
    }
  } else if (mode === 'top' || mode === 'bottom') {
    for (let ci = sci; ci <= eci; ci += 1) {
      if (mode === 'top') {
        setStyleBorder.call(this, sri, ci, { top: [style, color] });
        ci += rows.getCellMerge(sri, ci)[1];
      }
      if (mode === 'bottom') {
        setStyleBorder.call(this, eri, ci, { bottom: [style, color] });
        ci += rows.getCellMerge(eri, ci)[1];
      }
    }
  } else if (mode === 'left' || mode === 'right') {
    for (let ri = sri; ri <= eri; ri += 1) {
      if (mode === 'left') {
        setStyleBorder.call(this, ri, sci, { left: [style, color] });
        ri += rows.getCellMerge(ri, sci)[0];
      }
      if (mode === 'right') {
        setStyleBorder.call(this, ri, eci, { right: [style, color] });
        ri += rows.getCellMerge(ri, eci)[0];
      }
    }
  }
}

function getCellRowByY(y, scrollOffsety) {
  const { rows } = this;
  const fsh = this.freezeTotalHeight();
  // console.log('y:', y, ', fsh:', fsh);
  let inits = rows.height;
  if (fsh + rows.height < y) inits -= scrollOffsety;
  const [ri, top, height] = helper.rangeReduceIf(
    0,
    rows.len,
    inits,
    rows.height,
    y,
    i => rows.getHeight(i),
  );
  if (top <= 0) {
    return { ri: -1, top: 0, height };
  }
  return { ri: ri - 1, top, height };
}

function getCellColByX(x, scrollOffsetx) {
  const { cols } = this;
  const fsw = this.freezeTotalWidth();
  let inits = cols.indexWidth;
  if (fsw + cols.indexWidth < x) inits -= scrollOffsetx;
  const [ci, left, width] = helper.rangeReduceIf(
    0,
    cols.len,
    inits,
    cols.indexWidth,
    x,
    i => cols.getWidth(i),
  );
  if (left <= 0) {
    return { ci: -1, left: 0, width: cols.indexWidth };
  }
  return { ci: ci - 1, left, width };
}

export default class DataProxy {
  constructor(name, settings) {
    this.settings = helper.merge(defaultSettings, settings || {});
    // save data begin
    this.name = name || 'sheet';
    this.freeze = [0, 0];
    this.styles = []; // Array<Style>
    this.merges = new Merges(); // [CellRange, ...]
    this.rows = new Rows(this.settings.row);
    this.cols = new Cols(this.settings.col);
    this.validations = new Validations();
    this.hyperlinks = {};
    this.comments = {};
    // save data end

    // don't save object
    this.selector = new Selector();
    this.scroll = new Scroll();
    this.history = new History();
    this.clipboard = new Clipboard();
    this.change = () => {};
  }

  addValidation(mode, ref, validator) {
    // console.log('mode:', mode, ', ref:', ref, ', validator:', validator);
    this.changeData(() => {
      this.validations.add(mode, ref, validator);
    });
  }

  removeValidation() {
    const { range } = this.selector;
    this.changeData(() => {
      this.validations.remove(range);
    });
  }

  getSelectedValidator() {
    const { ri, ci } = this.selector;
    const v = this.validations.get(ri, ci);
    return v ? v.validator : null;
  }

  getSelectedValidation() {
    const { ri, ci, range } = this.selector;
    const v = this.validations.get(ri, ci);
    const ret = { ref: range.toString() };
    if (v !== null) {
      ret.mode = v.mode;
      ret.validator = v.validator;
    }
    return ret;
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
  }

  undo() {
    this.history.undo(this.getData(), (d) => {
      this.setData(d);
    });
  }

  redo() {
    this.history.redo(this.getData(), (d) => {
      this.setData(d);
    });
  }

  copy() {
    this.clipboard.copy(this.selector.range);
  }

  cut() {
    this.clipboard.cut(this.selector.range);
  }

  // what: all | text | format
  paste(what = 'all') {
    // console.log('sIndexes:', sIndexes);
    const { clipboard, selector } = this;
    if (clipboard.isClear()) return;

    this.changeData(() => {
      if (clipboard.isCopy()) {
        copyPaste.call(this, clipboard.range, selector.range, what);
      } else if (clipboard.isCut()) {
        cutPaste.call(this, clipboard.range, selector.range);
      }
    });
  }

  autofill(cellRange, what) {
    this.changeData(() => {
      copyPaste.call(this, this.selector.range, cellRange, what, true);
    });
  }

  clearClipboard() {
    this.clipboard.clear();
  }

  calSelectedRangeByEnd(ri, ci) {
    const {
      selector, rows, cols, merges,
    } = this;
    let {
      sri, sci, eri, eci,
    } = selector.range;
    const cri = selector.ri;
    const cci = selector.ci;
    let [nri, nci] = [ri, ci];
    if (ri < 0) nri = rows.len - 1;
    if (ci < 0) nci = cols.len - 1;
    // row index
    if (nri <= cri) [sri, eri] = [nri, cri];
    else eri = nri;
    // col index
    if (nci <= cci) [sci, eci] = [nci, cci];
    else eci = nci;
    selector.range = merges.union(new CellRange(
      sri, sci, eri, eci,
    ));
    // console.log('selector.range:', selector.range);
    return selector.range;
  }

  calSelectedRangeByStart(ri, ci) {
    const {
      selector, rows, cols, merges,
    } = this;
    let cellRange = merges.getFirstIncludes(ri, ci);
    // console.log('cellRange:', cellRange, ri, ci, merges);
    if (cellRange === null) {
      cellRange = new CellRange(ri, ci, ri, ci);
      if (ri === -1) {
        cellRange.sri = 0;
        cellRange.eri = rows.len - 1;
      }
      if (ci === -1) {
        cellRange.sci = 0;
        cellRange.eci = cols.len - 1;
      }
    }
    selector.range = cellRange;
    return cellRange;
  }

  setSelectedCellAttr(property, value) {
    this.changeData(() => {
      const { selector, styles, rows } = this;
      if (property === 'merge') {
        if (value) this.merge();
        else this.unmerge();
      } else if (property === 'border') {
        setStyleBorders.call(this, value);
      } else if (property === 'formula') {
        const cell = rows.getCellOrNew(selector.ri, selector.ci);
        cell.text = `=${value}()`;
      } else {
        selector.range.each((ri, ci) => {
          const cell = rows.getCellOrNew(ri, ci);
          let cstyle = {};
          if (cell.style !== undefined) {
            cstyle = helper.cloneDeep(styles[cell.style]);
          }
          if (property === 'format') {
            cstyle.format = value;
            cell.style = this.addStyle(cstyle);
          } else if (property === 'font-bold' || property === 'font-italic'
            || property === 'font-name' || property === 'font-size') {
            const nfont = {};
            nfont[property.split('-')[1]] = value;
            cstyle.font = Object.assign(cstyle.font || {}, nfont);
            cell.style = this.addStyle(cstyle);
          } else if (property === 'strike' || property === 'textwrap'
            || property === 'underline'
            || property === 'align' || property === 'valign'
            || property === 'color' || property === 'bgcolor') {
            cstyle[property] = value;
            cell.style = this.addStyle(cstyle);
          }
        });
      }
    });
  }

  // state: input | finished
  setSelectedCellText(text, state = 'input') {
    const { ri, ci } = this.selector;
    this.setCellText(ri, ci, text, state);
  }

  getSelectedCell() {
    const { ri, ci } = this.selector;
    return this.rows.getCell(ri, ci);
  }

  xyInSelectedRect(x, y) {
    const {
      left, top, width, height,
    } = this.getSelectedRect();
    const x1 = x - this.cols.indexWidth;
    const y1 = y - this.rows.height;
    // console.log('x:', x, ',y:', y, 'left:', left, 'top:', top);
    return x1 > left && x1 < (left + width)
      && y1 > top && y1 < (top + height);
  }

  getSelectedRect() {
    return this.getRect(this.selector.range);
  }

  getClipboardRect() {
    const { clipboard } = this;
    if (!clipboard.isClear()) {
      return this.getRect(clipboard.range);
    }
    return { left: -100, top: -100 };
  }

  getRect(cellRange) {
    const { scroll, rows, cols } = this;
    const {
      sri, sci, eri, eci,
    } = cellRange;
    // console.log('sri:', sri, ',sci:', sci, ', eri:', eri, ', eci:', eci);
    // no selector
    if (sri < 0 && sci < 0) {
      return {
        left: 0, l: 0, top: 0, t: 0, scroll,
      };
    }
    const { left, top } = this.cellPosition(sri, sci);
    const height = rows.sumHeight(sri, eri + 1);
    const width = cols.sumWidth(sci, eci + 1);
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
    const {
      scroll, merges, rows, cols,
    } = this;
    let { ri, top, height } = getCellRowByY.call(this, y, scroll.y);
    let { ci, left, width } = getCellColByX.call(this, x, scroll.x);
    if (ci === -1) {
      width = cols.totalWidth();
    }
    if (ri === -1) {
      height = rows.totalHeight();
    }
    if (ri >= 0 || ci >= 0) {
      const merge = merges.getFirstIncludes(ri, ci);
      if (merge) {
        ri = merge.sri;
        ci = merge.sci;
        ({
          left, top, width, height,
        } = this.cellRect(ri, ci));
      }
    }
    return {
      ri, ci, left, top, width, height,
    };
  }

  isSignleSelected() {
    const {
      sri, sci, eri, eci,
    } = this.selector.range;
    const cell = this.getCell(sri, sci);
    if (cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (sri + rn === eri && sci + cn === eci) return true;
    }
    return !this.selector.multiple();
  }

  canUnmerge() {
    const {
      sri, sci, eri, eci,
    } = this.selector.range;
    const cell = this.getCell(sri, sci);
    if (cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (sri + rn === eri && sci + cn === eci) return true;
    }
    return false;
  }

  merge() {
    const { selector, rows } = this;
    if (this.isSignleSelected()) return;
    const [rn, cn] = selector.size();
    // console.log('merge:', rn, cn);
    if (rn > 1 || cn > 1) {
      const { sri, sci } = selector.range;
      this.changeData(() => {
        const cell = rows.getCellOrNew(sri, sci);
        cell.merge = [rn - 1, cn - 1];
        this.merges.add(selector.range);
        // delete merge cells
        this.rows.deleteCells(selector.range);
        // console.log('cell:', cell, this.d);
        this.rows.setCell(sri, sci, cell);
      });
    }
  }

  unmerge() {
    const { selector } = this;
    if (!this.isSignleSelected()) return;
    const { sri, sci } = selector.range;
    this.changeData(() => {
      this.rows.deleteCell(sri, sci, 'merge');
      this.merges.deleteWithin(selector.range);
    });
  }

  deleteCell(what = 'all') {
    const { selector } = this;
    this.changeData(() => {
      this.rows.deleteCells(selector.range, what);
      if (what === 'all' || what === 'format') {
        this.merges.deleteWithin(selector.range);
      }
    });
  }

  // type: row | column
  insert(type, n = 1) {
    this.changeData(() => {
      const { sri, sci } = this.selector.range;
      const { rows, merges, cols } = this;
      let si = sri;
      if (type === 'row') {
        rows.insert(sri, n);
      } else if (type === 'column') {
        rows.insertColumn(sci, n);
        si = sci;
        cols.len += 1;
      }
      merges.shift(type, si, n, (ri, ci, rn, cn) => {
        const cell = rows.getCell(ri, ci);
        cell.merge[0] += rn;
        cell.merge[1] += cn;
      });
    });
  }

  // type: row | column
  delete(type) {
    this.changeData(() => {
      const {
        rows, merges, selector, cols,
      } = this;
      const { range } = selector;
      const {
        sri, sci, eri, eci,
      } = selector.range;
      const [rsize, csize] = selector.range.size();
      let si = sri;
      let size = rsize;
      if (type === 'row') {
        rows.delete(sri, eri);
      } else if (type === 'column') {
        rows.deleteColumn(sci, eci);
        si = range.sci;
        size = csize;
        cols.len -= 1;
      }
      // console.log('type:', type, ', si:', si, ', size:', size);
      merges.shift(type, si, -size, (ri, ci, rn, cn) => {
        // console.log('ri:', ri, ', ci:', ci, ', rn:', rn, ', cn:', cn);
        const cell = rows.getCell(ri, ci);
        cell.merge[0] += rn;
        cell.merge[1] += cn;
        if (cell.merge[0] === 0 && cell.merge[1] === 0) {
          delete cell.merge;
        }
      });
    });
  }

  scrollx(x, cb) {
    const { scroll, freeze, cols } = this;
    const [, fci] = freeze;
    const [
      ci, left, width,
    ] = helper.rangeReduceIf(fci, cols.len, 0, 0, x, i => cols.getWidth(i));
    // console.log('fci:', fci, ', ci:', ci);
    let x1 = left;
    if (x > 0) x1 += width;
    if (scroll.x !== x1) {
      scroll.ci = x > 0 ? ci - fci : 0;
      scroll.x = x1;
      cb();
    }
  }

  scrolly(y, cb) {
    const { scroll, freeze, rows } = this;
    const [fri] = freeze;
    const [
      ri, top, height,
    ] = helper.rangeReduceIf(fri, rows.len, 0, 0, y, i => rows.getHeight(i));
    let y1 = top;
    if (y > 0) y1 += height;
    if (scroll.y !== y1) {
      scroll.ri = y > 0 ? ri - fri : 0;
      scroll.y = y1;
      cb();
    }
  }

  cellRect(ri, ci) {
    const { rows, cols } = this;
    const { left, top } = this.cellPosition(ri, ci);
    const cell = rows.getCell(ri, ci);
    let width = cols.getWidth(ci);
    let height = rows.getHeight(ri);
    if (cell !== null) {
      if (cell.merge) {
        const [rn, cn] = cell.merge;
        // console.log('cell.merge:', cell.merge);
        if (rn > 0) {
          for (let i = 1; i <= rn; i += 1) {
            height += rows.getHeight(ri + i);
          }
        }
        if (cn > 0) {
          for (let i = 1; i <= cn; i += 1) {
            width += cols.getWidth(ci + i);
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
    const { cols, rows } = this;
    const left = cols.sumWidth(0, ci);
    const top = rows.sumHeight(0, ri);
    return {
      left, top,
    };
  }

  getCell(ri, ci) {
    return this.rows.getCell(ri, ci);
  }

  getCellTextOrDefault(ri, ci) {
    const cell = this.getCell(ri, ci);
    return (cell && cell.text) ? cell.text : '';
  }

  getCellStyle(ri, ci) {
    const cell = this.getCell(ri, ci);
    if (cell && cell.style !== undefined) {
      return this.styles[cell.style];
    }
    return null;
  }

  getCellStyleOrDefault(ri, ci) {
    const { styles, rows } = this;
    const cell = rows.getCell(ri, ci);
    const cellStyle = (cell && cell.style !== undefined) ? styles[cell.style] : {};
    return helper.merge(this.defaultStyle(), cellStyle);
  }

  getSelectedCellStyle() {
    const { ri, ci } = this.selector;
    return this.getCellStyleOrDefault(ri, ci);
  }

  // state: input | finished
  setCellText(ri, ci, text, state) {
    const { rows, history, validations } = this;
    if (state === 'finished') {
      rows.setCellText(ri, ci, '');
      history.add(this.getData());
      rows.setCellText(ri, ci, text);
      // validator
      validations.validate(ri, ci, text);
    } else {
      rows.setCellText(ri, ci, text);
      this.change(this.getData());
    }
  }

  freezeIsActive() {
    const [ri, ci] = this.freeze;
    return ri > 0 || ci > 0;
  }

  setFreeze(ri, ci) {
    this.changeData(() => {
      this.freeze = [ri, ci];
    });
  }

  freezeTotalWidth() {
    return this.cols.sumWidth(0, this.freeze[1]);
  }

  freezeTotalHeight() {
    return this.rows.sumHeight(0, this.freeze[0]);
  }

  setRowHeight(ri, height) {
    this.changeData(() => {
      this.rows.setHeight(ri, height);
    });
  }

  setColWidth(ci, width) {
    this.changeData(() => {
      this.cols.setWidth(ci, width);
    });
  }

  viewHeight() {
    const { view, showToolbar } = this.settings;
    let h = view.height();
    if (showToolbar) {
      h -= toolbarHeight;
    }
    return h;
  }

  viewWidth() {
    return this.settings.view.width();
  }

  freezeViewRange() {
    const [ri, ci] = this.freeze;
    return new CellRange(0, 0, ri - 1, ci - 1);
  }

  viewRange() {
    const { scroll, rows, cols } = this;
    const { ri, ci } = scroll;
    let [x, y] = [0, 0];
    let [eri, eci] = [rows.len, cols.len];
    for (let i = ri; i < rows.len; i += 1) {
      y += rows.getHeight(i);
      eri = i;
      if (y > this.viewHeight()) break;
    }
    for (let j = ci; j < cols.len; j += 1) {
      x += cols.getWidth(j);
      eci = j;
      if (x > this.viewWidth()) break;
    }
    // console.log(ri, ci, eri, eci);
    return new CellRange(ri, ci, eri, eci);
  }

  eachMergesInView(viewRange, cb) {
    this.merges.filterIntersects(viewRange)
      .forEach(it => cb(it));
  }

  rowEach(min, max, cb) {
    let y = 0;
    const { rows } = this;
    // console.log('min:', min, ', max:', max, ', scroll:', scroll);
    for (let i = min; i <= max; i += 1) {
      const rowHeight = rows.getHeight(i);
      cb(i, y, rowHeight);
      y += rowHeight;
      if (y > this.viewHeight()) break;
    }
  }

  colEach(min, max, cb) {
    let x = 0;
    const { cols } = this;
    for (let i = min; i <= max; i += 1) {
      const colWidth = cols.getWidth(i);
      cb(i, x, colWidth);
      x += colWidth;
      if (x > this.viewWidth()) break;
    }
  }

  defaultStyle() {
    return this.settings.style;
  }

  addStyle(nstyle) {
    const { styles } = this;
    // console.log('old.styles:', styles, nstyle);
    for (let i = 0; i < styles.length; i += 1) {
      const style = styles[i];
      if (helper.equals(style, nstyle)) return i;
    }
    styles.push(nstyle);
    return styles.length - 1;
  }

  changeData(cb) {
    this.history.add(this.getData());
    cb();
    this.change(this.getData());
  }

  setData(d) {
    Object.keys(d).forEach((property) => {
      if (property === 'merges' || property === 'rows'
        || property === 'cols' || property === 'validations') {
        this[property].setData(d[property]);
      } else if (property === 'freeze') {
        const [x, y] = expr2xy(d[property]);
        this.freeze = [y, x];
      } else if (d[property] !== undefined) {
        this[property] = d[property];
      }
    });
    return this;
  }

  getData() {
    const {
      name, freeze, styles, merges, rows, cols, validations,
    } = this;
    return {
      name,
      freeze: xy2expr(freeze[1], freeze[0]),
      styles,
      merges: merges.getData(),
      rows: rows.getData(),
      cols: cols.getData(),
      validations: validations.getData(),
    };
  }
}
