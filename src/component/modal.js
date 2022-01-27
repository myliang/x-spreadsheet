/* global document */
/* global window */
import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';
import { bind, unbind } from './event';

export default class Modal {
  constructor(title, content, width = '600px', dimmed = true, draggable = false) {
    this.title = title;
    const header = h('div', `${cssPrefix}-modal-header`).children(
      new Icon('close').on('click.stop', () => this.hide()),
      this.title,
    );
    this.el = h('div', `${cssPrefix}-modal`).css('width', width).children(
      header,
      h('div', `${cssPrefix}-modal-content`).children(...content),
    ).hide();
    if (draggable) {
      header.on('mousedown', (e) => {
        const { left, top } = window.getComputedStyle(this.el.el);
        const offsetX = e.clientX - parseInt(left, 10);
        const offsetY = e.clientY - parseInt(top, 10);

        const mouseMoveHandler = (evt) => {
          const positionTop = evt.clientY - offsetY;
          const positionLeft = evt.clientX - offsetX;
          this.el.css({ top: `${positionTop <= 0 ? 0 : positionTop}px`, bottom: 'auto' });
          this.el.css({ left: `${positionLeft <= 0 ? 0 : positionLeft}px`, right: 'auto' });
          if (window.innerWidth - parseInt(window.getComputedStyle(this.el.el).left, 10)
            < this.el.el.clientWidth) {
            this.el.css({ right: 0, left: 'auto' });
          }
          if (window.innerHeight - parseInt(window.getComputedStyle(this.el.el).top, 10)
            < this.el.el.clientHeight) {
            this.el.css({ bottom: 0, top: 'auto' });
          }
        };

        function reset() {
          unbind(window, 'mousemove', mouseMoveHandler);
          unbind(window, 'mouseup', reset);
        }

        bind(window, 'mousemove', mouseMoveHandler);
        bind(window, 'mouseup', reset);
      });
    }
    this.dimmed = dimmed;
  }

  show() {
    // dimmer
    if (this.dimmed) {
      this.dimmer = h('div', `${cssPrefix}-dimmer active`);
      document.body.appendChild(this.dimmer.el);
    }
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
    bind(window, 'keydown', window.xkeydownEsc);
  }

  hide() {
    this.el.hide();
    if (this.dimmed) {
      document.body.removeChild(this.dimmer.el);
    }
    unbind(window, 'keydown', window.xkeydownEsc);
    delete window.xkeydownEsc;
  }
}
