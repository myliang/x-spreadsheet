/* global window */
import { Element, h } from './element';
import { bind } from '../event';

export default class Dropdown extends Element {
  constructor(title, width, showArrow, placement, ...children) {
    super('div', `xss-dropdown ${placement}`);
    this.title = title;
    this.change = () => {};
    if (typeof title === 'string') {
      this.title = h('div', 'xss-dropdown-title').child(title);
    } else if (showArrow) {
      this.title.addClass('arrow-left');
    }
    this.contentEl = h('div', 'xss-dropdown-content')
      .children(...children)
      .css('width', width)
      .hide();

    this.headerEl = h('div', 'xss-dropdown-header');
    this.headerEl.on('click', () => {
      this.parent().active();
      this.contentEl.show();
    }).children(
      this.title,
      showArrow ? h('div', 'xss-icon arrow-right').child(
        h('div', 'xss-icon-img arrow-down'),
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

  hide() {
    this.parent().active(false);
    this.contentEl.hide();
  }
}
