import { h } from './element';
import Suggest from './suggest';
import { cssPrefix } from '../config';

export default class FormSelect {
  constructor(item, items, width, change = () => {}) {
    this.item = item;
    this.el = h('div', `${cssPrefix}-form-selector`).css('width', width);
    this.suggest = new Suggest(items.map(it => ({ key: it })), (it) => {
      this.itemClick(it.key);
      change(it.key);
    }, width, this.el);
    this.el.children(
      this.itemEl = h('div', 'input-text').html(item),
      this.suggest.el,
    ).on('click', () => this.show());
  }

  show() {
    this.suggest.search('');
  }

  itemClick(it) {
    this.item = it;
    this.itemEl.html(it);
  }

  val(v) {
    if (v !== undefined) {
      this.itemEl.html(v);
      return this;
    }
    return this.item;
  }
}
