/* global window */
/* eslint-env browser */
import { h } from './element';
import {
  bind,
  mouseMoveUp,
  bindTouch,
  createEventEmitter,
  unbind,
} from './event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';
import Print from './print';
import ContextMenu from './contextmenu';
import Table from './table';
import Toolbar from './toolbar/index';
import ModalValidation from './modal_validation';
import ModalFind from './modal_search';
import SortFilter from './sort_filter';
import { xtoast } from './message';
import { cssPrefix } from '../config';
import { formulas } from '../core/formula';

/**
 * @desc throttle fn
 * @param func function
 * @param wait Delay in milliseconds
 */
function throttle(func, wait) {
  let timeout;
  return (...arg) => {
    const that = this;
    const args = arg;
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        func.apply(that, args);
      }, wait);
    }
  };
}

function scrollbarMove() {
  const {
    data, verticalScrollbar, horizontalScrollbar,
  } = this;
  const {
    l, t, left, top, width, height,
  } = data.getSelectedRect();
  const tableOffset = this.getTableOffset();
  // console.log(',l:', l, ', left:', left, ', tOffset.left:', tableOffset.width);
  if (Math.abs(left) + width > tableOffset.width) {
    horizontalScrollbar.move({ left: l + width - tableOffset.width });
  } else {
    const fsw = data.freezeTotalWidth();
    if (left < fsw) {
      horizontalScrollbar.move({ left: l - 1 - fsw });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (Math.abs(top) + height > tableOffset.height) {
    verticalScrollbar.move({ top: t + height - tableOffset.height - 1 });
  } else {
    const fsh = data.freezeTotalHeight();
    if (top < fsh) {
      verticalScrollbar.move({ top: t - 1 - fsh });
    }
  }
}

function selectorSet(multiple, ri, ci, indexesUpdated = true, moving = false) {
  // console.log('selectorSet:', { ri, ci, indexesUpdated, moving, multiple });
  if (ri === -1 && ci === -1) return;
  const {
    table, selector, toolbar, data,
    contextMenu,
  } = this;
  const cell = data.getCell(ri, ci);
  if (multiple) {
    selector.setEnd(ri, ci, moving);
    this.trigger('cells-selected', cell, selector.range);
  } else {
    // trigger click event
    selector.set(ri, ci, indexesUpdated);
    this.trigger('cell-selected', cell, ri, ci);
  }
  const {
    sri, eri, sci, eci,
  } = selector.range;

  let mode = 'range-single';

  if (sri !== eri && sci !== eci) {
    mode = 'range-multiple';
  }

  if (ri === -1 || (sci === eci && sri !== eri)) {
    mode = 'col';
  }
  if (ci === -1 || (sri === eri && sci !== eci)) {
    mode = 'row';
  }

  contextMenu.setMode(mode);
  toolbar.reset();
  table.render();
}

// multiple: boolean
// direction: left | right | up | down | row-first | row-last | col-first | col-last
function selectorMove(multiple, direction) {
  const {
    selector, data,
  } = this;
  const { rows, cols } = data;
  let [ri, ci] = selector.indexes;
  if (multiple) {
    [ri, ci] = selector.moveIndexes;
  }
  // console.log('selector.move:', { ri, ci });
  if (direction === 'left') {
    if (ci > 0) ci -= 1;
  } else if (direction === 'right') {
    if (ci < cols.len - 1) ci += 1;
  } else if (direction === 'up') {
    if (ri > 0) ri -= 1;
  } else if (direction === 'down') {
    if (ri < rows.len - 1) ri += 1;
  } else if (direction === 'row-first') {
    ci = 0;
  } else if (direction === 'row-last') {
    ci = cols.len - 1;
  } else if (direction === 'col-first') {
    ri = 0;
  } else if (direction === 'col-last') {
    ri = rows.len - 1;
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

// private methods
function overlayerMousemove(evt) {
  // console.log('x:', evt.offsetX, ', y:', evt.offsetY);
  if (evt.buttons !== 0) return;
  if (evt.target.className === `${cssPrefix}-resizer-hover`) return;
  const { offsetX, offsetY } = evt;
  const {
    rowResizer, colResizer, tableEl, data,
  } = this;
  const { rows, cols } = data;
  if (offsetX > cols.indexWidth && offsetY > rows.height) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(evt.offsetX, evt.offsetY);
  if (cRect.ri >= 0 && cRect.ci === -1) {
    cRect.width = cols.indexWidth;
    rowResizer.show(cRect, {
      width: tRect.width,
    });
    if (rows.isHide(cRect.ri - 1)) {
      rowResizer.showUnhide(cRect.ri);
    } else {
      rowResizer.hideUnhide();
    }
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === -1 && cRect.ci >= 0) {
    cRect.height = rows.height;
    colResizer.show(cRect, {
      height: tRect.height,
    });
    if (cols.isHide(cRect.ci - 1)) {
      colResizer.showUnhide(cRect.ci);
    } else {
      colResizer.hideUnhide();
    }
  } else {
    colResizer.hide();
  }
}

// let scrollThreshold = 15;
function overlayerMousescroll(evt) {
  evt.preventDefault();
  // scrollThreshold -= 1;
  // if (scrollThreshold > 0) return;
  // scrollThreshold = 15;

  const { verticalScrollbar, horizontalScrollbar, data } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();
  // console.log('evt:::', evt.wheelDelta, evt.detail * 40);

  const { rows, cols } = data;

  // deltaY for vertical delta
  const { deltaY, deltaX } = evt;
  const loopValue = (ii, vFunc) => {
    let i = ii;
    let v = 0;
    do {
      v = vFunc(i);
      i += 1;
    } while (v <= 0);
    return v;
  };
  // console.log('deltaX', deltaX, 'evt.detail', evt.detail);
  // if (evt.detail) deltaY = evt.detail * 40;
  const moveY = (vertical) => {
    if (vertical > 0) {
      // up
      const ri = data.scroll.ri + 1;
      if (ri < rows.len) {
        const rh = loopValue(ri, i => rows.getHeight(i));
        verticalScrollbar.move({ top: top + rh - 1 });
      }
    } else {
      // down
      const ri = data.scroll.ri - 1;
      if (ri >= 0) {
        const rh = loopValue(ri, i => rows.getHeight(i));
        verticalScrollbar.move({ top: ri === 0 ? 0 : top - rh });
      }
    }
  };

  // deltaX for Mac horizontal scroll
  const moveX = (horizontal) => {
    if (horizontal > 0) {
      // left
      const ci = data.scroll.ci + 1;
      if (ci < cols.len) {
        const cw = loopValue(ci, i => cols.getWidth(i));
        horizontalScrollbar.move({ left: left + cw - 1 });
      }
    } else {
      // right
      const ci = data.scroll.ci - 1;
      if (ci >= 0) {
        const cw = loopValue(ci, i => cols.getWidth(i));
        horizontalScrollbar.move({ left: ci === 0 ? 0 : left - cw });
      }
    }
  };
  const tempY = Math.abs(deltaY);
  const tempX = Math.abs(deltaX);
  const temp = Math.max(tempY, tempX);
  // console.log('event:', evt);
  // detail for windows/mac firefox vertical scroll
  if (/Firefox/i.test(window.navigator.userAgent)) throttle(moveY(evt.detail), 50);
  if (temp === tempX) throttle(moveX(deltaX), 50);
  if (temp === tempY) throttle(moveY(deltaY), 50);
}

function overlayerTouch(direction, distance) {
  const { verticalScrollbar, horizontalScrollbar } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();

  if (direction === 'left' || direction === 'right') {
    horizontalScrollbar.move({ left: left - distance });
  } else if (direction === 'up' || direction === 'down') {
    verticalScrollbar.move({ top: top - distance });
  }
}

function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  const erth = data.exceptRowTotalHeight(0, -1);
  // console.log('erth:', erth);
  verticalScrollbar.set(height, data.rows.totalHeight() - erth);
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.cols.totalWidth());
  }
}

function sheetFreeze() {
  const {
    selector, data, editor,
  } = this;
  const [ri, ci] = data.freeze;
  if (ri > 0 || ci > 0) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    editor.setFreezeLengths(fwidth, fheight);
  }
  selector.resetAreaOffset();
}

function sheetReset() {
  const {
    tableEl,
    overlayerEl,
    overlayerCEl,
    table,
    toolbar,
    selector,
    el,
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset(tOffset);
  el.css('width', `${vRect.width}px`);
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
  sheetFreeze.call(this);
  table.render();
  toolbar.reset();
  selector.reset();
}

function clearClipboard() {
  const { data, selector } = this;
  data.clearClipboard();
  selector.hideClipboard();
}

function copy(evt) {
  const { data, selector } = this;
  if (data.settings.mode === 'read') return;
  data.copy();
  data.copyToSystemClipboard(evt);
  selector.showClipboard();
}

function cut() {
  const { data, selector } = this;
  if (data.settings.mode === 'read') return;
  data.cut();
  selector.showClipboard();
}

function paste(what, evt) {
  const { data, datas } = this;
  let clen = 0;
  let rlen = 0;
  if (data.settings.mode === 'read') return;
  if (data.paste(what, datas, msg => xtoast('Tip', msg))) {
    sheetReset.call(this);
  } else if (evt) {
    const cdata = evt.clipboardData.getData('text/plain');
    ({ clen, rlen } = this.data.pasteFromText(cdata));
    sheetReset.call(this);
  }
  const { sri, sci } = this.selector.range;
  const cdiff = data.clipboard.range ? data.clipboard.range.eci - data.clipboard.range.sci : clen;
  const rdiff = data.clipboard.range ? data.clipboard.range.eri - data.clipboard.range.sri : rlen;
  this.selector.hideClipboard();
  this.selector.moveIndexes = [sri + rdiff, sci + cdiff];
  selectorSet.call(this, true, sri + rdiff, sci + cdiff, true);
}

function hideRowsOrCols() {
  this.data.hideRowsOrCols();
  sheetReset.call(this);
}

function unhideRowsOrCols(type, index) {
  this.data.unhideRowsOrCols(type, index);
  sheetReset.call(this);
}

function autofilter() {
  const { data } = this;
  data.autofilter();
  sheetReset.call(this);
}

function toolbarChangePaintformatPaste() {
  const { toolbar } = this;
  if (toolbar.paintformatActive()) {
    paste.call(this, 'format');
    clearClipboard.call(this);
    toolbar.paintformatToggle();
  }
}

function overlayerMousedown(evt) {
  // console.log(':::::overlayer.mousedown:', evt.detail, evt.button, evt.buttons, evt.shiftKey);
  // console.log('evt.target.className:', evt.target.className);
  const {
    selector, data, table, sortFilter,
  } = this;
  const { offsetX, offsetY } = evt;
  const isAutofillEl = evt.target.className === `${cssPrefix}-selector-corner`;
  const cellRect = data.getCellRectByXY(offsetX, offsetY);
  const {
    left, top, width, height,
  } = cellRect;
  let { ri, ci } = cellRect;
  // sort or filter
  const { autoFilter } = data;
  if (autoFilter.includes(ri, ci)) {
    if (left + width - 20 < offsetX && top + height - 20 < offsetY) {
      const items = autoFilter.items(ci, (r, c) => data.rows.getCell(r, c));
      sortFilter.hide();
      sortFilter.set(ci, items, autoFilter.getFilter(ci), autoFilter.getSort(ci));
      sortFilter.setOffset({ left, top: top + height + 2 });
      return;
    }
  }

  // console.log('ri:', ri, ', ci:', ci);
  if (!evt.shiftKey) {
    // console.log('selectorSetStart:::');
    if (isAutofillEl) {
      selector.showAutofill(ri, ci);
    } else {
      selectorSet.call(this, false, ri, ci);
    }

    // mouse move up
    mouseMoveUp(window, (e) => {
      // console.log('mouseMoveUp::::');
      ({ ri, ci } = data.getCellRectByXY(e.offsetX, e.offsetY));
      if (isAutofillEl) {
        selector.showAutofill(ri, ci);
      } else if (e.buttons === 1 && !e.shiftKey) {
        selectorSet.call(this, true, ri, ci, true, true);
      }
    }, () => {
      if (isAutofillEl && selector.arange && data.settings.mode !== 'read') {
        if (data.autofill(selector, 'all', msg => xtoast('Tip', msg))) {
          table.render();
        }
      }
      selector.hideAutofill();
      toolbarChangePaintformatPaste.call(this);
    });
  }

  if (!isAutofillEl && evt.buttons === 1) {
    if (evt.shiftKey) {
      // console.log('shiftKey::::');
      selectorSet.call(this, true, ri, ci);
    }
  }
}

// update moveIndexes on mouse up
function overlayerMouseup(evt) {
  const {
    selector, data,
  } = this;
  const { offsetX, offsetY } = evt;
  const cellRect = data.getCellRectByXY(offsetX, offsetY);
  const { ri, ci } = cellRect;
  selector.moveIndexes = [ri, ci];
}

function editorSetOffset() {
  const { editor, data } = this;
  const sOffset = data.getSelectedRect();
  const tOffset = this.getTableOffset();
  let sPosition = 'top';
  // console.log('sOffset:', sOffset, ':', tOffset);
  if (sOffset.top > tOffset.height / 2) {
    sPosition = 'bottom';
  }
  editor.setOffset(sOffset, sPosition);
}

function editorSet() {
  const { editor, data } = this;
  if (data.settings.mode === 'read') return;
  editorSetOffset.call(this);
  editor.setCell(data.getSelectedCell(), data.getSelectedValidator());
  clearClipboard.call(this);
}

function verticalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrolly(distance, () => {
    selector.resetBRLAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function horizontalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrollx(distance, () => {
    selector.resetBRTAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function rowResizerFinished(cRect, distance) {
  const { ri } = cRect;
  const { table, selector, data } = this;
  data.setRowHeight(ri, distance);
  table.render();
  selector.resetAreaOffset();
  verticalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci } = cRect;
  const { table, selector, data } = this;
  data.setColWidth(ci, distance);
  // console.log('data:', data);
  table.render();
  selector.resetAreaOffset();
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function dataSetCellText(text, state = 'finished') {
  const { data, table } = this;
  // const [ri, ci] = selector.indexes;
  if (data.settings.mode === 'read') return;
  data.setSelectedCellText(text, state);
  const { ri, ci } = data.selector;
  if (state === 'finished') {
    table.render();
  } else {
    this.trigger('cell-edited', text, ri, ci);
  }
}

function insertDeleteRowColumn(type) {
  const { data } = this;
  if (data.settings.mode === 'read') return;
  if (type === 'insert-row') { // insert row above
    data.insert('row');
  } else if (type === 'insert-row-below') {
    data.insert('row', 1, false);
  } else if (type === 'delete-row') {
    data.delete('row');
  } else if (type === 'insert-column') { // insert column left
    data.insert('column');
  } else if (type === 'insert-column-right') {
    data.insert('column', 1, false);
  } else if (type === 'delete-column') {
    data.delete('column');
  } else if (type === 'delete-cell') {
    data.deleteCell();
  } else if (type === 'delete-cell-format') {
    data.deleteCell('format');
  } else if (type === 'delete-cell-text') {
    data.deleteCell('text');
  } else if (type === 'cell-printable') {
    data.setSelectedCellAttr('printable', true);
  } else if (type === 'cell-non-printable') {
    data.setSelectedCellAttr('printable', false);
  } else if (type === 'cell-editable') {
    data.setSelectedCellAttr('editable', true);
  } else if (type === 'cell-non-editable') {
    data.setSelectedCellAttr('editable', false);
  }
  clearClipboard.call(this);
  sheetReset.call(this);
}

function toolbarChange(type, value) {
  const { data } = this;
  if (type === 'undo') {
    this.undo();
  } else if (type === 'redo') {
    this.redo();
  } else if (type === 'print') {
    this.print.preview();
  } else if (type === 'paintformat') {
    if (value === true) copy.call(this);
    else clearClipboard.call(this);
  } else if (type === 'clearformat') {
    insertDeleteRowColumn.call(this, 'delete-cell-format');
  } else if (type === 'link') {
    // link
  } else if (type === 'chart') {
    // chart
  } else if (type === 'autofilter') {
    // filter
    autofilter.call(this);
  } else if (type === 'freeze') {
    if (value) {
      const { ri, ci } = data.selector;
      this.freeze(ri, ci);
    } else {
      this.freeze(0, 0);
    }
  } else if (type === 'fullscreen') {
    if (value) {
      this.data.settings.view = {
        width: () => window.innerWidth,
        height: () => window.innerHeight,
      };
      this.container.el.requestFullscreen();
    } else {
      this.data.settings.view = { ...this.defaultSettings.view };
      document.exitFullscreen();
    }
  } else {
    data.setSelectedCellAttr(type, value);
    if (type === 'formula' && !data.selector.multiple()) {
      editorSet.call(this);
    }
    sheetReset.call(this);
  }
}

function sortFilterChange(ci, order, operator, value) {
  // console.log('sort:', sortDesc, operator, value);
  const { data } = this;
  data.setAutoFilter(ci, order, operator, value);
  sheetReset.call(this);
}

function sheetInitEvents() {
  const {
    selector,
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
    contextMenu,
    table,
    toolbar,
    modalValidation,
    sortFilter,
  } = this;

  const handleSelectAll = (evt) => {
    const keyCode = evt.keyCode || evt.which;
    const {
      ctrlKey, metaKey,
    } = evt;
    if (ctrlKey || metaKey) {
      switch (keyCode) {
        case 65: {
          // ctrl + A, select all
          selector.set(-1, -1);
          selector.moveIndexes = [this.data.rows.len - 1, this.data.cols.len - 1];
          contextMenu.setMode('range');
          toolbar.reset();
          table.render();
          break;
        }
        default:
          break;
      }
    }
  };

  const parent = overlayerEl.closest('.x-spreadsheet');

  parent
    .on('mouseover', (evt) => {
      evt.preventDefault();
      bind(window, 'keydown', handleSelectAll);
    })
    .on('mouseout', (evt) => {
      evt.preventDefault();
      unbind(window, 'keydown', handleSelectAll);
    });

  parent.dispatch(new Event('mouseover'));

  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      editor.clear();
      contextMenu.hide();
      // the left mouse button: mousedown → mouseup → click
      // the right mouse button: mousedown → contenxtmenu → mouseup
      if (evt.buttons === 2) {
        if (this.data.xyInSelectedRect(evt.offsetX, evt.offsetY)) {
          contextMenu.setPosition(evt.offsetX, evt.offsetY);
        } else {
          overlayerMousedown.call(this, evt);
          contextMenu.setPosition(evt.offsetX, evt.offsetY);
        }
        evt.stopPropagation();
      } else if (evt.detail === 2) {
        editorSet.call(this);
      } else {
        overlayerMousedown.call(this, evt);
      }
    })
    .on('mousewheel.stop', (evt) => {
      overlayerMousescroll.call(this, evt);
    })
    .on('mouseout', (evt) => {
      const { offsetX, offsetY } = evt;
      if (offsetY <= 0) colResizer.hide();
      if (offsetX <= 0) rowResizer.hide();
    })
    .on('mouseup', (evt) => {
      overlayerMouseup.call(this, evt);
    });

  selector.inputChange = (v) => {
    dataSetCellText.call(this, v, 'input');
    editorSet.call(this);
  };

  // slide on mobile
  bindTouch(overlayerEl.el, {
    move: (direction, d) => {
      overlayerTouch.call(this, direction, d);
    },
  });

  // toolbar change
  toolbar.change = (type, value) => toolbarChange.call(this, type, value);

  // sort filter ok
  sortFilter.ok = (ci, order, o, v) => sortFilterChange.call(this, ci, order, o, v);

  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };
  // resizer unhide callback
  rowResizer.unhideFn = (index) => {
    unhideRowsOrCols.call(this, 'row', index);
  };
  colResizer.unhideFn = (index) => {
    unhideRowsOrCols.call(this, 'col', index);
  };
  // scrollbar move callback
  verticalScrollbar.moveFn = (distance, evt) => {
    verticalScrollbarMove.call(this, distance, evt);
  };
  horizontalScrollbar.moveFn = (distance, evt) => {
    horizontalScrollbarMove.call(this, distance, evt);
  };
  // editor
  editor.change = (state, itext) => {
    dataSetCellText.call(this, itext, state);
  };
  // modal validation
  modalValidation.change = (action, ...args) => {
    if (action === 'save') {
      this.data.addValidation(...args);
    } else {
      this.data.removeValidation();
    }
  };
  // contextmenu
  contextMenu.itemClick = (type) => {
    // console.log('type:', type);
    if (type === 'validation') {
      modalValidation.setValue(this.data.getSelectedValidation());
    } else if (type === 'copy') {
      copy.call(this);
    } else if (type === 'cut') {
      cut.call(this);
    } else if (type === 'paste') {
      paste.call(this, 'all');
    } else if (type === 'paste-value') {
      paste.call(this, 'text');
    } else if (type === 'paste-format') {
      paste.call(this, 'format');
    } else if (type === 'hide-row' || type === 'hide-column') {
      hideRowsOrCols.call(this);
    } else {
      insertDeleteRowColumn.call(this, type);
    }
  };

  bind(window, 'resize', () => {
    this.reload();
  });

  bind(window, 'click', (evt) => {
    this.focusing = overlayerEl.contains(evt.target);
  });

  bind(window, 'paste', (evt) => {
    if (!this.focusing) return;
    paste.call(this, 'all', evt);
    evt.preventDefault();
  });

  bind(window, 'copy', (evt) => {
    if (!this.focusing) return;
    copy.call(this, evt);
    evt.preventDefault();
  });

  // for selector
  bind(window, 'keydown', (evt) => {
    if (!this.focusing) return;
    const keyCode = evt.keyCode || evt.which;
    const {
      key, ctrlKey, shiftKey, metaKey,
    } = evt;
    // console.log('keydown.evt: ', keyCode, shiftKey, metaKey, ctrlKey);
    if (ctrlKey || metaKey) {
      // const { sIndexes, eIndexes } = selector;
      // let what = 'all';
      // if (shiftKey) what = 'text';
      // if (altKey) what = 'format';
      switch (keyCode) {
        case 90:
          // undo: ctrl + z
          this.undo();
          evt.preventDefault();
          break;
        case 89:
          // redo: ctrl + y
          this.redo();
          evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          cut.call(this);
          evt.preventDefault();
          break;
        case 85:
          // ctrl + u
          toolbar.trigger('underline');
          evt.preventDefault();
          break;
        case 37:
          // ctrl + left
          selectorMove.call(this, shiftKey, 'row-first');
          evt.preventDefault();
          break;
        case 38:
          // ctrl + up
          selectorMove.call(this, shiftKey, 'col-first');
          evt.preventDefault();
          break;
        case 39:
          // ctrl + right
          selectorMove.call(this, shiftKey, 'row-last');
          evt.preventDefault();
          break;
        case 40:
          // ctrl + down
          selectorMove.call(this, shiftKey, 'col-last');
          evt.preventDefault();
          break;
        case 32:
          // ctrl + space, all cells in col
          this.selector.setStartEnd(
            0,
            this.data.selector.ci,
            -1,
            this.data.selector.ci,
            this.data.rows.len - 1,
            this.data.selector.ci,
          );
          evt.preventDefault();
          break;
        case 66:
          // ctrl + B
          toolbar.trigger('bold');
          break;
        case 73:
          // ctrl + I
          toolbar.trigger('italic');
          break;
        case 70:
          // ctrl + f
          evt.preventDefault();
          this.modalFind.show();
          break;
        case 67: // ctrl + c
        case 86: // ctrl + v
        default:
          break;
      }
    } else {
      // console.log('evt.keyCode:', evt.keyCode);
      switch (keyCode) {
        case 32:
          if (shiftKey) {
            // shift + space, all cells in row
            this.selector.setStartEnd(
              this.data.selector.ri,
              0,
              this.data.selector.ri,
              -1,
              this.data.selector.ri,
              this.data.cols.len - 1,
            );
          }
          break;
        case 27: // esc
          contextMenu.hide();
          clearClipboard.call(this);
          break;
        case 37: // left
          selectorMove.call(this, shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          editor.clear();
          // shift + tab => move left
          // tab => move right
          selectorMove.call(this, false, shiftKey ? 'left' : 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          editor.clear();
          // shift + enter => move up
          // enter => move down
          selectorMove.call(this, false, shiftKey ? 'up' : 'down');
          evt.preventDefault();
          break;
        case 8: { // backspace
          insertDeleteRowColumn.call(this, 'delete-cell-text');
          const [ri, ci] = this.selector.moveIndexes;
          this.selector.setEnd(ri, ci);
          evt.preventDefault();
          break;
        }
        default:
          break;
      }

      if (key === 'Delete') {
        insertDeleteRowColumn.call(this, 'delete-cell-text');
        evt.preventDefault();
      } else if ((keyCode >= 65 && keyCode <= 90)
        || (keyCode >= 48 && keyCode <= 57)
        || (keyCode >= 96 && keyCode <= 105)
        || evt.key === '='
      ) {
        dataSetCellText.call(this, evt.key, 'input');
        editorSet.call(this);
      } else if (keyCode === 113) {
        // F2
        editorSet.call(this);
      }
    }
  });
}

function find(val, idx, replace, replaceWith = '', matchCase = false, matchCellContents = false) {
  const { data, table } = this;
  const { rows } = data;
  const foundCells = [];
  const soughtValue = matchCase ? val : val.toLowerCase();
  rows.each((ri) => {
    rows.eachCells(ri, (ci, { text }) => {
      const txt = matchCase ? `${text}` : `${text}`.toLowerCase();
      const condition = matchCellContents
        ? txt === val : txt.includes(soughtValue);
      if (condition) {
        foundCells.push({ ri, ci, text });
        if (replace === 'all') {
          data.setCellTextRaw(ri, ci, text.replace(new RegExp(soughtValue, 'i'), replaceWith));
        }
      }
    });
  });

  if (!foundCells.length) {
    return -1;
  }

  if (replace === 'all') {
    table.render();
    return foundCells.length;
  }

  let { ri, ci } = foundCells[idx];
  const { text } = foundCells[idx];
  if (replace === 'current') {
    data.setCellText(ri, ci, text.replace(new RegExp(soughtValue, 'i'), replaceWith));
    ({ ri, ci } = foundCells[(idx + 1 === foundCells.length) ? 0 : idx + 1]);
  }

  selectorSet.call(this, false, parseInt(ri, 10), parseInt(ci, 10));
  scrollbarMove.call(this);

  return foundCells.length;
}

export default class Sheet {
  // pass datas in the constructor to be able to acces data accross sheets
  constructor(targetEl, idx, datas) {
    this.container = targetEl;
    this.eventMap = createEventEmitter();
    const { view, showToolbar, showContextmenu } = datas[idx].settings;
    this.el = h('div', `${cssPrefix}-sheet`);
    this.toolbar = new Toolbar(datas[idx], view.width, !showToolbar);
    this.print = new Print(datas[idx]);
    this.container.children(this.toolbar.el, this.el, this.print.el);
    this.dataIndex = idx;
    this.datas = datas;
    // table
    this.tableEl = h('canvas', `${cssPrefix}-table`);
    // resizer
    this.rowResizer = new Resizer(false, datas[idx].rows.height);
    this.colResizer = new Resizer(true, datas[idx].cols.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // editor
    this.editor = new Editor(
      formulas,
      () => this.getTableOffset(),
      datas[idx].rows.height,
    );
    // data validation
    this.modalValidation = new ModalValidation();
    // search
    this.modalFind = new ModalFind();
    this.modalFind.find = (s, i, r, rw, mc, mec) => find.call(this, s, i, r, rw, mc, mec);
    // contextMenu
    this.contextMenu = new ContextMenu(() => this.getRect(), !showContextmenu);
    // selector
    this.selector = new Selector(datas[idx]);
    this.overlayerCEl = h('div', `${cssPrefix}-overlayer-content`)
      .children(
        this.editor.el,
        this.selector.el,
      );
    this.overlayerEl = h('div', `${cssPrefix}-overlayer`)
      .child(this.overlayerCEl);
    // sortFilter
    this.sortFilter = new SortFilter();
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
      this.contextMenu.el,
      this.modalValidation.el,
      this.sortFilter.el,
      this.modalFind.el,
    );
    // table
    this.table = new Table(this.tableEl.el, idx, datas);
    sheetInitEvents.call(this);
    sheetReset.call(this);
    // init selector [0, 0]
    selectorSet.call(this, false, 0, 0);
    this.defaultSettings = { view };
  }

  get data() {
    return this.datas[this.dataIndex];
  }

  on(eventName, func) {
    this.eventMap.on(eventName, func);
    return this;
  }

  trigger(eventName, ...args) {
    const { eventMap } = this;
    eventMap.fire(eventName, args);
  }

  resetData(idx, datas) {
    // before
    this.editor.clear();
    // after
    this.dataIndex = idx;
    this.datas = datas;
    verticalScrollbarSet.call(this);
    horizontalScrollbarSet.call(this);
    this.toolbar.resetData(datas[idx]);
    this.print.resetData(datas[idx]);
    this.selector.resetData(datas[idx]);
    this.table.resetData(idx, datas);
  }

  loadData(data) {
    this.data.setData(data);
    sheetReset.call(this);
    return this;
  }

  // freeze rows or cols
  freeze(ri, ci) {
    const { data } = this;
    data.setFreeze(ri, ci);
    sheetReset.call(this);
    return this;
  }

  undo() {
    this.data.undo();
    sheetReset.call(this);
  }

  redo() {
    this.data.redo();
    sheetReset.call(this);
  }

  reload() {
    sheetReset.call(this);
    return this;
  }

  getRect() {
    const { data } = this;
    return { width: data.viewWidth(), height: data.viewHeight() };
  }

  getTableOffset() {
    const { rows, cols } = this.data;
    const { width, height } = this.getRect();
    return {
      width: width - cols.indexWidth,
      height: height - rows.height,
      left: cols.indexWidth,
      top: rows.height,
    };
  }
}
