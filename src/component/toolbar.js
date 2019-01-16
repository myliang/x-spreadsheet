import { h } from './element';
import Dropdown from './dropdown';
import ColorPalette from './color_palette';
import BorderPalette from './border_palette';
import Icon from './icon';
import { fontSizes } from '../font';

function buildIcon(name) {
  return new Icon(name);
}

function buildButton() {
  return h('div', 'xss-toolbar-btn');
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

function buildButtonWithIcon(iconName) {
  return buildButton().child(buildIcon(iconName));
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
  return buildButton().child(dropdown);
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
  return buildButton().child(dropdown);
}

function buildFormula(formulas) {
  const dropdown = new Dropdown(
    buildIcon('formula'),
    '200px',
    ...formulas.map(it => buildItem().child(it.key)),
  );
  return buildButton().child(dropdown);
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
  return buildButton().child(dropdown);
}

function buildColor(iconName, color) {
  const picker = ColorPalette.build(iconName, color);
  return buildButton().child(picker);
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
  return buildButton().child(dropdown);
}

function buildAlign(aligns, align) {
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
  return buildButton().child(dropdown);
}

export default class Toolbar {
  constructor(data) {
    this.data = data;
    const { style } = data.options;
    // console.log('data:', data);
    this.el = h('div', 'xss-toolbar')
      .children(
        this.undoEl = buildButtonWithIcon('undo'),
        this.redoEl = buildButtonWithIcon('redo'),
        this.printEl = buildButtonWithIcon('print'),
        this.paintformatEl = buildButtonWithIcon('paintformat'),
        this.clearformatEl = buildButtonWithIcon('clearformat'),
        buildDivider(),
        this.formatEl = buildFormat(data.formats()),
        buildDivider(),
        this.fontEl = buildFont(data.fonts()),
        this.fontSizeEl = buildFontSize(),
        buildDivider(),
        this.boldEl = buildButtonWithIcon('bold'),
        this.italicEl = buildButtonWithIcon('italic'),
        this.strikethroughEl = buildButtonWithIcon('strikethrough'),
        this.textColorEl = buildColor('text-color', style.color),
        buildDivider(),
        this.fillColorEl = buildColor('fill-color', style.bgcolor),
        this.bordersEl = buildBorders(),
        this.mergeEl = buildButtonWithIcon('merge'),
        buildDivider(),
        this.alignEl = buildAlign(['left', 'center', 'right'], style.align),
        this.valignEl = buildAlign(['top', 'middle', 'bottom'], style.valign),
        this.textwrapEl = buildButtonWithIcon('textwrap'),
        buildDivider(),
        this.linkEl = buildButtonWithIcon('link'),
        this.chartEl = buildButtonWithIcon('chart'),
        this.autofilterEl = buildButtonWithIcon('autofilter'),
        this.formulaEl = buildFormula(data.formulas()),
      );
    this.reset();
  }

  reset() {
    //
  }
}
