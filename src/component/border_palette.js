import { h } from './element';
import Icon from './icon';
import DropdownColor from './dropdown_color';
import DropdownLineType from './dropdown_linetype';

function buildTable(...trs) {
  return h('table', '').child(
    h('tbody', '').children(...trs),
  );
}

function buildTd(iconName) {
  return h('td', '').child(
    h('div', 'xss-border-palette-cell').child(
      new Icon(`border-${iconName}`),
    ).on('click', () => {
      this.mode = iconName;
      const { mode, style, color } = this;
      this.change({ mode, style, color });
    }),
  );
}

export default class BorderPalette {
  constructor() {
    this.color = '#000';
    this.style = 'thin';
    this.mode = 'all';
    this.change = () => {};
    this.ddColor = new DropdownColor('line-color', this.color);
    this.ddColor.change = (color) => {
      this.color = color;
    };
    this.ddType = new DropdownLineType(this.style);
    this.ddType.change = ([s]) => {
      this.style = s;
    };
    this.el = h('div', 'xss-border-palette');
    const table = buildTable(
      h('tr', '').children(
        h('td', 'xss-border-palette-left').child(
          buildTable(
            h('tr', '').children(
              ...['all', 'inside', 'horizontal', 'vertical', 'outside'].map(it => buildTd.call(this, it)),
            ),
            h('tr', '').children(
              ...['left', 'top', 'right', 'bottom', 'none'].map(it => buildTd.call(this, it)),
            ),
          ),
        ),
        h('td', 'xss-border-palette-right').children(
          h('div', 'xss-toolbar-btn').child(this.ddColor.el),
          h('div', 'xss-toolbar-btn').child(this.ddType.el),
        ),
      ),
    );
    this.el.child(table);
  }
}
