import { Element, h } from './element';
import { cssPrefix } from '../config';


// import * as undo from '../../assets/undo.svg';
// const undo = require('raw-loader!../../assets/undo.svg');
import * as undo from '!!raw-loader!../../assets/undo.svg';
import * as redo from '!!raw-loader!../../assets/redo.svg';
import * as print from '!!raw-loader!../../assets/print.svg';
import * as paintformat from '!!raw-loader!../../assets/paintformat.svg';
import * as clearformat from '!!raw-loader!../../assets/clearformat.svg';
import * as bold from '!!raw-loader!../../assets/bold.svg';
import * as fontitalic from '!!raw-loader!../../assets/font-italic.svg';
import * as underline from '!!raw-loader!../../assets/underline.svg';
import * as strikeout from '!!raw-loader!../../assets/strikeout.svg';
import * as color from '!!raw-loader!../../assets/color.svg';
import * as bgcolor from '!!raw-loader!../../assets/bgcolor.svg';
import * as merge from '!!raw-loader!../../assets/merge.svg';
import * as alignleft from '!!raw-loader!../../assets/align-left.svg';
import * as aligncenter from '!!raw-loader!../../assets/align-center.svg';
import * as alignright from '!!raw-loader!../../assets/align-right.svg';
import * as aligntop from '!!raw-loader!../../assets/align-top.svg';
import * as alignmiddle from '!!raw-loader!../../assets/align-middle.svg';
import * as alignbottom from '!!raw-loader!../../assets/align-bottom.svg';
import * as textwrap from '!!raw-loader!../../assets/textwrap.svg';
import * as filter from '!!raw-loader!../../assets/filter.svg';
import * as formula from '!!raw-loader!../../assets/formulas.svg';
import * as arrowDown from '!!raw-loader!../../assets/arrow-down.svg';
import * as arrowRight from '!!raw-loader!../../assets/arrow-right.svg';
import * as link from '!!raw-loader!../../assets/link.svg';
import * as graph from '!!raw-loader!../../assets/graph.svg';
import * as freeze from '!!raw-loader!../../assets/freeze.svg';
import * as ellipsis from '!!raw-loader!../../assets/ellipsis.svg';
import * as add from '!!raw-loader!../../assets/add.svg';
import * as borderall from '!!raw-loader!../../assets/border-all.svg';
import * as borderinside from '!!raw-loader!../../assets/border-inside.svg';
import * as borderhorizontal from '!!raw-loader!../../assets/border-horizontal.svg';
import * as bordervertical from '!!raw-loader!../../assets/border-vertical.svg';
import * as borderoutside from '!!raw-loader!../../assets/border-outside.svg';
import * as borderleft from '!!raw-loader!../../assets/border-left.svg';
import * as bordertop from '!!raw-loader!../../assets/border-top.svg';
import * as borderright from '!!raw-loader!../../assets/border-right.svg';
import * as borderbottom from '!!raw-loader!../../assets/border-bottom.svg';
import * as bordernone from '!!raw-loader!../../assets/border-none.svg';
import * as linecolor from '!!raw-loader!../../assets/line-color.svg';
import * as linetype from '!!raw-loader!../../assets/line-type.svg';
import * as chevronleft from '!!raw-loader!../../assets/chevron-left.svg';
import * as chevronright from '!!raw-loader!../../assets/chevron-right.svg';
import * as close from '!!raw-loader!../../assets/close.svg';

const icons = {
  undo: undo.default,
  redo: redo.default,
  print: print.default,
  paintformat: paintformat.default,
  clearformat: clearformat.default,
  'font-bold': bold.default,
  'font-italic': fontitalic.default,
  underline: underline.default,
  strike: strikeout.default,
  color: color.default,
  bgcolor: bgcolor.default,
  merge: merge.default,
  'align-left': alignleft.default,
  'align-center': aligncenter.default,
  'align-right': alignright.default,
  'align-top': aligntop.default,
  'align-middle': alignmiddle.default,
  'align-bottom': alignbottom.default,
  textwrap: textwrap.default,
  autofilter: filter.default,
  formula: formula.default,
  'arrow-down': arrowDown.default,
  'arrow-right': arrowRight.default,
  link: link.default,
  graph: graph.default,
  freeze: freeze.default,
  ellipsis: ellipsis.default,
  add: add.default,
  'border-all': borderall.default,
  'border-inside': borderinside.default,
  'border-horizontal': borderhorizontal.default,
  'border-vertical': bordervertical.default,
  'border-outside': borderoutside.default,
  'border-left': borderleft.default,
  'border-top': bordertop.default,
  'border-right': borderright.default,
  'border-bottom': borderbottom.default,
  'border-none': bordernone.default,
  'line-color': linecolor.default,
  'line-type': linetype.default,
  'chevron-left': chevronleft.default,
  'chevron-right': chevronright.default,
  close: close.default,
};


export const buildImg = (name) => {
  const icon = h('img');
  if(icons[name]) {
    icon.attr('src', icons[name])
  } else {
    console.log(`icon ${name} not found`);
  }
  return icon;
}

export const buildSVG = (name) => {
  if(icons[name]) {
    return icons[name];
  } else {
    console.log(`icon ${name} not found`);
  }
  return "";
}

export default class Icon extends Element {
  constructor(name) {
    super('div', `${cssPrefix}-icon icon-${name}`);
    // const icon = buildImg(name);
    const svg = buildSVG(name);
    // icon.attr('src', undo);
    // this.iconNameEl = h('img');
    // this.iconNameEl.attr('src', undo);
    // this.iconNameEl = h('div', `${cssPrefix}-icon-img ${name}`);
    // this.iconNameEl = icon;
    // this.child(undo);
    // this.iconNameEl = this.child.appendChild(svg);
    // this.child(this.iconNameEl);
    this.el.innerHTML += svg;
    this.iconNameEl = this.el.firstChild;
  }

  setName(name) {
    this.className(` icon-${name}`);
  }
}
