import { h } from './element';
import DropdownFont from './dropdown_font';
import DropdownFontSize from './dropdown_fontsize';
import DropdownFormat from './dropdown_format';
import DropdownFormula from './dropdown_formula';
import DropdownColor from './dropdown_color';
import DropdownAlign from './dropdown_align';
import DropdownBorder from './dropdown_border';
import Icon from './icon';
// import { fontSizes, baseFonts } from '../font';
// import { baseFormulas } from '../formula';
// import { baseFormats } from '../format';

function buildIcon(name) {
  return new Icon(name);
}

function buildButton(tooltip) {
  return h('div', 'xss-toolbar-btn').attr('data-tooltip', tooltip);
}

function buildDivider() {
  return h('div', 'xss-toolbar-divider');
}

function buildButtonWithIcon(tooltip, iconName) {
  return buildButton(tooltip).child(buildIcon(iconName));
}

export default class Toolbar {
  constructor(data) {
    this.data = data;
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
    this.el = h('div', 'xss-toolbar')
      .children(
        this.undoEl = buildButtonWithIcon('Undo (Ctrl+Z)', 'undo'),
        this.redoEl = buildButtonWithIcon('Redo (Ctrl+Y)', 'redo'),
        this.printEl = buildButtonWithIcon('Print (Ctrl+P)', 'print'),
        this.paintformatEl = buildButtonWithIcon('Paint format', 'paintformat'),
        this.clearformatEl = buildButtonWithIcon('Clear format', 'clearformat'),
        buildDivider(),
        buildButton('Format').child(this.ddFormat.el),
        buildDivider(),
        buildButton('Font').child(this.ddFont.el),
        buildButton('Font size').child(this.ddFontSize.el),
        buildDivider(),
        this.boldEl = buildButtonWithIcon('Bold', 'bold'),
        this.italicEl = buildButtonWithIcon('Italic', 'italic'),
        this.strikethroughEl = buildButtonWithIcon('Strikethrough', 'strikethrough'),
        buildButton('Text color').child(this.ddTextColor.el),
        buildDivider(),
        buildButton('Fill color').child(this.ddFillColor.el),
        buildButton('Borders').child(this.ddBorder.el),
        this.mergeEl = buildButtonWithIcon('Merge cells', 'merge'),
        buildDivider(),
        buildButton('Horizontal align').child(this.ddAlign.el),
        buildButton('Vertical align').child(this.ddVAlign.el),
        this.textwrapEl = buildButtonWithIcon('Text wrapping', 'textwrap'),
        buildDivider(),
        this.linkEl = buildButtonWithIcon('Insert link', 'link'),
        this.chartEl = buildButtonWithIcon('Insert chart', 'chart'),
        this.autofilterEl = buildButtonWithIcon('Filter', 'autofilter'),
        buildButton('Functions').child(this.ddFormula.el),
      );
    this.reset();
  }

  reset() {
    const { data } = this;
    const style = data.getSelectedCellStyle();
    const cell = data.getSelectedCell();
    this.undoEl.disabled(!data.canUndo());
    this.redoEl.disabled(!data.canRedo());
    this.mergeEl.disabled(!data.canMerge());
    // console.log('selectedCell:', style, cell);
    const { font } = style;
    this.ddFont.setTitle(font.name);
    this.ddFontSize.setTitle(font.size);
    this.boldEl.active(font.bold);
    this.italicEl.active(font.italic);
    this.strikethroughEl.active(style.strikethrough);
    this.ddTextColor.setTitle(style.color);
    this.ddFillColor.setTitle(style.bgcolor);
    this.textwrapEl.active(style.textWrap);
    if (cell) {
      if (cell.format) {
        this.ddFormat.setTitle(cell.format);
      }
    }
  }
}
