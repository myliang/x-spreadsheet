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
    ).on('click', () => this.change(iconName)),
  );
}

function buildLineColor(color) {
  return h('div', 'xss-toolbar-btn').child(new DropdownColor('line-color', color));
}

function buildLineType(type) {
  return h('div', 'xss-toolbar-btn').child(new DropdownLineType(type));
}

export default class BorderPalette {
  constructor() {
    this.color = '#000';
    this.change = () => {};
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
          buildLineColor(this.color),
          buildLineType('thin'),
        ),
      ),
    );
    this.el.child(table);
  }
}
