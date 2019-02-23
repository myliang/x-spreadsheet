export default class Clipboard {
  constructor() {
    this.range = null; // CellRange
    this.state = 'clear';
  }

  copy(cellRange) {
    this.range = cellRange;
    this.state = 'copy';
    return this;
  }

  cut(cellRange) {
    this.range = cellRange;
    this.state = 'cut';
    return this;
  }

  isCopy() {
    return this.state === 'copy';
  }

  isCut() {
    return this.state === 'cut';
  }

  isClear() {
    return this.state === 'clear';
  }

  clear() {
    this.range = null;
    this.state = 'clear';
  }
}
