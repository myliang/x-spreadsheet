/* global window */
import { h } from './element';
import { bind, mouseMoveUp, bindTouch } from '../event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';
import ContextMenu from './contextmenu';
import Table from './table';
import Toolbar from './toolbar';
import { cssPrefix } from '../config';

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

function selectorSet(multiple, ri, ci) {
  if (ri === -1 && ci === -1) return;
  // console.log(multiple, ', ri:', ri, ', ci:', ci);
  const {
    table, selector, toolbar,
  } = this;
  if (multiple) {
    selector.setEnd(ri, ci);
  } else {
    selector.set(ri, ci);
  }
  toolbar.reset();
  table.render();
}

// multiple: boolean
// direction: left | right | up | down | row-first | row-last | col-first | col-last
function selectorMove(multiple, direction) {
  const {
    selector, data,
  } = this;
  let [ri, ci] = selector.indexes;
  const [eri, eci] = selector.eIndexes;
  if (multiple) {
    [ri, ci] = selector.moveIndexes;
  }
  // console.log('selector.move:', ri, ci);
  if (direction === 'left') {
    if (ci > 0) ci -= 1;
  } else if (direction === 'right') {
    if (eci !== ci) ci = eci;
    if (ci < data.colLen() - 1) ci += 1;
  } else if (direction === 'up') {
    if (ri > 0) ri -= 1;
  } else if (direction === 'down') {
    if (eri !== ri) ri = eri;
    if (ri < data.rowLen() - 1) ri += 1;
  } else if (direction === 'row-first') {
    ci = 0;
  } else if (direction === 'row-last') {
    ci = data.colLen() - 1;
  } else if (direction === 'col-first') {
    ri = 0;
  } else if (direction === 'col-last') {
    ri = data.rowLen() - 1;
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
  if (offsetX > data.getFixedHeaderWidth()
    && offsetY > data.getFixedHeaderHeight()) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(evt.offsetX, evt.offsetY);
  if (cRect.ri >= 0 && cRect.ci === -1) {
    cRect.width = data.getFixedHeaderWidth();
    rowResizer.show(cRect, {
      width: tRect.width,
    });
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === -1 && cRect.ci >= 0) {
    cRect.height = data.getFixedHeaderHeight();
    colResizer.show(cRect, {
      height: tRect.height,
    });
  } else {
    colResizer.hide();
  }
}

function overlayerMousescroll(evt) {
  const { verticalScrollbar, data } = this;
  const { top } = verticalScrollbar.scroll();
  // console.log('evt:::', evt.wheelDelta, evt.detail * 40);
  let delta = evt.deltaY;
  if (evt.detail) delta = evt.detail * 40;
  if (delta > 0) {
    // up
    const ri = data.scroll.indexes[0] + 1;
    if (ri < data.rowLen()) {
      verticalScrollbar.move({ top: top + data.getRowHeight(ri) - 1 });
    }
  } else {
    // down
    const ri = data.scroll.indexes[0] - 1;
    if (ri >= 0) {
      verticalScrollbar.move({ top: ri === 0 ? 0 : top - data.getRowHeight(ri) });
    }
  }
}

function overlayerTouch(direction, distance) {
  const { verticalScrollbar, horizontalScrollbar } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();
  // console.log('direction:', direction, ', distance:', distance);
  if (direction === 'left' || direction === 'right') {
    horizontalScrollbar.move({ left: left - distance });
  } else if (direction === 'up' || direction === 'down') {
    verticalScrollbar.move({ top: top - distance });
  }
}

function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  verticalScrollbar.set(height, data.rowTotalHeight());
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.colTotalWidth());
  }
}

function sheetFreeze() {
  const {
    selector, data, editor,
  } = this;
  const [ri, ci] = data.getFreeze();
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
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset(tOffset);
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

function copy() {
  const { data, selector } = this;
  data.copy();
  selector.showClipboard();
}

function cut() {
  const { data, selector } = this;
  data.cut();
  selector.showClipboard();
}

function paste(what) {
  this.data.paste(what);
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
    selector, data, table,
  } = this;
  const isAutofillEl = evt.target.className === `${cssPrefix}-selector-corner`;
  let { ri, ci } = data.getCellRectByXY(evt.offsetX, evt.offsetY);
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
        selectorSet.call(this, true, ri, ci);
      }
    }, () => {
      if (isAutofillEl) {
        data.autofill(selector.saIndexes, selector.eaIndexes, 'all');
        table.render();
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
  editorSetOffset.call(this);
  editor.setCell(data.getSelectedCell());
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

function dataSetCellText(text) {
  const { data, table } = this;
  // const [ri, ci] = selector.indexes;
  data.setSelectedCellText(text);
  table.render();
}

function insertDeleteRowColumn(type) {
  const { data } = this;
  if (type === 'insert-row') {
    data.insertRow();
  } else if (type === 'delete-row') {
    data.deleteRow();
  } else if (type === 'insert-column') {
    data.insertColumn();
  } else if (type === 'delete-column') {
    data.deleteColumn();
  } else if (type === 'delete-cell') {
    data.deleteCell();
  } else if (type === 'delete-cell-format') {
    data.deleteCell('format');
  } else if (type === 'delete-cell-text') {
    data.deleteCell('text');
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
    // print
  } else if (type === 'paintformat') {
    if (value === true) copy.call(this);
    else clearClipboard.call(this);
  } else if (type === 'clearformat') {
    insertDeleteRowColumn.call(this, 'delete-cell-format');
  } else if (type === 'link') {
    // link
  } else if (type === 'chart') {
    // chart
  } else if (type === 'filter') {
    // filter
  } else if (type === 'freeze') {
    if (value) {
      this.freeze(...data.selector.indexes);
    } else {
      this.freeze(0, 0);
    }
  } else {
    data.setSelectedCellAttr(type, value);
    if (type === 'formula') {
      editorSet.call(this);
    }
    sheetReset.call(this);
  }
}

function sheetInitEvents() {
  const {
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
    contextMenu,
    data,
    toolbar,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    }).on('mousedown', (evt) => {
      if (evt.buttons === 2) {
        if (data.xyInSelectedRect(evt.offsetX, evt.offsetY)) {
          contextMenu.setPosition(evt.offsetX, evt.offsetY);
        } else {
          contextMenu.hide();
        }
      } else if (evt.detail === 2) {
        editorSet.call(this);
      } else {
        editor.clear();
        overlayerMousedown.call(this, evt);
      }
    }).on('mousewheel.stop', (evt) => {
      overlayerMousescroll.call(this, evt);
    });

  // slide on mobile
  bindTouch(overlayerEl.el, {
    move: (direction, d) => {
      overlayerTouch.call(this, direction, d);
    },
  });

  // toolbar change
  toolbar.change = (type, value) => toolbarChange.call(this, type, value);

  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };
  // scrollbar move callback
  verticalScrollbar.moveFn = (distance, evt) => {
    verticalScrollbarMove.call(this, distance, evt);
  };
  horizontalScrollbar.moveFn = (distance, evt) => {
    horizontalScrollbarMove.call(this, distance, evt);
  };
  // editor
  editor.change = (itext) => {
    dataSetCellText.call(this, itext);
    toolbar.reset();
  };
  // contextmenu
  contextMenu.itemClick = (type) => {
    // console.log('type:', type);
    if (type === 'copy') {
      copy.call(this);
    } else if (type === 'cut') {
      cut.call(this);
    } else if (type === 'paste') {
      paste.call(this, 'all');
    } else if (type === 'paste-value') {
      paste.call(this, 'text');
    } else if (type === 'paste-format') {
      paste.call(this, 'format');
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

  // for selector
  bind(window, 'keydown', (evt) => {
    if (!this.focusing) return;
    const keyCode = evt.keyCode || evt.which;
    // console.log('keydown.evt: ', keyCode);
    if (evt.ctrlKey) {
      // const { sIndexes, eIndexes } = selector;
      let what = 'all';
      if (evt.shiftKey) what = 'text';
      if (evt.altKey) what = 'format';
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
        case 67:
          // ctrl + c
          copy.call(this);
          evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          cut.call(this);
          evt.preventDefault();
          break;
        case 86:
          // ctrl + v
          paste.call(this, what);
          evt.preventDefault();
          break;
        case 37:
          // ctrl + left
          selectorMove.call(this, evt.shiftKey, 'row-first');
          evt.preventDefault();
          break;
        case 38:
          // ctrl + up
          selectorMove.call(this, evt.shiftKey, 'col-first');
          evt.preventDefault();
          break;
        case 39:
          // ctrl + right
          selectorMove.call(this, evt.shiftKey, 'row-last');
          evt.preventDefault();
          break;
        case 40:
          // ctrl + down
          selectorMove.call(this, evt.shiftKey, 'col-last');
          evt.preventDefault();
          break;
        case 32:
          // ctrl + space, all cells in col
          selectorSet.call(this, false, -1, data.selector.indexes[1]);
          evt.preventDefault();
          break;
        default:
          break;
      }
      // return;
    } else if (evt.shiftKey) {
      switch (keyCode) {
        case 32:
          // shift + space, all cells in row
          selectorSet.call(this, false, data.selector.indexes[0], -1);
          break;
        default:
          break;
      }
    } else {
      // console.log('evt.keyCode:', evt.keyCode);
      switch (keyCode) {
        case 27: // esc
          contextMenu.hide();
          clearClipboard.call(this);
          break;
        case 37: // left
          selectorMove.call(this, evt.shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, evt.shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, evt.shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, evt.shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          editor.clear();
          selectorMove.call(this, evt.shiftKey, 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          editor.clear();
          selectorMove.call(this, evt.shiftKey, 'down');
          evt.preventDefault();
          break;
        case 46: // del
          insertDeleteRowColumn.call(this, 'delete-cell-text');
          evt.preventDefault();
          break;
        default:
          break;
      }

      // console.log('keyCode:', keyCode, evt.key);
      if ((keyCode >= 65 && keyCode <= 90)
        || (keyCode >= 48 && keyCode <= 57)
        || (keyCode >= 96 && keyCode <= 105)
        || evt.key === '='
      ) {
        dataSetCellText.call(this, evt.key);
        editorSet.call(this);
      } else if (keyCode === 113) {
        // F2
        editorSet.call(this);
      }
    }
  });
}

export default class Sheet {
  constructor(targetEl, data) {
    this.el = h('div', `${cssPrefix}-sheet`);
    this.toolbar = new Toolbar(data);
    targetEl.children(this.toolbar.el, this.el);
    // console.log('elRect:', elRect);
    const {
      row, col, view,
    } = data.options;
    this.view = view;
    this.col = col;
    this.row = row;
    this.data = data;
    // table
    this.tableEl = h('canvas', `${cssPrefix}-table`);
    // resizer
    this.rowResizer = new Resizer(false, row.height);
    this.colResizer = new Resizer(true, col.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // editor
    this.editor = new Editor(
      Object.values(data.formulam),
      () => this.getTableOffset(),
      row.height,
    );
    // contextMenu
    this.contextMenu = new ContextMenu(() => this.getTableOffset());
    // selector
    this.selector = new Selector(data);
    this.overlayerCEl = h('div', `${cssPrefix}-overlayer-content`)
      .children(
        this.editor.el,
        this.selector.el,
      );
    this.overlayerEl = h('div', `${cssPrefix}-overlayer`)
      .child(this.overlayerCEl);
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
      this.contextMenu.el,
    );
    // table
    this.table = new Table(this.tableEl.el, data);
    sheetInitEvents.call(this);
    sheetReset.call(this);
    // init selector [0, 0]
    selectorSet.call(this, false, 0, 0);
  }

  loadData(data) {
    this.data.load(data);
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
    const height = this.view.height();
    const width = this.view.width();
    return { width, height };
  }

  getTableOffset() {
    const { row, col } = this;
    const { width, height } = this.getRect();
    return {
      width: width - col.indexWidth,
      height: height - row.height,
      left: col.indexWidth,
      top: row.height,
    };
  }
}
