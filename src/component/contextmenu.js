/* global window */
import { h } from './element';
import { bind } from '../event';
import { cssPrefix } from '../config';

const menuItems = [
  { key: 'copy', title: 'Copy', label: 'Ctrl+C' },
  { key: 'cut', title: 'Cut', label: 'Ctrl+X' },
  { key: 'paste', title: 'Paste', label: 'Ctrl+V' },
  { key: 'paste-value', title: 'Paste values only', label: 'Ctrl+Shift+V' },
  { key: 'paste-format', title: 'Paste format only', label: 'Ctrl+Alt+V' },
  { key: 'divider' },
  { key: 'insert-row', title: 'Insert row' },
  { key: 'insert-column', title: 'Insert column' },
  { key: 'divider' },
  { key: 'delete-row', title: 'Delete row' },
  { key: 'delete-column', title: 'Delete column' },
  { key: 'delete-cell', title: 'Delete cell' },
];

function buildMenuItem(item) {
  if (item.key === 'divider') {
    return h('div', `${cssPrefix}-item divider`);
  }
  return h('div', `${cssPrefix}-item`)
    .on('click', () => {
      this.itemClick(item.key);
      this.hide();
    })
    .children(
      item.title,
      h('div', 'label').child(item.label || ''),
    );
}

function buildMenu() {
  return menuItems.map(it => buildMenuItem.call(this, it));
}

export default class ContextMenu {
  constructor(viewFn) {
    this.el = h('div', `${cssPrefix}-contextmenu`)
      .children(...buildMenu.call(this))
      .hide();
    this.viewFn = viewFn;
    this.itemClick = () => {};
    bind(window, 'click', (evt) => {
      if (this.el.contains(evt.target)) return;
      this.hide();
    });
  }

  hide() {
    this.el.hide();
  }

  setPosition(x, y) {
    const { el } = this;
    const { height, width } = el.show().offset();
    const view = this.viewFn();
    let top = y;
    let left = x;
    // console.log('x:', x, ',y:', y, ',viewH:', viewHeight, ',h:', height);
    if (view.height - y <= height) {
      top -= height;
    }
    if (view.width - x <= width) {
      left -= width;
    }
    el.offset({ left, top });
  }
}
