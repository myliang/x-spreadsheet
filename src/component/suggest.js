/* global window */
import { h } from './element';
import { bind } from '../event';

function inputMovePrev() {
  const { filterItems } = this;
  if (filterItems.length <= 0) return;
  filterItems[this.itemIndex].toggle();
  this.itemIndex -= 1;
  if (this.itemIndex < 0) {
    this.itemIndex = filterItems.length - 1;
  }
  filterItems[this.itemIndex].toggle();
}

function inputMoveNext() {
  const { filterItems } = this;
  if (filterItems.length <= 0) return;
  filterItems[this.itemIndex].toggle();
  this.itemIndex += 1;
  if (this.itemIndex > filterItems.length - 1) {
    this.itemIndex = 0;
  }
  filterItems[this.itemIndex].toggle();
}

function inputEnter() {
  const { filterItems } = this;
  if (filterItems.length <= 0) return;
  filterItems[this.itemIndex].el.click();
  this.hide();
}

function inputKeydownHandler(evt) {
  const { keyCode } = evt;
  switch (keyCode) {
    case 37: // left
      evt.stopPropagation();
      break;
    case 38: // up
      inputMovePrev.call(this);
      evt.preventDefault();
      evt.stopPropagation();
      break;
    case 39: // right
      evt.stopPropagation();
      break;
    case 40: // down
      inputMoveNext.call(this);
      evt.stopPropagation();
      break;
    case 13: // enter
      inputEnter.call(this);
      evt.preventDefault();
      break;
    default:
      break;
  }
}

export default class Suggest {
  constructor(items, width, itemClick) {
    this.filterItems = [];
    this.items = items;
    this.width = width;
    this.el = h('div', 'xss-suggest')
      .css('width', `${this.width}px`).hide();
    this.itemClick = itemClick;
    this.itemIndex = 0;
  }

  setOffset(v) {
    this.el.offset(v);
  }

  hide() {
    this.filterItems = [];
    this.el.hide();
  }

  search(word) {
    let { items } = this;
    if (!/^\s*$/.test(word)) {
      items = items.filter(it => it.key.startsWith(word.toUpperCase()));
    }
    items = items.map((it) => {
      const item = h('div', 'xss-item')
        .child(it.key)
        .on('click', () => {
          this.itemClick(it);
          this.hide();
        });
      item.child(h('div', 'label').html(it.title || it.label));
      return item;
    });
    this.filterItems = items;
    if (items.length <= 0) {
      // items = [h('div', 'xss-item').child('No result')];
      return;
    }
    items[0].toggle();
    // console.log('items:', items);
    this.el.html('').children(...items).show();
  }

  bindInputEvents(input) {
    input.on('keydown', evt => inputKeydownHandler.call(this, evt));
    bind(window, 'click', (evt) => {
      if (this.el.contains(evt.target)) return;
      this.hide();
    });
  }
}
