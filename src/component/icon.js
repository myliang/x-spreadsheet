import { Element, h } from './element';
import { cssPrefix } from '../config';


// import * as undo from '../../assets/undo.svg';
const undo = require('../../assets/undo.svg');
const redo = require('../../assets/redo.svg');
const print = require('../../assets/print.svg');
const paintformat = require('../../assets/paintformat.svg');
const clearformat = require('../../assets/clearformat.svg');
const bold = require('../../assets/bold.svg');
const fontitalic = require('../../assets/font-italic.svg');
const underline = require('../../assets/underline.svg');
const strikeout = require('../../assets/strikeout.svg');
const color = require('../../assets/color.svg');
const bgcolor = require('../../assets/bgcolor.svg');
const merge = require('../../assets/merge.svg');
const alignleft = require('../../assets/align-left.svg');
const aligncenter = require('../../assets/align-center.svg');
const alignright = require('../../assets/align-right.svg');
const aligntop = require('../../assets/align-top.svg');
const alignmiddle = require('../../assets/align-middle.svg');
const alignbottom = require('../../assets/align-bottom.svg');
const textwrap = require('../../assets/textwrap.svg');
const filter = require('../../assets/filter.svg');
const formula = require('../../assets/formulas.svg');
const arrowDown = require('../../assets/arrow-down.svg');
const arrowRight = require('../../assets/arrow-right.svg');
const link = require('../../assets/link.svg');
const graph = require('../../assets/graph.svg');
const freeze = require('../../assets/freeze.svg');
const ellipsis = require('../../assets/ellipsis.svg');
const add = require('../../assets/add.svg');
const borderall = require('../../assets/border-all.svg');
const borderinside = require('../../assets/border-inside.svg');
const borderhorizontal = require('../../assets/border-horizontal.svg');
const bordervertical = require('../../assets/border-vertical.svg');
const borderoutside = require('../../assets/border-outside.svg');
const borderleft = require('../../assets/border-left.svg');
const bordertop = require('../../assets/border-top.svg');
const borderright = require('../../assets/border-right.svg');
const borderbottom = require('../../assets/border-bottom.svg');
const bordernone = require('../../assets/border-none.svg');
const linecolor = require('../../assets/line-color.svg');
const linetype = require('../../assets/line-type.svg');
const chevronleft = require('../../assets/chevron-left.svg');
const chevronright = require('../../assets/chevron-right.svg');
const close = require('../../assets/close.svg');

const icons = {
  undo,
  redo,
  print,
  paintformat,
  clearformat,
  'font-bold': bold,
  'font-italic': fontitalic,
  underline,
  strike: strikeout,
  color,
  bgcolor,
  merge,
  'align-left': alignleft,
  'align-center': aligncenter,
  'align-right': alignright,
  'align-top': aligntop,
  'align-middle': alignmiddle,
  'align-bottom': alignbottom,
  textwrap,
  autofilter: filter,
  formula,
  'arrow-down': arrowDown,
  'arrow-right': arrowRight,
  link,
  graph,
  freeze,
  ellipsis,
  add,
  'border-all': borderall,
  'border-inside': borderinside,
  'border-horizontal': borderhorizontal,
  'border-vertical': bordervertical,
  'border-outside': borderoutside,
  'border-left': borderleft,
  'border-top': bordertop,
  'border-right': borderright,
  'border-bottom': borderbottom,
  'border-none': bordernone,
  'line-color': linecolor,
  'line-type': linetype,
  'chevron-left': chevronleft,
  'chevron-right': chevronright,
  close,
};


export const buildImg = (name) => {
  const icon = h('img');
  if(icons[name]) {
    icon.attr('src', icons[name])
  } else {
    console.log(`idon ${name} not found`);
  }
  return icon;
}

export default class Icon extends Element {
  constructor(name) {
    super('div', `${cssPrefix}-icon icon-${name}`);
    const icon = buildImg(name);
    // icon.attr('src', undo);
    // this.iconNameEl = h('img');
    // this.iconNameEl.attr('src', undo);
    // this.iconNameEl = h('div', `${cssPrefix}-icon-img ${name}`);
    this.iconNameEl = icon;
    // this.child(undo);
    this.child(this.iconNameEl);
  }

  setName(name) {
    this.iconNameEl.className(`${cssPrefix}-icon-img ${name}`);
  }
}
