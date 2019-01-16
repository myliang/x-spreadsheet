import { h } from './element';
import Dropdown from './dropdown';
import ColorPalette from './color_palette';
import BorderPalette from './border_palette';
import Icon from './icon';
import { fontSizes } from '../font';

function buildIcon(name) {
  return new Icon(name);
}

function buildButton(tooltip) {
  return h('div', 'xss-toolbar-btn').attr('data-tooltip', tooltip);
}

function buildItem() {
  return h('div', 'xss-item');
}

function buildItemWithIcon(iconName) {
  return buildItem().child(buildIcon(iconName));
}

function buildDivider() {
  return h('div', 'xss-toolbar-divider');
}

function buildButtonWithIcon(tooltip, iconName) {
  return buildButton(tooltip).child(buildIcon(iconName));
}

function buildFormat(formats) {
  const dropdown = new Dropdown(
    'Normal',
    '220px',
    true,
    ...formats.map((it) => {
      const item = buildItem();
      item.child(it.title)
        .on('click', () => {
          dropdown.setTitle(it.title);
        });
      if (it.label) item.child(h('div', 'label').html(it.label));
      return item;
    }),
  );
  return buildButton('Formats').child(dropdown);
}

function buildFont(fonts) {
  const dropdown = new Dropdown(
    fonts[0].title,
    '160px',
    true,
    ...fonts.map(it => buildItem()
      .on('click', () => {
        dropdown.setTitle(it.title);
      })
      .child(it.title)),
  );
  return buildButton('Font').child(dropdown);
}

function buildFormula(formulas) {
  const dropdown = new Dropdown(
    buildIcon('formula'),
    '200px',
    ...formulas.map(it => buildItem()
      .on('click', () => {
        dropdown.hide();
      })
      .child(it.key)),
  );
  return buildButton('Functions').child(dropdown);
}

function buildFontSize() {
  const dropdown = new Dropdown(
    '10',
    '60px',
    true,
    ...fontSizes.map(it => buildItem()
      .on('click', () => {
        dropdown.setTitle(`${it.pt}`);
      })
      .child(`${it.pt}`)),
  );
  return buildButton('Font size').child(dropdown);
}

function buildColor(tooltip, iconName, color) {
  const picker = ColorPalette.build(iconName, color);
  return buildButton(tooltip).child(picker);
}

function buildBorders() {
  const borderPalette = new BorderPalette();
  const dropdown = new Dropdown(
    buildIcon('border-all'),
    'auto',
    false,
    borderPalette.el,
  );
  borderPalette.change = () => {
    dropdown.hide();
  };
  return buildButton('Borders').child(dropdown);
}

function buildAlign(aligns, tooltip, align) {
  const icon = buildIcon(`align-${align}`);
  const dropdown = new Dropdown(
    icon,
    'auto',
    true,
    ...aligns.map(it => buildItemWithIcon(`align-${it}`)
      .on('click', () => {
        icon.setName(`align-${it}`);
        dropdown.hide();
      })),
  );
  return buildButton(tooltip).child(dropdown);
}

export default class Toolbar {
  constructor(data) {
    this.data = data;
    const { style } = data.options;
    // console.log('data:', data);
    this.el = h('div', 'xss-toolbar')
      .children(
        this.undoEl = buildButtonWithIcon('Undo (Ctrl+Z)', 'undo'),
        this.redoEl = buildButtonWithIcon('Redo (Ctrl+Y)', 'redo'),
        this.printEl = buildButtonWithIcon('Print (Ctrl+P)', 'print'),
        this.paintformatEl = buildButtonWithIcon('Paint format', 'paintformat'),
        this.clearformatEl = buildButtonWithIcon('Clear format', 'clearformat'),
        buildDivider(),
        this.formatEl = buildFormat(data.formats()),
        buildDivider(),
        this.fontEl = buildFont(data.fonts()),
        this.fontSizeEl = buildFontSize(),
        buildDivider(),
        this.boldEl = buildButtonWithIcon('Bold', 'bold'),
        this.italicEl = buildButtonWithIcon('Italic', 'italic'),
        this.strikethroughEl = buildButtonWithIcon('Strikethrough', 'strikethrough'),
        this.textColorEl = buildColor('Text color', 'text-color', style.color),
        buildDivider(),
        this.fillColorEl = buildColor('Fill color', 'fill-color', style.bgcolor),
        this.bordersEl = buildBorders(),
        this.mergeEl = buildButtonWithIcon('Merge cells', 'merge'),
        buildDivider(),
        this.alignEl = buildAlign(['left', 'center', 'right'], 'Horizontal align', style.align),
        this.valignEl = buildAlign(['top', 'middle', 'bottom'], 'Vertical align', style.valign),
        this.textwrapEl = buildButtonWithIcon('textwrap'),
        buildDivider(),
        this.linkEl = buildButtonWithIcon('Insert link', 'link'),
        this.chartEl = buildButtonWithIcon('Insert chart', 'chart'),
        this.autofilterEl = buildButtonWithIcon('Filter', 'autofilter'),
        this.formulaEl = buildFormula(data.formulas()),
      );
    this.reset();
  }

  reset() {
    //
  }
}
