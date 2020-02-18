import { cssPrefix } from '../../config';
import tooltip from '../tooltip';
import { h } from '../element';
import { t } from '../../locale/locale';

export default class Item {
  // tooltip
  // tag: the subclass type
  // shortcut: shortcut key
  constructor(tag, shortcut, value) {
    this.tip = t(`toolbar.${tag.replace(/-[a-z]/g, c => c[1].toUpperCase())}`);
    if (shortcut) this.tip += ` (${shortcut})`;
    this.tag = tag;
    this.shortcut = shortcut;
    this.value = value;
    this.el = this.element();
    this.change = () => {};
  }

  element() {
    const { tip } = this;
    return h('div', `${cssPrefix}-toolbar-btn`)
      .on('mouseenter', (evt) => {
        tooltip(tip, evt.target);
      })
      .attr('data-tooltip', tip);
  }

  setState() {}
}
