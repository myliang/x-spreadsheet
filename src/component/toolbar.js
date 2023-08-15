/* global window */
import { h } from './element';
import { bind } from './event';
import tooltip from './tooltip';
import DropdownFont from './dropdown_font';
import DropdownFontSize from './dropdown_fontsize';
import DropdownFormat from './dropdown_format';
import DropdownFormula from './dropdown_formula';
import DropdownColor from './dropdown_color';
import DropdownAlign from './dropdown_align';
import DropdownBorder from './dropdown_border';
import Dropdown from './dropdown';
import Icon from './icon';
import { cssPrefix } from '../config';
import { t } from '../locale/locale';

function buildIcon(name) {
  return new Icon(name);
}

function buildButton(tooltipdata) {
  return h('div', `${cssPrefix}-toolbar-btn`)
    .on('mouseenter', (evt) => {
      tooltip(tooltipdata, evt.target);
    })
    .attr('data-tooltip', tooltipdata);
}

function buildDivider() {
  return h('div', `${cssPrefix}-toolbar-divider`);
}

function buildButtonWithIcon(tooltipdata, iconName, change = () => {}) {
  return buildButton(tooltipdata)
    .child(buildIcon(iconName))
    .on('click', () => change());
}

function bindDropdownChange() {
  this.ddFormat.change = it => this.change('format', it.key);
  this.ddFont.change = it => this.change('font-name', it.key);
  this.ddFormula.change = it => this.change('formula', it.key);
  this.ddFontSize.change = it => this.change('font-size', it.pt);
  this.ddTextColor.change = it => this.change('color', it);
  this.ddFillColor.change = it => this.change('bgcolor', it);
  this.ddAlign.change = it => this.change('align', it);
  this.ddVAlign.change = it => this.change('valign', it);
  this.ddBorder.change = it => this.change('border', it);
}


function toggleChange(type) {
  let elName = type;
  const types = type.split('-');
  if (types.length > 1) {
    types.forEach((it, i) => {
      if (i === 0) elName = it;
      else elName += it[0].toUpperCase() + it.substring(1);
    });
  }
  const el = this[`${elName}El`];
  el.toggle();
  this.change(type, el.hasClass('active'));
}

class DropdownMore extends Dropdown {
  constructor() {
    const icon = new Icon('ellipsis');
    const moreBtns = h('div', `${cssPrefix}-toolbar-more`);
    super(icon, 'auto', false, 'bottom-right', moreBtns);
    this.moreBtns = moreBtns;
    this.contentEl.css('max-width', '420px');
  }
}

function initBtns2() {
  this.btns2 = this.btnChildren.map((it) => {
    const rect = it.box();
    const { marginLeft, marginRight } = it.computedStyle();
    return [it, rect.width + parseInt(marginLeft, 10) + parseInt(marginRight, 10)];
  });
}

function moreResize() {
  const {
    el, btns, moreEl, ddMore, btns2,
  } = this;
  const { moreBtns, contentEl } = ddMore;
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
    const style = data.defaultStyle();
    // console.log('data:', data);
    this.ddFormat = new DropdownFormat();
    this.ddFont = new DropdownFont();
    this.ddFormula = new DropdownFormula();
    this.ddFontSize = new DropdownFontSize();
    this.ddTextColor = new DropdownColor('text-color', style.color);
    this.ddFillColor = new DropdownColor('fill-color', style.bgcolor);
    this.ddAlign = new DropdownAlign(['left', 'center', 'right'], style.align);
    this.ddVAlign = new DropdownAlign(['top', 'middle', 'bottom'], style.valign);
    this.ddBorder = new DropdownBorder();
    this.ddMore = new DropdownMore();
    this.btnChildren = [
      this.undoEl = buildButtonWithIcon(`${t('toolbar.undo')} (Ctrl+Z)`, 'undo', () => this.change('undo')),
      this.redoEl = buildButtonWithIcon(`${t('toolbar.undo')} (Ctrl+Y)`, 'redo', () => this.change('redo')),
      // this.printEl = buildButtonWithIcon('Print (Ctrl+P)', 'print', () => this.change('print')),
      this.paintformatEl = buildButtonWithIcon(`${t('toolbar.paintformat')}`, 'paintformat', () => toggleChange.call(this, 'paintformat')),
      this.clearformatEl = buildButtonWithIcon(`${t('toolbar.clearformat')}`, 'clearformat', () => this.change('clearformat')),
      buildDivider(),
      buildButton(`${t('toolbar.format')}`).child(this.ddFormat.el),
      buildDivider(),
      buildButton(`${t('toolbar.font')}`).child(this.ddFont.el),
      buildButton(`${t('toolbar.fontSize')}`).child(this.ddFontSize.el),
      buildDivider(),
      this.fontBoldEl = buildButtonWithIcon(`${t('toolbar.fontBold')} (Ctrl+B)`, 'bold', () => toggleChange.call(this, 'font-bold')),
      this.fontItalicEl = buildButtonWithIcon(`${t('toolbar.fontItalic')} (Ctrl+I)`, 'italic', () => toggleChange.call(this, 'font-italic')),
      this.underlineEl = buildButtonWithIcon(`${t('toolbar.underline')} (Ctrl+U)`, 'underline', () => toggleChange.call(this, 'underline')),
      this.strikeEl = buildButtonWithIcon(`${t('toolbar.strike')}`, 'strike', () => toggleChange.call(this, 'strike')),
      buildButton(`${t('toolbar.textColor')}`).child(this.ddTextColor.el),
      buildDivider(),
      buildButton(`${t('toolbar.fillColor')}`).child(this.ddFillColor.el),
      buildButton(`${t('toolbar.border')}`).child(this.ddBorder.el),
      this.mergeEl = buildButtonWithIcon(`${t('toolbar.merge')}`, 'merge', () => toggleChange.call(this, 'merge')),
      buildDivider(),
      buildButton(`${t('toolbar.align')}`).child(this.ddAlign.el),
      buildButton(`${t('toolbar.valign')}`).child(this.ddVAlign.el),
      this.textwrapEl = buildButtonWithIcon(`${t('toolbar.textwrap')}`, 'textwrap', () => toggleChange.call(this, 'textwrap')),
      buildDivider(),
      // this.linkEl = buildButtonWithIcon('Insert link', 'link'),
      // this.chartEl = buildButtonWithIcon('Insert chart', 'chart'),
      this.freezeEl = buildButtonWithIcon(`${t('toolbar.freeze')}`, 'freeze', () => toggleChange.call(this, 'freeze')),
      this.autofilterEl = buildButtonWithIcon(`${t('toolbar.autofilter')}`, 'autofilter', () => toggleChange.call(this, 'autofilter')),
      buildButton(`${t('toolbar.formula')}`).child(this.ddFormula.el),
      // buildDivider(),
      this.moreEl = buildButton(`${t('toolbar.more')}`).child(this.ddMore.el).hide(),
    ];
    this.el = h('div', `${cssPrefix}-toolbar`);
    this.btns = h('div', `${cssPrefix}-toolbar-btns`).children(...this.btnChildren);
    this.el.child(this.btns);
    if (isHide) this.el.hide();
    bindDropdownChange.call(this);
    this.reset();
    setTimeout(() => {
      initBtns2.call(this);
      moreResize.call(this);
    }, 0);
    bind(window, 'resize', () => {
      moreResize.call(this);
    });
  }

  paintformatActive() {
    return this.paintformatEl.hasClass('active');
  }

  paintformatToggle() {
    this.paintformatEl.toggle();
  }

  trigger(type) {
    toggleChange.call(this, type);
  }

  reset() {
    const { data } = this;
    const style = data.getSelectedCellStyle();
    const cell = data.getSelectedCell();
    // console.log('canUndo:', data.canUndo());
    this.undoEl.disabled(!data.canUndo());
    this.redoEl.disabled(!data.canRedo());
    this.mergeEl.active(data.canUnmerge())
      .disabled(!data.selector.multiple());
    this.autofilterEl.active(!data.canAutofilter());
    // this.mergeEl.disabled();
    // console.log('selectedCell:', style, cell);
    const { font } = style;
    this.ddFont.setTitle(font.name);
    this.ddFontSize.setTitle(font.size);
    this.fontBoldEl.active(font.bold);
    this.fontItalicEl.active(font.italic);
    this.underlineEl.active(style.underline);
    this.strikeEl.active(style.strike);
    this.ddTextColor.setTitle(style.color);
    this.ddFillColor.setTitle(style.bgcolor);
    this.ddAlign.setTitle(style.align);
    this.ddVAlign.setTitle(style.valign);
    this.textwrapEl.active(style.textwrap);
    // console.log('freeze is Active:', data.freezeIsActive());
    this.freezeEl.active(data.freezeIsActive());
    if (cell) {
      if (cell.format) {
        this.ddFormat.setTitle(cell.format);
      }
    }
  }
}
