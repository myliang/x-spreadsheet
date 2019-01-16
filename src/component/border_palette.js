import { h } from './element';
import Icon from './icon';
import Dropdown from './dropdown';
import ColorPalette from './color_palette';

const lineTypes = [
  ['thin', '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="1" style="user-select: none;"><line x1="0" y1="0.5" x2="50" y2="0.5" stroke-width="1" stroke="black" style="user-select: none;"></line></svg>'],
  ['medium', '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="2" style="user-select: none;"><line x1="0" y1="1.0" x2="50" y2="1.0" stroke-width="2" stroke="black" style="user-select: none;"></line></svg>'],
  ['thick', '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="3" style="user-select: none;"><line x1="0" y1="1.5" x2="50" y2="1.5" stroke-width="3" stroke="black" style="user-select: none;"></line></svg>'],
  ['dashed', '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="1" style="user-select: none;"><line x1="0" y1="0.5" x2="50" y2="0.5" stroke-width="1" stroke="black" stroke-dasharray="2" style="user-select: none;"></line></svg>'],
  ['dotted', '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="1" style="user-select: none;"><line x1="0" y1="0.5" x2="50" y2="0.5" stroke-width="1" stroke="black" stroke-dasharray="1" style="user-select: none;"></line></svg>'],
  ['double', '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="3" style="user-select: none;"><line x1="0" y1="0.5" x2="50" y2="0.5" stroke-width="1" stroke="black" style="user-select: none;"></line><line x1="0" y1="2.5" x2="50" y2="2.5" stroke-width="1" stroke="black" style="user-select: none;"></line></svg>'],
];

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
  return h('div', 'xss-toolbar-btn').child(ColorPalette.build('line-color', color));
}

function buildLineType(type) {
  const icon = new Icon('line-type');
  let beforei = 0;
  let dropdown = null;
  const lineTypeEls = lineTypes.map((it, iti) => h('div', `xss-item state ${type === it[0] ? 'checked' : ''}`)
    .on('click', () => {
      lineTypeEls[beforei].toggle('checked');
      lineTypeEls[iti].toggle('checked');
      beforei = iti;
      dropdown.hide();
    })
    .child(
      h('div', 'xss-line-type').html(it[1]),
    ));
  dropdown = new Dropdown(icon, 'auto', false, ...lineTypeEls);
  return h('div', 'xss-toolbar-btn').child(dropdown);
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
