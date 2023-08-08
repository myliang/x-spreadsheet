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
const downArrow = require('../../assets/down-arrow.svg');

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
  'arrow-down': downArrow,
};

console.log(icons);

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
