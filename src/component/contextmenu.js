/* global window */
import { h } from './element';
import { bind } from '../event';
import { cssPrefix } from '../config';
import { tf } from '../locale/locale';

const menuItems = [
  { key: 'copy', title: tf('contextmenu.copy'), label: 'Ctrl+C' },
  { key: 'cut', title: tf('contextmenu.cut'), label: 'Ctrl+X' },
  { key: 'paste', title: tf('contextmenu.paste'), label: 'Ctrl+V' },
  { key: 'paste-value', title: tf('contextmenu.pasteValue'), label: 'Ctrl+Shift+V' },
  { key: 'paste-format', title: tf('contextmenu.pasteFormat'), label: 'Ctrl+Alt+V' },
  { key: 'divider' },
  { key: 'insert-row', title: tf('contextmenu.insertRow') },
  { key: 'insert-column', title: tf('contextmenu.insertColumn') },
  { key: 'divider' },
  { key: 'delete-row', title: tf('contextmenu.deleteRow') },
  { key: 'delete-column', title: tf('contextmenu.deleteColumn') },
  { key: 'delete-cell-text', title: tf('contextmenu.deleteCellText') },
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
      item.title(),
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
      // console.log('outside:::', this.el.contains(evt.target));
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
    if (view.height - y <= height) {
      // -1 : firefox bug, focus contextmenu
      top -= height - 1;
    }
    if (view.width - x <= width) {
      // -1 : firefox bug, focus contextmenu
      left -= width - 1;
    }
    el.offset({ left, top });
  }
}
