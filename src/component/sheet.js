/* global window */
import { h } from './element';
import { bind } from '../event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Table from './table';
import { formulas as _formulas } from '../formula';

// private methods
function overlayerMousemove(evt) {
  // console.log('evt.buttons: ', evt.buttons, evt);
  if (evt.buttons !== 0) return;
  if (evt.target.className === 'xss-resizer-hover') return;
  const {
    table, rowResizer, colResizer, tableEl,
  } = this;
  const tRect = tableEl.box();
  const cRect = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY);
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
  // console.log(':::::overlayer.mousedown', evt);
  const { table, selector } = this;
  const {
    ri, ci, left, top, width, height,
  } = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY);
  const tOffset = this.getTableOffset();
  // console.log(':::::::', ri, ci, tOffset);
  if (ri > 0 && ci > 0) {
    selector.set([ri, ci], {
      left: left - tOffset.left, top: top - tOffset.top, width, height,
    });
  }

  if (evt.detail === 1) {
    if (evt.shiftKey) {
      // to-do
    }
  }
}

function verticalScrollbarSet() {
  const { table, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  verticalScrollbar.set(height, table.rowTotalHeight());
}

function horizontalScrollbarSet() {
  const { table, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  horizontalScrollbar.set(width, table.colTotalWidth());
}

function verticalScrollbarMove(distance) {
  const { table, selector } = this;
  table.scroll({ y: distance }, (d) => {
    selector.addTop(-d);
  });
}

function horizontalScrollbarMove(distance) {
  const { table, selector } = this;
  table.scroll({ x: distance }, (d) => {
    selector.addLeft(-d);
  });
}

function rowResizerFinished(cRect, distance) {
  const { ri, height } = cRect;
  const { table, selector } = this;
  table.setRowHeight(ri - 1, distance);
  selector.addTopOrHeight(ri, distance - height);
  verticalScrollbarSet.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci, width } = cRect;
  const { table, selector } = this;
  table.setColWidth(ci - 1, distance);
  selector.addLeftOrWidth(ci, distance - width);
  horizontalScrollbarSet.call(this);
}

function sheetReset() {
  const {
    tableEl, overlayerEl, overlayerCEl,
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset(tOffset);
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
}

function sheetInitEvents() {
  const {
    overlayerEl, rowResizer, colResizer, verticalScrollbar, horizontalScrollbar,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      overlayerMousedown.call(this, evt);
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

  bind(window, 'resize', () => {
    this.reload();
  });
}

export default class Sheet {
  constructor(targetEl, options = {}) {
    this.el = h('div', 'xss-sheet');
    targetEl.appendChild(this.el.el);
    // console.log('elRect:', elRect);
    const {
      row, col, style, formulas, view,
    } = options;
    this.view = view;
    this.col = col;
    this.row = row;
    // table
    this.tableEl = h('canvas', 'xss-table');
    this.table = new Table(this.tableEl.el, row, col, style, _formulas(formulas));
    // resizer
    this.rowResizer = new Resizer(false, row.height);
    this.colResizer = new Resizer(true, col.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // selector
    this.selector = new Selector();
    this.overlayerEl = h('div', 'xss-overlayer')
      .children(
        this.overlayerCEl = h('div', 'xss-overlayer-content')
          .children(
            this.selector.el,
          ),
      );
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
    );
    sheetInitEvents.call(this);
    sheetReset.call(this);
  }

  loadData(data) {
    const { table } = this;
    table.setData(data);
    table.render();
  }

  reload() {
    sheetReset.call(this);
    this.table.render();
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
