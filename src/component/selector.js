import { h } from './element';

const selectorHeightBorderWidth = 2 * 2 - 1;
let startZIndex = 10;

class SelectorElement {
  constructor() {
    this.cornerEl = h('div', 'xss-selector-corner');
    this.areaEl = h('div', 'xss-selector-area')
      .child(this.cornerEl).hide();
    this.el = h('div', 'xss-selector')
      .css('z-index', `${startZIndex}`)
      .on('click.stop', () => {})
      .child(this.areaEl)
      .hide();
    startZIndex += 1;
  }

  setOffset(v) {
    this.el.offset(v).show();
    return this;
  }

  hide() {
    this.el.hide();
    return this;
  }

  setAreaOffset(v) {
    const {
      left, top, width, height,
    } = v;
    this.areaEl.offset({
      width: width - selectorHeightBorderWidth,
      height: height - selectorHeightBorderWidth,
      left,
      top,
    }).show();
  }
}

export default class Selector {
  constructor() {
    this.br = new SelectorElement();
    this.t = new SelectorElement();
    this.l = new SelectorElement();
    this.tl = new SelectorElement();
    this.br.el.show();
    this.offset = null;
    this.areaOffset = null;
    this.indexes = null;
    this.sIndexes = null;
    this.eIndexes = null;
    this.freezeHeight = 0;
    this.freezeWidth = 0;

    startZIndex += 1;
  }

  elements() {
    const {
      tl, t, l, br,
    } = this;
    return [tl.el, t.el, l.el, br.el];
  }

  reset() {
    const {
      freezeHeight, freezeWidth, tl, t, l, br,
    } = this;
    if (freezeHeight > 0 || freezeWidth > 0) {
      tl.setOffset({ width: freezeWidth, height: freezeHeight });
      t.setOffset({ left: freezeWidth, height: freezeHeight });
      l.setOffset({ top: freezeHeight, width: freezeWidth });
      br.setOffset({ left: freezeWidth, top: freezeHeight });
    } else {
      tl.hide();
      t.hide();
      l.hide();
      br.setOffset({ left: 0, top: 0 });
    }
  }

  setFreezeLengths(width, height) {
    if (this.freezeHeight !== height || this.freezeWidth !== width) {
      this.freezeHeight = height;
      this.freezeWidth = width;
      this.reset();
      this.setAllAreaOffset();
    }
    return this;
  }

  addLeft(left) {
    const { areaOffset, indexes } = this;
    if (indexes) {
      areaOffset.left += left;
      areaOffset.l += left;
      this.setAreaOffset();
      this.setTAreaOffset();
    }
    return this;
  }

  addTop(top) {
    const { areaOffset, indexes } = this;
    if (indexes) {
      areaOffset.top += top;
      areaOffset.t += top;
      this.setAreaOffset();
      this.setLAreaOffset();
    }
    return this;
  }

  addLeftOrWidth(index, v) {
    const {
      areaOffset, indexes, sIndexes, eIndexes,
    } = this;
    if (indexes) {
      const [, sci] = sIndexes;
      const [, eci] = eIndexes;
      // console.log(':index:', index, sci, eci);
      if (index < sci) {
        areaOffset.left += v;
        areaOffset.l += v;
      } else if (sci <= index && index <= eci) {
        areaOffset.width += v;
      }
      this.setAreaOffset();
      this.setTAreaOffset();
    }
    return this;
  }

  addTopOrHeight(index, v) {
    const {
      areaOffset, indexes, sIndexes, eIndexes,
    } = this;
    if (indexes) {
      const [sri] = sIndexes;
      const [eri] = eIndexes;
      if (index < sri) {
        areaOffset.top += v;
        areaOffset.t += v;
      } else if (sri <= index && index <= eri) {
        areaOffset.height += v;
      }
      this.setAreaOffset();
      this.setLAreaOffset();
    }
    return this;
  }

  set(indexes, offset) {
    this.indexes = indexes;
    this.moveIndexes = indexes;
    this.sIndexes = indexes;
    this.eIndexes = indexes;
    this.areaOffset = offset;
    this.setAllAreaOffset();
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
    this.areaOffset = getOffset(this.sIndexes, this.eIndexes);
    this.setAllAreaOffset();
  }

  setAllAreaOffset() {
    this.setAreaOffset();
    this.setTLAreaOffset();
    this.setTAreaOffset();
    this.setLAreaOffset();
  }

  setAreaOffset() {
    if (this.areaOffset !== null) {
      const { freezeWidth, freezeHeight } = this;
      const {
        left, top, width, height,
      } = this.areaOffset;
      // console.log('l:', l, ', t:', t);
      this.br.setAreaOffset({
        left: left - freezeWidth, top: top - freezeHeight, width, height,
      });
    }
  }

  setTLAreaOffset() {
    if (this.areaOffset !== null) {
      const {
        l, t, width, height,
      } = this.areaOffset;
      this.tl.setAreaOffset({
        left: l, top: t, width, height,
      });
    }
  }

  setTAreaOffset() {
    if (this.areaOffset !== null) {
      const { freezeWidth } = this;
      const {
        l, t, width, height,
      } = this.areaOffset;
      this.t.setAreaOffset({
        left: l - freezeWidth, top: t, width, height,
      });
    }
  }

  setLAreaOffset() {
    if (this.areaOffset !== null) {
      const { freezeHeight } = this;
      const {
        l, t, width, height,
      } = this.areaOffset;
      this.l.setAreaOffset({
        left: l, top: t - freezeHeight, width, height,
      });
    }
  }
}
