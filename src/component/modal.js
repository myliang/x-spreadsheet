import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';

export default class Modal {
  constructor(title, content) {
    this.title = title;
    this.el = h('div', `${cssPrefix}-modal`).children(
      h('div', `${cssPrefix}-modal-header`).children(
        new Icon('close'),
        this.title,
      ),
      h('div', `${cssPrefix}-modal-content`).html(content),
    );
  }

  show() {
    this.el.show();
  }

  hide() {
    this.el.hide();
  }
}
