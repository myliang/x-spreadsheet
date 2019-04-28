import { h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';
import { t } from '../locale/locale';

function buildMenu(clsName) {
  return h('div', `${cssPrefix}-item ${clsName}`);
}

function buildSortItem(it) {
  return buildMenu('state').child(t(`sort.${it}`))
    .on('click.stop', () => this.itemClick(it));
}

export default class SortFilter {
  constructor() {
    this.filterbEl = h('div', `${cssPrefix}-body`);
    this.filterhEl = h('div', `${cssPrefix}-header state`);
    this.el = h('div', `${cssPrefix}-sort-filter`).children(
      this.sortAscEl = buildSortItem('asc'),
      this.sortDescEl = buildSortItem('desc'),
      buildMenu('divider'),
      h('div', `${cssPrefix}-filter`).children(
        this.filterhEl,
        this.filterbEl,
      ),
    ).hide();
    // this.setFilters(['test1', 'test2', 'text3']);
  }

  itemClick() {
    this.hide();
  }

  // v: autoFilter
  // items: {value: cnt}
  set(items, filter, sort) {
    if (sort !== null) {
      sortAscEl.active(!sort.desc);
      sortDescEl.active(sort.desc);
    }
    this.setFilters(items, filter);
  }

  setFilters(items, filter) {
    const { filterhEl, filterbEl } = this;
    const itemKeys = Object.keys(items);
    filterbEl.html('');
    filterhEl.html(`${filter ? filter.vlength() : '0'} / ${itemKeys.length}`);
    // filterhEl.child(h('div', `${cssPrefix}-item state`).html(items.length));
    itemKeys.forEach(it => {
      const cnt = items[it];
      const active = (filter && filter.contains(it)) ? 'active' : '';
      filterbEl.child(h('div', `${cssPrefix}-item state ${active}`)
        .children(it, h('div', 'label').html(cnt)));
    });
    return this;
  }

  setOffset(v) {
    this.el.offset(v).show();
    let tindex = 1;
    bindClickoutside(this.el, () => {
      if (tindex <= 0) {
        this.hide();
      }
      tindex -= 1;
    });
  }

  show() {
    this.el.show();
  }

  hide() {
    this.el.hide();
    unbindClickoutside(this.el);
  }
}
