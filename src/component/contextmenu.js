import { h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';
import { tf } from '../locale/locale';

const menuItems = [
  { key: 'copy', title: tf('contextmenu.copy'), label: 'Ctrl+C' },
  { key: 'cut', title: tf('contextmenu.cut'), label: 'Ctrl+X' },
  { key: 'paste', title: tf('contextmenu.paste'), label: 'Ctrl+V' },
  { key: 'paste-value', title: tf('contextmenu.pasteValue'), label: 'Ctrl+Shift+V' },
  { key: 'paste-format', title: tf('contextmenu.pasteFormat'), label: 'Ctrl+Alt+V' },
  { key: 'divider', feature: 'Insert' },
  { key: 'insert-row', title: tf('contextmenu.insertRow'), feature: 'Insert' },
  { key: 'insert-column', title: tf('contextmenu.insertColumn'), feature: 'Insert' },
  { key: 'divider', feature: 'Delete' },
  { key: 'delete-row', title: tf('contextmenu.deleteRow'), feature: 'Delete' },
  { key: 'delete-column', title: tf('contextmenu.deleteColumn'), feature: 'Delete' },
  { key: 'delete-cell-text', title: tf('contextmenu.deleteCellText'), feature: 'Delete' },
  { key: 'hide', title: tf('contextmenu.hide'), feature: 'Hide' },
  { key: 'divider', feature: 'Validation' },
  { key: 'validation', title: tf('contextmenu.validation'), feature: 'Validation' },
  { key: 'divider', feature: 'CellPrintable' },
  { key: 'cell-printable', title: tf('contextmenu.cellprintable'), feature: 'CellPrintable' },
  { key: 'cell-non-printable', title: tf('contextmenu.cellnonprintable'), feature: 'CellPrintable' },
  { key: 'divider', feature: 'CellEditable' },
  { key: 'cell-editable', title: tf('contextmenu.celleditable'), feature: 'CellEditable' },
  { key: 'cell-non-editable', title: tf('contextmenu.cellnoneditable'), feature: 'CellEditable' },
];

function buildMenuItem(item) {
  if (item.key === 'divider') {
    return h('div', `${cssPrefix}-item divider`);
  }
  const el = h('div', `${cssPrefix}-item`)
    .on('click', () => {
      this.itemClick(item.key);
      this.hide();
    })
    .children(
      item.title(),
      h('div', 'label').child(item.label || ''),
    );
  if (item.key === 'hide') {
    this.hideEl = el;
  }
  return el;
}

function buildMenu() {
  return menuItems
    .filter(it => !(it.feature && !this.data.settings.features[it.feature]))
    .map(it => buildMenuItem.call(this, it));
}

export default class ContextMenu {
  constructor(data, viewFn, isHide = false) {
    this.data = data;
    this.hideEl = null;
    this.menuItems = buildMenu.call(this);
    this.el = h('div', `${cssPrefix}-contextmenu`)
      .children(...this.menuItems)
      .hide();
    this.viewFn = viewFn;
    this.itemClick = () => {};
    this.isHide = isHide;
    this.setMode('range');
  }

  // row-col: the whole rows or the whole cols
  // range: select range
  setMode(mode) {
    if (this.hideEl) {
      if (mode === 'row-col') {
        this.hideEl.show();
      } else {
        this.hideEl.hide();
      }
    }
  }

  hide() {
    const { el } = this;
    el.hide();
    unbindClickoutside(el);
  }

  setPosition(x, y) {
    if (this.isHide) return;
    const { el } = this;
    const { width } = el.show().offset();
    const view = this.viewFn();
    const vhf = view.height / 2;
    let left = x;
    if (view.width - x <= width) {
      left -= width;
    }
    el.css('left', `${left}px`);
    if (y > vhf) {
      el.css('bottom', `${view.height - y}px`)
        .css('max-height', `${y}px`)
        .css('top', 'auto');
    } else {
      el.css('top', `${y}px`)
        .css('max-height', `${view.height - y}px`)
        .css('bottom', 'auto');
    }
    bindClickoutside(el);
  }
}
