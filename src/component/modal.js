/* global document */
import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';

export default class Modal {
  constructor(title, content, width = '500px') {
    this.title = title;
    this.el = h('div', `${cssPrefix}-modal`).css('width', width).children(
      h('div', `${cssPrefix}-modal-header`).children(
        new Icon('close').on('click.stop', () => this.hide()),
        this.title,
      ),
      h('div', `${cssPrefix}-modal-content`).children(...content),
    ).hide();
  }

  show() {
    const { width, height } = this.el.box();
    const { clientHeight, clientWidth } = document.documentElement;
    this.el.offset({
      left: (clientWidth - width) / 2,
      top: (clientHeight - height) / 3,
    }).show();
  }

  hide() {
    this.el.hide();
  }
}
