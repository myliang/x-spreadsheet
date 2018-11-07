/* global window */
import { h } from './element';
import { bind } from '../event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Table from './table';
import { formulas as _formulas } from '../formula';

// private methods
function tableMousemove(evt) {
  // console.log('evt.buttons: ', evt.buttons);
  if (evt.buttons !== 0) return;
  const {
    table, rowResizer, colResizer, tableEl,
  } = this;
  const tRect = tableEl.box();
  const cRect = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY);
  // console.log('cRect:', cRect);
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

function verticalScrollbarSet() {
  const {
    table, verticalScrollbar, view, row,
  } = this;
  verticalScrollbar.set(view.height() - row.height, table.rowTotalHeight());
}

function horizontalScrollbarSet() {
  const {
    table, horizontalScrollbar, el, col,
  } = this;
  horizontalScrollbar.set(el.box().width - col.indexWidth, table.colTotalWidth());
}

function verticalScrollbarMove(distance) {
  const { table } = this;
  table.scroll({ y: distance });
}

function horizontalScrollbarMove(distance) {
  const { table } = this;
  table.scroll({ x: distance });
}

function rowResizerFinished(cRect, distance) {
  const { ri } = cRect;
  const { table } = this;
  table.setRowHeight(ri - 1, distance);
  verticalScrollbarSet.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci } = cRect;
  const { table } = this;
  table.setColWidth(ci - 1, distance);
  horizontalScrollbarSet.call(this);
}

function sheetReset() {
  const {
    el, tableEl, view,
  } = this;
  tableEl.attr({
    width: el.box().width,
    height: view.height(),
  });
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
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
    this.tableEl = h('canvas', 'xss-table')
      .on('mousemove', (evt) => {
        tableMousemove.call(this, evt);
      });
    this.table = new Table(this.tableEl.el, row, col, style, _formulas(formulas));
    // resizer
    this.rowResizer = new Resizer(false, row.height);
    this.colResizer = new Resizer(true, col.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // root element
    this.el.children(
      this.tableEl,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
    );
    // resizer finished callback
    this.rowResizer.finishedFn = (cRect, distance) => {
      rowResizerFinished.call(this, cRect, distance);
    };
    this.colResizer.finishedFn = (cRect, distance) => {
      colResizerFinished.call(this, cRect, distance);
    };
    // scrollbar move callback
    this.verticalScrollbar.moveFn = (distance, evt) => {
      verticalScrollbarMove.call(this, distance, evt);
    };
    this.horizontalScrollbar.moveFn = (distance, evt) => {
      horizontalScrollbarMove.call(this, distance, evt);
    };
    bind(window, 'resize', () => {
      this.reload();
    });
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
}
