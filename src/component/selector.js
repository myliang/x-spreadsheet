import { h } from './element';

const selectorHeightBorderWidth = 2 * 2 - 1;

export default class Selector {
  constructor() {
    this.cornerEl = h('div', 'xss-selector-corner');
    this.areaEl = h('div', 'xss-selector-area')
      .child(this.cornerEl);
    this.el = h('div', 'xss-selector')
      .on('click.stop', () => {})
      .child(this.areaEl).hide();
    this.offset = null;
    this.indexes = null;
    this.sIndexes = null;
    this.eIndexes = null;
  }

  addLeft(left) {
    const { offset, areaEl, indexes } = this;
    if (indexes) {
      offset.left += left;
      areaEl.offset({ left: offset.left });
    }
    return this;
  }

  addTop(top) {
    const { offset, areaEl, indexes } = this;
    if (indexes) {
      offset.top += top;
      areaEl.offset({ top: offset.top });
    }
    return this;
  }

  addLeftOrWidth(index, v) {
    const {
      offset, indexes, sIndexes, eIndexes,
    } = this;
    if (indexes) {
      const [, sci] = sIndexes;
      const [, eci] = eIndexes;
      // console.log(':index:', index, sci, eci);
      if (index < sci) {
        offset.left += v;
      } else if (sci <= index && index <= eci) {
        offset.width += v;
      }
      this.setAreaOffset();
    }
    return this;
  }

  addTopOrHeight(index, v) {
    const {
      offset, indexes, sIndexes, eIndexes,
    } = this;
    if (indexes) {
      const [sri] = sIndexes;
      const [eri] = eIndexes;
      if (index < sri) {
        offset.top += v;
      } else if (sri <= index && index <= eri) {
        offset.height += v;
      }
      this.setAreaOffset();
    }
    return this;
  }

  set(indexes, offset) {
    this.indexes = indexes;
    this.moveIndexes = indexes;
    this.sIndexes = indexes;
    this.eIndexes = indexes;
    this.offset = offset;
    this.setAreaOffset();
    this.el.show();
  }

  setEnd(nindexes, getOffset) {
    const [ori, oci] = this.indexes;
    const [nri, nci] = nindexes;
    this.sIndexes = [ori, oci];
    this.eIndexes = [nri, nci];
    if (ori >= nri) {
      this.eIndexes[0] = ori;
      this.sIndexes[0] = nri;
    }
    if (oci >= nci) {
      this.eIndexes[1] = oci;
      this.sIndexes[1] = nci;
    }
    // set height, width, left top
    this.offset = getOffset(this.sIndexes, this.eIndexes);
    this.setAreaOffset();
  }

  setAreaOffset() {
    // console.log('offset>>>>>>>', this.offset);
    const {
      left, top, width, height,
    } = this.offset;
    this.areaEl.offset({
      width: width - selectorHeightBorderWidth,
      height: height - selectorHeightBorderWidth,
      left,
      top,
    });
  }
}
