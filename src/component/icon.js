import { Element, h } from './element';

export default class Icon extends Element {
  constructor(name) {
    super('div', 'xss-icon');
    this.iconNameEl = h('div', `xss-icon-img ${name}`);
    this.child(this.iconNameEl);
  }

  setName(name) {
    this.iconNameEl.className(`xss-icon-img ${name}`);
  }
}
