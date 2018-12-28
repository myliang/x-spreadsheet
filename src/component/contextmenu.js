/* global window */
import { h } from './element';
import { bind } from '../event';

const menuItems = [
  { key: 'copy', title: 'Copy', label: 'Ctrl+C' },
  { key: 'cut', title: 'Cut', label: 'Ctrl+X' },
  { key: 'paste', title: 'Paste', label: 'Ctrl+V' },
  { key: 'paste-value', title: 'Paste values only', label: 'Ctrl+Shift+V' },
  { key: 'paste-format', title: 'Paste format only', label: 'Ctrl+Alt+V' },
  { key: 'divider' },
  { key: 'insert-row', title: 'Insert row' },
  { key: 'insert-column', title: 'Insert column' },
  { key: 'delete-row', title: 'Delete row' },
  { key: 'delete-column', title: 'Delete column' },
];

function buildMenuItem(item) {
  if (item.key === 'divider') {
    return h('div', 'xss-item divider');
  }
  return h('div', 'xss-item')
    .on('click', () => {
      this.itemClick(item.key);
      this.hide();
    })
    .children(
      item.title,
      item.label ? h('div', 'label').child(item.label) : '',
    );
}

function buildMenu() {
  return menuItems.map(it => buildMenuItem.call(this, it));
}

export default class ContextMenu {
  constructor(viewFn) {
    this.el = h('div', 'xss-contextmenu')
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
    const { height } = el.offset();
    const viewHeight = this.viewFn().height;
    let top = y;
    if (y > viewHeight / 2) {
      top -= height;
    }
    el.offset({ left: x, top }).show();
  }
}
