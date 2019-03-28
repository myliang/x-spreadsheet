import helper from './helper';

class Cols {
  constructor({
    len, width, indexWidth, minWidth,
  }) {
    this._ = {};
    this.len = len;
    this.width = width;
    this.indexWidth = indexWidth;
    this.minWidth = minWidth;
  }

  setData(d) {
    this._ = d;
  }

  getData() {
    return this._;
  }

  getWidth(i) {
    const col = this._[i];
    if (col && col.width) {
      return col.width;
    }
    return this.width;
  }

  getOrNew(ci) {
    this._[ci] = this._[ci] || {};
    return this._[ci];
  }

  setWidth(ci, width) {
    const col = this.getOrNew(ci);
    col.width = width;
  }

  setStyle(ci, style) {
    const col = this.getOrNew(ci);
    col.style = style;
  }

  sumWidth(min, max) {
    return helper.rangeSum(min, max, i => this.getWidth(i));
  }

  totalWidth() {
    return this.sumWidth(0, this.len);
  }
}

export default {};
export {
  Cols,
};
