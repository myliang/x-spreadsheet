import { h } from './element';

export default class Suggest {
  constructor(items, width, itemClick) {
    this.items = items;
    this.width = width;
    this.el = h('div', 'xss-suggest')
      .css('width', `${this.width}px`).hide();
    this.itemClick = itemClick
  }

  setOffset(v) {
    this.el.offset(v);
  }

  hide() {
    this.el.hide();
  }

  search(word) {
    let { items } = this;
    if (!/^\s*$/.test(word)) {
      items = items.filter(it => it.key.startsWith(word.toUpperCase()));
    }
    items = items.map(it => {
      const item = h('div', 'xss-item')
        .child(it.key)
        .on('click', () => {
          this.itemClick(it);
          this.hide();
        });
      item.child(h('div', 'label').html(it.title || it.label));
      return item;
    });
    if (items.length <= 0) {
      // items = [h('div', 'xss-item').child('No result')];
      return;
    }
    // console.log('items:', items);
    this.el.html('').children(...items).show();
  }
}

