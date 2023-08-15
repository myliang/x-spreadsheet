/* global document */
/* global window */
import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';

export default class Modal {
  constructor(event, title, content, width = '600px') {
    this.event = event;
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
    // dimmer
    this.dimmer = h('div', `${cssPrefix}-dimmer active`);
    document.body.appendChild(this.dimmer.el);
    const { width, height } = this.el.show().box();
    const { clientHeight, clientWidth } = document.documentElement;
    this.el.offset({
      left: (clientWidth - width) / 2,
      top: (clientHeight - height) / 3,
    });
    window.xkeydownEsc = (evt) => {
      if (evt.keyCode === 27) {
        this.hide();
      }
    };
    this.event.bind(window, 'keydown', window.xkeydownEsc);
  }

  hide() {
    this.el.hide();
    document.body.removeChild(this.dimmer.el);
    this.event.unbind(window, 'keydown', window.xkeydownEsc);
    delete window.xkeydownEsc;
  }
}
