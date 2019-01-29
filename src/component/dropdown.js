/* global window */
import { Element, h } from './element';
import { bind } from '../event';
import { cssPrefix } from '../config';

export default class Dropdown extends Element {
  constructor(title, width, showArrow, placement, ...children) {
    super('div', `${cssPrefix}-dropdown ${placement}`);
    this.title = title;
    this.change = () => {};
    if (typeof title === 'string') {
      this.title = h('div', `${cssPrefix}-dropdown-title`).child(title);
    } else if (showArrow) {
      this.title.addClass('arrow-left');
    }
    this.contentEl = h('div', `${cssPrefix}-dropdown-content`)
      .children(...children)
      .css('width', width)
      .hide();

    this.headerEl = h('div', `${cssPrefix}-dropdown-header`);
    this.headerEl.on('click', () => {
      if (this.contentEl.css('display') !== 'block') {
        this.show();
      } else {
        this.hide();
      }
    }).children(
      this.title,
      showArrow ? h('div', `${cssPrefix}-icon arrow-right`).child(
        h('div', `${cssPrefix}-icon-img arrow-down`),
      ) : '',
    );
    this.children(this.headerEl, this.contentEl);
    bind(window, 'click', (evt) => {
      if (this.el.contains(evt.target)) return;
      this.hide();
    });
  }

  setTitle(title) {
    this.title.html(title);
    this.hide();
  }

  show() {
    this.contentEl.show();
    this.parent().active();
  }

  hide() {
    this.parent().active(false);
    this.contentEl.hide();
  }
}
