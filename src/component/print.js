import { h } from './element';
import { cssPrefix } from '../config';
import Button from './button';

// resolution: 72 => 595 x 842
// 150 => 1240 x 1754
// 200 => 1654 x 2339
// 300 => 2479 x 3508
// 72 * cm / 2.54 , 72 * cm / 2.54
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

function btnClick(type) {
}

export default class Print {
  constructor(data) {
    this.data = data;
    this.el = h('div', `${cssPrefix}-print`)
      .children(
        h('div', `${cssPrefix}-print-bar`)
          .children(
            h('div', '-title').child('Print settings'),
            h('div', '-right').children(
              h('div', `${cssPrefix}-buttons`).children(
                new Button('cancel').on('click', btnClick.bind(this, 'cancel')),
                new Button('next', 'primary').on('click', btnClick.bind(this, 'next')),
              ),
            ),
          ),
        h('div', `${cssPrefix}-print-content`)
          .children(
            this.contentEl = h('div', '-content'),
            h('div', '-sider'),
          ),
      ).hide();
    this.preview();
  }

  preview() {
    const { data } = this;
    const { eri, eci, w, h } = data.contentRange();
    console.log('eri:', eri, eci, w, h);
  }
}
