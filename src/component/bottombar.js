import { h } from './element';
import { cssPrefix } from '../config';

export default class Bottombar {
  constructor(datas) {
    this.datas = datas;
    this.el = h('div', `${cssPrefix}-bottombar`);
  }
}
