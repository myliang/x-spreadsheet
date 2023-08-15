import { h } from './element';
import { cssPrefix } from '../config';

export default class Scrollbar {
  constructor(vertical) {
    this.vertical = vertical;
    this.moveFn = null;
    this.el = h('div', `${cssPrefix}-scrollbar ${vertical ? 'vertical' : 'horizontal'}`)
      .child(this.contentEl = h('div', ''))
      .on('mousemove.stop', () => {})
      .on('scroll.stop', (evt) => {
        const { scrollTop, scrollLeft } = evt.target;
        // console.log('scrollTop:', scrollTop);
        if (this.moveFn) {
          this.moveFn(this.vertical ? scrollTop : scrollLeft, evt);
        }
        // console.log('evt:::', evt);
      });
  }

  move(v) {
    this.el.scroll(v);
    return this;
  }

  scroll() {
    return this.el.scroll();
  }

  set(distance, contentDistance) {
    const d = distance - 1;
    // console.log('distance:', distance, ', contentDistance:', contentDistance);
    if (contentDistance > d) {
      const cssKey = this.vertical ? 'height' : 'width';
      // console.log('d:', d);
      this.el.css(cssKey, `${d - 15}px`).show();
      this.contentEl
        .css(this.vertical ? 'width' : 'height', '1px')
        .css(cssKey, `${contentDistance}px`);
    } else {
      this.el.hide();
    }
    return this;
  }
}
