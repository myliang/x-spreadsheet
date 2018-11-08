import { h } from './element';
import Selector from './selector';

function clickHandler(evt) {
  console.log('evt:', evt);
}

export default class Overlayer {
  constructor(width, height) {
    this.selector = new Selector();
    this.el = h('div', 'xss-overlayer')
      .offset({ width, height })
      .on('click', evt => clickHandler.call(this, evt))
      .children([
        this.selector.el,
      ]);
  }
}
