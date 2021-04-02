//* global window */
import { h } from './element';
import Suggest from './suggest';
import Datepicker from './datepicker';
import { cssPrefix } from '../config';
// import { mouseMoveUp } from '../event';
import Formula from './formula';
import { setCaretPosition, saveCaretPosition } from '../core/caret';

function insertText({ target }, itxt) {
  const { value, selectionEnd } = target;
  const ntxt = `${value.slice(0, selectionEnd)}${itxt}${value.slice(selectionEnd)}`;
  target.value = ntxt;
  this.inputText = ntxt;
  this.render();

  setCaretPosition(target, selectionEnd + 1);
}

function keydownEventHandler(evt) {
  const { keyCode, altKey } = evt;
  if (keyCode !== 13 && keyCode !== 9) evt.stopPropagation();
  if (keyCode === 13 && altKey) {
    insertText.call(this, evt, '\n');
    evt.stopPropagation();
  }
  if (keyCode === 13 && !altKey) evt.preventDefault();
}

function inputEventHandler() {
  // save caret position
  const restore = saveCaretPosition(this.textEl.el);

  const text = this.textEl.el.textContent;
  this.inputText = text;
  // console.log(evt, 'v:', v);

  const { suggest, validator } = this;

  if (validator) {
    if (validator.type === 'list') {
      suggest.search(text);
    } else {
      suggest.hide();
    }
  } else {
    const start = text.lastIndexOf('=');
    if (start !== -1) {
      suggest.search(text.substring(start + 1));
    } else {
      suggest.hide();
    }
  }
  this.render();
  this.change('input', text);

  // restore caret postion
  // to avoid caret postion missing when this.el.innerHTML changed
  restore();
}

function suggestItemClick(it) {
  const { inputText, validator } = this;
  let position = 0;
  if (validator && validator.type === 'list') {
    this.inputText = it;
    position = this.inputText.length;
  } else {
    const start = inputText.lastIndexOf('=');
    const sit = inputText.substring(0, start + 1);
    let eit = inputText.substring(start + 1);
    if (eit.indexOf(')') !== -1) {
      eit = eit.substring(eit.indexOf(')'));
    } else {
      eit = '';
    }
    this.inputText = `${sit + it.key}(`;
    // console.log('inputText:', this.inputText);
    position = this.inputText.length;
    this.inputText += `)${eit}`;
  }
  this.render();
  setCaretPosition(this.textEl.el, position);
}

function resetSuggestItems() {
  this.suggest.setItems(this.formulas);
}

function dateFormat(d) {
  let month = d.getMonth() + 1;
  let date = d.getDate();
  if (month < 10) month = `0${month}`;
  if (date < 10) date = `0${date}`;
  return `${d.getFullYear()}-${month}-${date}`;
}

export default class Editor {
  constructor(formulas, viewFn, data) {
    this.data = data;
    this.viewFn = viewFn;
    this.rowHeight = data.rows.height;
    this.formulas = formulas;
    this.suggest = new Suggest(formulas, (it) => {
      suggestItemClick.call(this, it);
    });
    this.datepicker = new Datepicker();
    this.datepicker.change((d) => {
      // console.log('d:', d);
      this.setText(dateFormat(d));
      this.clear();
    });
    this.composing = false;
    this.areaEl = h('div', `${cssPrefix}-editor-area`)
      .children(
        this.textEl = h('div', 'textarea')
          .attr('contenteditable', 'true')
          .on('input', evt => inputEventHandler.call(this, evt))
          .on('paste.stop', () => { })
          .on('keydown', evt => keydownEventHandler.call(this, evt))
          .on('compositionstart.stop', () => this.composing = true)
          .on('compositionend.stop', () => this.composing = false),
        this.textlineEl = h('div', 'textline'),
        this.suggest.el,
        this.datepicker.el,
      )
      .on('mousemove.stop', () => { })
      .on('mousedown.stop', () => { });
    this.el = h('div', `${cssPrefix}-editor`)
      .children(this.areaEl).hide();
    this.cellEl = h('div', `${cssPrefix}-formula-cell`)
    this.suggest.bindInputEvents(this.textEl);

    this.areaOffset = null;
    this.freeze = { w: 0, h: 0 };
    this.cell = null;
    this.inputText = '';
    this.change = () => { };

    this.formula = new Formula(this);
  }

  setFreezeLengths(width, height) {
    this.freeze.w = width;
    this.freeze.h = height;
  }

  clear() {
    // const { cell } = this;
    // const cellText = (cell && cell.text) || '';
    if (this.inputText !== '') {
      this.change('finished', this.inputText);
    }
    this.cell = null;
    this.areaOffset = null;
    this.inputText = '';
    this.el.hide();
    this.textEl.val('');
    this.textlineEl.html('');
    this.formula.clear();
    resetSuggestItems.call(this);
    this.datepicker.hide();
  }

  resetData(data) {
    this.data = data;
    this.rowHeight = data.rows.height;
  }

  setOffset(offset, suggestPosition = 'top') {
    const {
      textEl, areaEl, suggest, freeze, el, formula
    } = this;
    if (offset) {
      this.areaOffset = offset;
      const {
        left, top, width, height, l, t,
      } = offset;
      // console.log('left:', left, ',top:', top, ', freeze:', freeze);
      const elOffset = { left: 0, top: 0 };
      // top left
      if (freeze.w > l && freeze.h > t) {
        //
      } else if (freeze.w < l && freeze.h < t) {
        elOffset.left = freeze.w;
        elOffset.top = freeze.h;
      } else if (freeze.w > l) {
        elOffset.top = freeze.h;
      } else if (freeze.h > t) {
        elOffset.left = freeze.w;
      }
      el.offset(elOffset);
      areaEl.offset({ left: left - elOffset.left - 0.8, top: top - elOffset.top - 0.8 });
      textEl.css('min-width', `${width - 9 + 0.8}px`);
      textEl.css('min-height', `${height - 3 + 0.8}px`);
      const sOffset = { left: 0 };
      sOffset[suggestPosition] = height;
      suggest.setOffset(sOffset);
      suggest.hide();
      formula.renderCells();
    }
  }

  setCell(cell, validator) {
    if (cell && cell.editable === false) return;

    // console.log('::', validator);
    const { el, datepicker, suggest } = this;
    el.show();
    this.cell = cell;
    const text = (cell && cell.text) || '';
    this.setText(text);

    this.validator = validator;
    if (validator) {
      const { type } = validator;
      if (type === 'date') {
        datepicker.show();
        if (!/^\s*$/.test(text)) {
          datepicker.setValue(text);
        }
      }
      if (type === 'list') {
        suggest.setItems(validator.values());
        suggest.search('');
      }
    }
  }

  setText(text) {
    this.inputText = text;
    // console.log('text>>:', text);

    // firefox bug
    this.textEl.el.blur();

    this.render();
    setTimeout(() => {
      setCaretPosition(this.textEl.el, text.length);
    })
  }

  render() {
    if (this.composing) return;

    const text = this.inputText;

    if (text[0] != '=') {
      this.textEl.html(text);
    } else {
      this.formula.render();
    }

    this.textlineEl.html(text);
  }

  formulaCellSelecting() {
    return Boolean(this.formula.cell);
  }

  formulaSelectCell(ri, ci) {
    this.formula.selectCell(ri, ci);
  }
}
