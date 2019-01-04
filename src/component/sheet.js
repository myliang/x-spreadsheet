/* global window */
import { h } from './element';
import { bind, mouseMoveUp } from '../event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';
import ContextMenu from './contextmenu';
import Table from './table';

function scrollbarMove() {
  const {
    data, table, verticalScrollbar, horizontalScrollbar,
  } = this;
  const {
    l, t, left, top, width, height,
  } = table.getSelectRect();
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
  const {
    table, selector,
  } = this;
  if (multiple) {
    // console.log('ri:', ri, ', ci:', ci);
    selector.setEnd([ri, ci], (sIndexes, eIndexes) => {
      // console.log('sIndexes:', sIndexes, ', eIndexes:', eIndexes, table.scrollOffset);
      table.setSelectRectIndexes([sIndexes, eIndexes]).render();
      // console.log('table.getSelectRect():', table.getSelectRect());
      return table.getSelectRect();
    });
  } else {
    // console.log('ri:', ri, ', ci:', ci);
    table.setSelectRectIndexes([[ri, ci], [ri, ci]]).render();
    // console.log('table.getSelectRect():', table.getSelectRect());
    const selectRect = table.getSelectRect();
    selector.set([ri, ci], selectRect);
  }
}

function selectorSetByEvent(multiple, evt) {
  const { table } = this;
  const {
    ri, ci, // left, top, width, height,
  } = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY);
  if (ri === 0 && ci === 0) return;
  selectorSet.call(this, multiple, ri, ci);
}

// multiple: boolean
// direction: left | right | up | down
function selectorMove(multiple, direction) {
  const {
    selector, col, row,
  } = this;
  let [ri, ci] = selector.indexes;
  if (multiple) {
    [ri, ci] = selector.moveIndexes;
  }
  if (direction === 'left') {
    if (ci > 1) ci -= 1;
  } else if (direction === 'right') {
    if (ci < col.len) ci += 1;
  } else if (direction === 'up') {
    if (ri > 1) ri -= 1;
  } else if (direction === 'down') {
    if (ri < row.len) ri += 1;
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

// private methods
function overlayerMousemove(evt) {
  // console.log('evt.buttons: ', evt.buttons, evt);
  if (evt.buttons !== 0) return;
  if (evt.target.className === 'xss-resizer-hover') return;
  const {
    table, rowResizer, colResizer, tableEl,
  } = this;
  const tRect = tableEl.box();
  const cRect = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY, false);
  if (cRect.ri >= 1 && cRect.ci === 0) {
    rowResizer.show(cRect, {
      width: tRect.width,
    });
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === 0 && cRect.ci >= 1) {
    colResizer.show(cRect, {
      height: tRect.height,
    });
  } else {
    colResizer.hide();
  }
}

function overlayerMousedown(evt) {
  // console.log(':::::overlayer.mousedown:', evt.detail, evt.button, evt.buttons, evt.shiftKey);
  if (!evt.shiftKey) {
    // console.log('selectorSetStart:::');
    selectorSetByEvent.call(this, false, evt);

    // mouse move up
    mouseMoveUp(window, (e) => {
      // console.log('mouseMoveUp::::');
      if (e.buttons === 1 && !e.shiftKey) {
        selectorSetByEvent.call(this, true, e);
      }
    }, () => {
    });
  }

  if (evt.buttons === 1) {
    if (evt.shiftKey) {
      // to-do
      // console.log('shiftKey::::');
      selectorSetByEvent.call(this, true, evt);
    }
  }
}

function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  // console.log('data:', data, ',height:', height, ', totalHeight:', data.rowTotalHeight());
  verticalScrollbar.set(height, data.rowTotalHeight());
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.colTotalWidth());
  }
}

function editorSetOffset() {
  const { editor, table } = this;
  const sOffset = table.getSelectRect();
  const tOffset = this.getTableOffset();
  let sPosition = 'top';
  // console.log('sOffset:', sOffset, ':', tOffset);
  if (sOffset.top > tOffset.height / 2) {
    sPosition = 'bottom';
  }
  editor.setOffset(sOffset, sPosition);
}
function editorSet() {
  const {
    editor, data, selector,
  } = this;
  const [ri, ci] = selector.indexes;
  editorSetOffset.call(this);
  editor.setCell(data.getCell(ri - 1, ci - 1));
}

function verticalScrollbarMove(distance) {
  const { table, selector } = this;
  table.scroll({ y: distance });
  // selectorsetAreaOffset.call(this);
  selector.setBRLAreaOffset(table.getSelectRect());
  editorSetOffset.call(this);
}

function horizontalScrollbarMove(distance) {
  const { table, selector } = this;
  table.scroll({ x: distance });
  // selectorsetAreaOffset.call(this);
  selector.setBRTAreaOffset(table.getSelectRect());
  editorSetOffset.call(this);
}

function rowResizerFinished(cRect, distance) {
  const { ri } = cRect;
  const { table, selector, data } = this;
  data.setRowHeight(ri - 1, distance);
  table.render();
  // selectorsetAreaOffset.call(this);
  selector.setAreaOffset(table.getSelectRect());
  verticalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci } = cRect;
  const { table, selector, data } = this;
  data.setColWidth(ci - 1, distance);
  table.render();
  // selectorsetAreaOffset.call(this);
  selector.setAreaOffset(table.getSelectRect());
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function dataSetCellText(text) {
  const { selector, data, table } = this;
  const [ri, ci] = selector.indexes;
  data.setCellText(ri - 1, ci - 1, text);
  table.render();
}

function sheetFreeze() {
  const {
    selector, data, editor, table,
  } = this;
  const [ri, ci] = data.getFreeze();
  if (ri > 1 || ci > 1) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    editor.setFreezeLengths(fwidth, fheight);
  }
  selector.setAreaOffset(table.getSelectRect());
}

function sheetReset() {
  const {
    tableEl,
    overlayerEl,
    overlayerCEl,
    table,
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
}

function sheetInitEvents() {
  const {
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
    selector,
    contextMenu,
    table,
    data,
    row,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      // console.log('mousedown.evt:', evt);
      if (evt.buttons === 2) {
        if (table.xyInSelectRect(evt.offsetX, evt.offsetY)) {
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
    });
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
  editor.change = itext => dataSetCellText.call(this, itext);
  // contextmenu
  contextMenu.itemClick = (type) => {
    // console.log('type:', type);
    // const { sIndexes, eIndexes } = selector;
    const [
      sri, sci, eri, eci,
    ] = selector.getCellRangeIndexes();
    if (type === 'insert-row') {
      data.insertRow(sri);
    } else if (type === 'delete-row') {
      data.deleteRow(sri, eri);
    } else if (type === 'insert-column') {
      data.insertColumn(sci);
    } else if (type === 'delete-column') {
      data.deleteColumn(sci, eci);
    }
    this.reload();
  };

  bind(window, 'resize', () => {
    this.reload();
  });

  bind(window, 'click', (evt) => {
    this.focusing = overlayerEl.contains(evt.target);
  });

  bind(window, 'mousewheel', (evt) => {
    if (!this.focusing) return;
    const { top } = this.verticalScrollbar.scroll();
    if (evt.deltaY > 0) {
      // up
      const ri = table.scrollIndexes[0] + 1;
      if (ri < row.len) {
        this.verticalScrollbar.move({ top: top + data.getRowHeight(ri) });
      }
    } else {
      // down
      const ri = table.scrollIndexes[0] - 1;
      if (ri >= 0) {
        this.verticalScrollbar.move({ top: ri === 0 ? 0 : top - data.getRowHeight(ri) });
      }
    }
  });

  // for selector
  bind(window, 'keydown', (evt) => {
    if (!this.focusing) return;
    // console.log('keydown.evt: ', evt);
    if (evt.ctrlKey) {
      const [
        sri, sci, eri, eci,
      ] = selector.getCellRangeIndexes();
      let what = 'all';
      if (evt.shiftKey) what = 'text';
      if (evt.altKey) what = 'format';
      switch (evt.keyCode) {
        case 90:
          // undo: ctrl + z
          data.undo();
          sheetReset.call(this);
          evt.preventDefault();
          break;
        case 89:
          // redo: ctrl + y
          data.redo();
          sheetReset.call(this);
          evt.preventDefault();
          break;
        case 67:
          // ctrl + c
          data.copy([sri, sci], [eri, eci]);
          evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          data.cut([sri, sci], [eri, eci]);
          evt.preventDefault();
          break;
        case 86:
          // ctrl + v
          data.paste([sri, sci], [eri, eci], what);
          sheetReset.call(this);
          evt.preventDefault();
          break;
        default:
          break;
      }
      // return;
    } else {
      // console.log('evt.keyCode:', evt.keyCode);
      switch (evt.keyCode) {
        case 27:
          contextMenu.hide();
          data.clearClipboard();
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
        default:
          break;
      }

      if ((evt.keyCode >= 65 && evt.keyCode <= 90)
        || (evt.keyCode >= 48 && evt.keyCode <= 57)
        || (evt.keyCode >= 96 && evt.keyCode <= 105)
      ) {
        dataSetCellText.call(this, evt.key);
        editorSet.call(this);
      }
    }
  });
}

export default class Sheet {
  constructor(targetEl, data) {
    this.el = h('div', 'xss-sheet');
    targetEl.child(this.el);
    // console.log('elRect:', elRect);
    const {
      row, col, view,
    } = data.options;
    this.view = view;
    this.col = col;
    this.row = row;
    this.data = data;
    // table
    this.tableEl = h('canvas', 'xss-table');
    this.table = new Table(this.tableEl.el, data);
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
    this.overlayerCEl = h('div', 'xss-overlayer-content')
      .children(
        this.editor.el,
        this.selector.el,
      );
    this.overlayerEl = h('div', 'xss-overlayer')
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
    sheetInitEvents.call(this);
    sheetReset.call(this);
  }

  loadData(data) {
    this.data.load(data);
    sheetReset.call(this);
    return this;
  }

  // freeze rows or cols
  freeze(ri, ci) {
    const { table } = this;
    table.setFreezeIndexes([ri, ci]);
    sheetReset.call(this);
    return this;
  }

  reload() {
    sheetReset.call(this);
    return this;
  }

  getRect() {
    const { width } = this.el.box();
    const height = this.view.height();
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
