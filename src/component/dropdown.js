/* global window */
import { Element, h } from './element';
import { bind } from '../event';

export default class Dropdown extends Element {
  constructor(title, width, showArrow, ...children) {
    super('div', 'xss-dropdown');
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
    this.children(
      h('div', 'xss-dropdown-header')
        .on('click', () => this.contentEl.show())
        .children(
          this.title,
          showArrow ? h('div', 'xss-icon arrow-right').child(
            h('div', 'xss-icon-img arrow-down'),
          ) : '',
        ),
      this.contentEl,
    );
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
    this.contentEl.hide();
  }
}
