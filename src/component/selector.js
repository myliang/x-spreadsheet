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
  constructor(data) {
    this.data = data;
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
    this.el = h('div', 'xss-selectors')
      .children(
        this.tl.el,
        this.t.el,
        this.l.el,
        this.br.el,
      ).hide();

    startZIndex += 1;
  }

  hide() {
    this.el.hide();
  }

  resetOffset() {
    const {
      data, tl, t, l, br,
    } = this;
    const freezeHeight = data.freezeTotalHeight();
    const freezeWidth = data.freezeTotalWidth();
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

  setAreaOffset(offset) {
    // console.log('offset:', offset);
    this.areaOffset = offset;
    this.setAllAreaOffset();
    this.resetOffset();
  }

  setBRTAreaOffset(offset) {
    this.areaOffset = offset;
    this.setBRAreaOffset();
    this.setTAreaOffset();
    this.resetOffset();
  }

  setBRLAreaOffset(offset) {
    this.areaOffset = offset;
    this.setBRAreaOffset();
    this.setLAreaOffset();
    this.resetOffset();
  }

  set(indexes, offset) {
    this.indexes = indexes;
    this.moveIndexes = indexes;
    this.sIndexes = indexes;
    this.eIndexes = indexes;
    this.setAreaOffset(offset);
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
    this.areaOffset = getOffset(this.sIndexes, this.eIndexes);
    this.setAllAreaOffset();
  }

  setAllAreaOffset() {
    this.setBRAreaOffset();
    this.setTLAreaOffset();
    this.setTAreaOffset();
    this.setLAreaOffset();
  }

  setBRAreaOffset() {
    if (this.areaOffset !== null) {
      const { data } = this;
      const {
        left, top, width, height, scroll, l, t,
      } = this.areaOffset;
      const ftwidth = data.freezeTotalWidth();
      const ftheight = data.freezeTotalHeight();
      let left0 = left - ftwidth;
      if (ftwidth > l) left0 -= scroll.x;
      let top0 = top - ftheight;
      if (ftheight > t) top0 -= scroll.y;
      this.br.setAreaOffset({
        left: left0,
        top: top0,
        width,
        height,
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
      const { data } = this;
      const {
        left, width, height, l, t, scroll,
      } = this.areaOffset;
      const ftwidth = data.freezeTotalWidth();
      let left0 = left - ftwidth;
      if (ftwidth > l) left0 -= scroll.x;
      // console.log('ftwdith:', ftwidth, ', l:', l, ', top:', top, ', t', t);
      this.t.setAreaOffset({
        left: left0, top: t, width, height,
      });
    }
  }

  setLAreaOffset() {
    if (this.areaOffset !== null) {
      const { data } = this;
      const {
        top, width, height, l, t, scroll,
      } = this.areaOffset;
      const ftheight = data.freezeTotalHeight();
      let top0 = top - ftheight;
      // console.log('ftheight:', ftheight, ', t:', t);
      if (ftheight > t) top0 -= scroll.y;
      this.l.setAreaOffset({
        left: l, top: top0, width, height,
      });
    }
  }
}
