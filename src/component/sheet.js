/* global window */
import { h } from './element';
import { bind } from '../event';
import Resizer from './resizer';
import Table from './table';
import { formulas as _formulas } from '../formula';

function tableMousemove(evt) {
  // console.log('evt.buttons: ', evt.buttons);
  if (evt.buttons !== 0) return;
  const {
    table, rowResizer, colResizer, tableEl,
  } = this;
  const tRect = tableEl.box();
  const cRect = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY);
  // console.log('ri:', cRect.ri, ', ci:', cRect.ci);
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

export default class Sheet {
  constructor(targetEl, options = {}) {
    const tRect = targetEl.getBoundingClientRect();
    this.target = targetEl;
    const {
      row, col, style, formulas,
    } = options;
    this.tableEl = h('canvas', 'xss-table');
    this.tableEl
      .attr({ width: tRect.width, height: tRect.height })
      .on('mousemove', (evt) => {
        tableMousemove.call(this, evt);
      });
    this.rowResizer = new Resizer(false, row.height);
    this.colResizer = new Resizer(true, 60);
    this.rootEl = h('div', 'xss-sheet').children(
      this.tableEl,
      this.rowResizer.el,
      this.colResizer.el,
    );
    targetEl.appendChild(this.rootEl.el);
    this.table = new Table(this.tableEl.el, row, col, style, _formulas(formulas));
    // resizer finished callback
    this.rowResizer.finishedFn = (cRect, distance) => {
      const { ri } = cRect;
      this.table.setRowHeight(ri - 1, distance);
    };
    this.colResizer.finishedFn = (cRect, distance) => {
      const { ci } = cRect;
      this.table.setColWidth(ci - 1, distance);
    };
    bind(window, 'resize', () => {
      this.reload();
    });
  }

  loadData(data) {
    const { table } = this;
    table.setData(data);
    table.render();
  }

  reload() {
    const {
      target, tableEl, table,
    } = this;
    const tRect = target.getBoundingClientRect();
    tableEl.attr({
      width: tRect.width,
      height: tRect.height,
    });
    table.render();
  }
}
