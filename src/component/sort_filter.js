import { h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';
import { t } from '../locale/locale';

function buildMenu(clsName) {
  return h('div', `${cssPrefix}-item ${clsName}`);
}

export default class SortFilter {
  constructor() {
    let items = ['asc', 'desc'];
    items = items.map(it => buildMenu('state').child(t(`sort.${it}`))
      .on('click.stop', () => this.itemClick(it)));
    items.push(buildMenu('divider'));
    this.el = h('div', `${cssPrefix}-sort-filter`).children(
      ...items,
    ).hide();
  }

  itemClick() {
    this.hide();
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
