/* global window */

import Align from './align';
import Valign from './valign';
import Autofilter from './autofilter';
import Bold from './bold';
import Italic from './italic';
import Strike from './strike';
import Underline from './underline';
import Border from './border';
import Clearformat from './clearformat';
import Paintformat from './paintformat';
import TextColor from './text_color';
import FillColor from './fill_color';
import FontSize from './font_size';
import Font from './font';
import Format from './format';
import Formula from './formula';
import Freeze from './freeze';
import Merge from './merge';
import Redo from './redo';
import Undo from './undo';
import Print from './print';
import Textwrap from './textwrap';
import More from './more';

import { h } from '../element';
import { cssPrefix } from '../../config';
import { bind } from '../event';
import { Features } from '../../core/features';

function buildDivider() {
  return h('div', `${cssPrefix}-toolbar-divider`);
}

function initBtns2() {
  this.btns2 = [];
  this.items.forEach((it) => {
    if (Array.isArray(it)) {
      it.forEach(({ el }) => {
        const rect = el.box();
        const { marginLeft, marginRight } = el.computedStyle();
        this.btns2.push([el, rect.width + parseInt(marginLeft, 10) + parseInt(marginRight, 10)]);
      });
    } else {
      const rect = it.box();
      const { marginLeft, marginRight } = it.computedStyle();
      this.btns2.push([it, rect.width + parseInt(marginLeft, 10) + parseInt(marginRight, 10)]);
    }
  });
}

function moreResize() {
  const {
    el, btns, moreEl, btns2,
  } = this;
  const { moreBtns, contentEl } = moreEl.dd;
  el.css('width', `${this.widthFn() - 60}px`);
  const elBox = el.box();

  let sumWidth = 160;
  let sumWidth2 = 12;
  const list1 = [];
  const list2 = [];
  btns2.forEach(([it, w], index) => {
    sumWidth += w;
    if (index === btns2.length - 1 || sumWidth < elBox.width) {
      list1.push(it);
    } else {
      sumWidth2 += w;
      list2.push(it);
    }
  });
  btns.html('').children(...list1);
  moreBtns.html('').children(...list2);
  contentEl.css('width', `${sumWidth2}px`);
  if (list2.length > 0) {
    moreEl.show();
  } else {
    moreEl.hide();
  }
}

export default class Toolbar {
  constructor(data, widthFn, isHide = false) {
    this.data = data;
    this.change = () => {};
    this.widthFn = widthFn;
    this.isHide = isHide;
    const style = data.defaultStyle();
    var allItems = [
      [
        [this.undoEl = new Undo(), 'Undo'],
        [this.redoEl = new Redo(), 'Redo'],
        [new Print(), 'Print'],
        [this.paintformatEl = new Paintformat(), 'PaintFormat'],
        [this.clearformatEl = new Clearformat(), 'ClearFormat'],
      ],
      [
        [this.formatEl = new Format(), 'Format'],
      ],
      [
        [this.fontEl = new Font(), 'Font'],
        [this.fontSizeEl = new FontSize(), 'FontSize'],
      ],
      [
        [this.boldEl = new Bold(), 'Bold'],
        [this.italicEl = new Italic(), 'Italic'],
        [this.underlineEl = new Underline(), 'Underline'],
        [this.strikeEl = new Strike(), 'Strike'],
        [this.textColorEl = new TextColor(style.color), 'TextColor'],
      ],
      [
        [this.fillColorEl = new FillColor(style.bgcolor), 'FillColor'],
        [this.borderEl = new Border(), 'Border'],
        [this.mergeEl = new Merge(), 'Merge'],
      ],
      [
        [this.alignEl = new Align(style.align), 'Align'],
        [this.valignEl = new Valign(style.valign), 'VAlign'],
        [this.textwrapEl = new Textwrap(), 'TextWrap'],
      ],
      [
        [this.freezeEl = new Freeze(), 'Freeze'],
        [this.autofilterEl = new Autofilter(), 'AutoFilter'],
        [this.formulaEl = new Formula(), 'Formula'],
        [this.moreEl = new More(), 'More'],
      ],
    ];
    this.items = [];
    allItems.forEach((it) => {
      var tmp = [];
      it.forEach((item) => {
        if (this.data.settings.features[item[1]]) {
          tmp.push(item[0]);
        };
      });
      if (tmp.length) {
        if (this.items.length) {
          this.items.push(buildDivider());
        };
        this.items.push(tmp);
      };
    });

    this.el = h('div', `${cssPrefix}-toolbar`);
    this.btns = h('div', `${cssPrefix}-toolbar-btns`);

    this.items.forEach((it) => {
      if (Array.isArray(it)) {
        it.forEach((i) => {
          this.btns.child(i.el);
          i.change = (...args) => {
            this.change(...args);
          };
        });
      } else {
        this.btns.child(it.el);
      }
    });

    this.el.child(this.btns);
    if (isHide) {
      this.el.hide();
    } else {
      this.reset();
      setTimeout(() => {
        initBtns2.call(this);
        moreResize.call(this);
      }, 0);
      bind(window, 'resize', () => {
        moreResize.call(this);
      });
    }
  }

  paintformatActive() {
    return this.paintformatEl.active();
  }

  paintformatToggle() {
    this.paintformatEl.toggle();
  }

  trigger(type) {
    this[`${type}El`].click();
  }

  resetData(data) {
    this.data = data;
    this.reset();
  }

  reset() {
    if (this.isHide) return;
    const { data } = this;
    const style = data.getSelectedCellStyle();
    // console.log('canUndo:', data.canUndo());
    this.undoEl.setState(!data.canUndo());
    this.redoEl.setState(!data.canRedo());
    this.mergeEl.setState(data.canUnmerge(), !data.selector.multiple());
    this.autofilterEl.setState(!data.canAutofilter());
    // this.mergeEl.disabled();
    // console.log('selectedCell:', style, cell);
    const { font, format } = style;
    this.formatEl.setState(format);
    this.fontEl.setState(font.name);
    this.fontSizeEl.setState(font.size);
    this.boldEl.setState(font.bold);
    this.italicEl.setState(font.italic);
    this.underlineEl.setState(style.underline);
    this.strikeEl.setState(style.strike);
    this.textColorEl.setState(style.color);
    this.fillColorEl.setState(style.bgcolor);
    this.alignEl.setState(style.align);
    this.valignEl.setState(style.valign);
    this.textwrapEl.setState(style.textwrap);
    // console.log('freeze is Active:', data.freezeIsActive());
    this.freezeEl.setState(data.freezeIsActive());
  }
}
