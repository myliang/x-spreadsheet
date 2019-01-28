/* global window */
import { h } from './element';
import { bind } from '../event';
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

function buildIcon(name) {
  return new Icon(name);
}

function buildButton(tooltipdata) {
  return h('div', 'xss-toolbar-btn')
    .on('mouseenter', (evt) => {
      tooltip(tooltipdata, evt.target);
    })
    .attr('data-tooltip', tooltipdata);
}

function buildDivider() {
  return h('div', 'xss-toolbar-divider');
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

function toggleChange(elName, type) {
  const el = this[`${elName}El`];
  el.toggle();
  this.change(type, el.hasClass('active'));
}

class DropdownMore extends Dropdown {
  constructor() {
    const icon = new Icon('ellipsis');
    const moreBtns = h('div', 'xss-toolbar-more');
    super(icon, 'auto', false, 'bottom-right', moreBtns);
    this.moreBtns = moreBtns;
    this.contentEl.css('max-width', '420px');
  }
}

function moreResize() {
  const {
    el, btns, moreEl, ddMore, btnChildren,
  } = this;
  const { moreBtns, contentEl } = ddMore;
  const elBox = el.box();

  let sumWidth = 160;
  let sumWidth2 = 12;
  const list1 = [];
  const list2 = [];
  // console.log('elBox:', elBox);
  btnChildren.forEach((it) => {
    const rect = it.box();
    sumWidth += rect.width;
    // console.log('sumWidth:', sumWidth, elBox.width);
    if (it.attr('data-tooltip') === 'More' || sumWidth < elBox.width) {
      list1.push(it);
    } else {
      // console.log('margin:', it.computedStyle());
      const { marginLeft, marginRight } = it.computedStyle();
      sumWidth2 += rect.width + parseInt(marginLeft, 10) + parseInt(marginRight, 10) + 1;
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
  constructor(data) {
    this.data = data;
    this.change = () => {};
    const { style } = data.options;
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
      this.undoEl = buildButtonWithIcon('Undo (Ctrl+Z)', 'undo', () => this.change('undo')),
      this.redoEl = buildButtonWithIcon('Redo (Ctrl+Y)', 'redo', () => this.change('redo')),
      // this.printEl = buildButtonWithIcon('Print (Ctrl+P)', 'print', () => this.change('print')),
      this.paintformatEl = buildButtonWithIcon('Paint format', 'paintformat', () => toggleChange.call(this, 'paintformat', 'paintformat')),
      this.clearformatEl = buildButtonWithIcon('Clear format', 'clearformat', () => this.change('clearformat')),
      buildDivider(),
      buildButton('Format').child(this.ddFormat.el),
      buildDivider(),
      buildButton('Font').child(this.ddFont.el),
      buildButton('Font size').child(this.ddFontSize.el),
      buildDivider(),
      this.boldEl = buildButtonWithIcon('Bold', 'bold', () => toggleChange.call(this, 'bold', 'font-bold')),
      this.italicEl = buildButtonWithIcon('Italic', 'italic', () => toggleChange.call(this, 'italic', 'font-italic')),
      this.strikethroughEl = buildButtonWithIcon('Strikethrough', 'strikethrough', () => toggleChange.call(this, 'strikethrough', 'strikethrough')),
      buildButton('Text color').child(this.ddTextColor.el),
      buildDivider(),
      buildButton('Fill color').child(this.ddFillColor.el),
      buildButton('Borders').child(this.ddBorder.el),
      this.mergeEl = buildButtonWithIcon('Merge cells', 'merge', () => toggleChange.call(this, 'merge', 'merge')),
      buildDivider(),
      buildButton('Horizontal align').child(this.ddAlign.el),
      buildButton('Vertical align').child(this.ddVAlign.el),
      this.textwrapEl = buildButtonWithIcon('Text wrapping', 'textwrap', () => toggleChange.call(this, 'textwrap', 'textwrap')),
      buildDivider(),
      // this.linkEl = buildButtonWithIcon('Insert link', 'link'),
      // this.chartEl = buildButtonWithIcon('Insert chart', 'chart'),
      // this.autofilterEl = buildButtonWithIcon('Filter', 'autofilter'),
      this.freezeEl = buildButtonWithIcon('Freeze cell', 'freeze', () => toggleChange.call(this, 'freeze', 'freeze')),
      buildButton('Functions').child(this.ddFormula.el),
      // buildDivider(),
      this.moreEl = buildButton('More').child(this.ddMore.el).hide(),
    ];
    this.el = h('div', 'xss-toolbar');
    this.btns = h('div', 'xss-toolbar-btns').children(...this.btnChildren);
    this.el.child(this.btns);
    bindDropdownChange.call(this);
    this.reset();
    setTimeout(() => {
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

  reset() {
    const { data } = this;
    const style = data.getSelectedCellStyle();
    const cell = data.getSelectedCell();
    // console.log('canUndo:', data.canUndo());
    this.undoEl.disabled(!data.canUndo());
    this.redoEl.disabled(!data.canRedo());
    this.mergeEl.active(data.canUnmerge())
      .disabled(data.selector.seqe());
    // this.mergeEl.disabled();
    // console.log('selectedCell:', style, cell);
    const { font } = style;
    this.ddFont.setTitle(font.name);
    this.ddFontSize.setTitle(font.size);
    this.boldEl.active(font.bold);
    this.italicEl.active(font.italic);
    this.strikethroughEl.active(style.strikethrough);
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
