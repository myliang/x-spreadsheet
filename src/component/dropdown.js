import { Element, h } from './element';

export default class Dropdown extends Element {
  constructor(title, width, ...children) {
    super('div', 'xss-dropdown');
    this.contentEl = h('div', 'xss-dropdown-content')
      .children(children)
      .on('click', evt => this.toggleHandler(evt))
      .css('width', width)
      .hide();
    this.children(
      h('div', 'xss-dropdown-header').children(title),
      this.contentEl,
    );
  }

  toggleHandler() {
    this.contentEl.toggle();
  }
}
