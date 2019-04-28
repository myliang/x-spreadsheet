import { h } from './element';
import Button from './button';
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

function buildFilterBody(items) {
  const { filterbEl, filterValues } = this;
  filterbEl.html('');
  const itemKeys = Object.keys(items);
  itemKeys.forEach((it, index) => {
    const cnt = items[it];
    const active = filterValues.includes(it) ? 'checked' : '';
    filterbEl.child(h('div', `${cssPrefix}-item state ${active}`)
      .on('click.stop', () => this.filterClick(index, it))
      .children(it === '' ? t('filter.empty') : it, h('div', 'label').html(`(${cnt})`)));
  });
}

function resetFilterHeader() {
  const { filterhEl, filterValues, values } = this;
  filterhEl.html(`${filterValues.length} / ${values.length}`);
  filterhEl.checked(filterValues.length === values.length);
}

export default class SortFilter {
  constructor() {
    this.filterbEl = h('div', `${cssPrefix}-body`);
    this.filterhEl = h('div', `${cssPrefix}-header state`).on('click.stop', () => this.filterClick(0, 'all'));
    this.el = h('div', `${cssPrefix}-sort-filter`).children(
      this.sortAscEl = buildSortItem.call(this, 'asc'),
      this.sortDescEl = buildSortItem.call(this, 'desc'),
      buildMenu('divider'),
      h('div', `${cssPrefix}-filter`).children(
        this.filterhEl,
        this.filterbEl,
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('ok', 'primary').on('click', () => this.btnClick('ok')),
      ),
    ).hide();
    // this.setFilters(['test1', 'test2', 'text3']);
    this.ci = null;
    this.sortDesc = null;
    this.values = null;
    this.filterValues = [];
  }

  btnClick(it) {
    if (it === 'ok') {
      const { ci, sort, filterValues } = this;
      if (this.ok) {
        this.ok(ci, sort, 'in', filterValues);
      }
    }
    this.hide();
  }

  itemClick(it) {
    // console.log('it:', it);
    this.sort = it;
    const { sortAscEl, sortDescEl } = this;
    sortAscEl.checked(it === 'asc');
    sortDescEl.checked(it === 'desc');
  }

  filterClick(index, it) {
    // console.log('index:', index, it);
    const { filterbEl, filterValues, values } = this;
    const children = filterbEl.children();
    if (it === 'all') {
      if (children.length === filterValues.length) {
        this.filterValues = [];
        children.forEach(i => h(i).checked(false));
      } else {
        this.filterValues = Array.from(values);
        children.forEach(i => h(i).checked(true));
      }
    } else {
      const checked = h(children[index]).toggle('checked');
      if (checked) {
        filterValues.push(it);
      } else {
        filterValues.splice(filterValues.findIndex(i => i === it), 1);
      }
    }
    resetFilterHeader.call(this);
  }

  // v: autoFilter
  // items: {value: cnt}
  // sort { ci, order }
  set(ci, items, filter, sort) {
    this.ci = ci;
    const { sortAscEl, sortDescEl } = this;
    if (sort !== null) {
      this.sort = sort.order;
      sortAscEl.checked(sort.asc());
      sortDescEl.checked(sort.desc());
    } else {
      this.sortDesc = null;
      sortAscEl.checked(false);
      sortDescEl.checked(false);
    }
    // this.setFilters(items, filter);
    this.values = Object.keys(items);
    this.filterValues = filter ? Array.from(filter.value) : Object.keys(items);
    buildFilterBody.call(this, items, filter);
    resetFilterHeader.call(this);
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
