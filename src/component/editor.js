//* global window */
import { h } from './element';
// import { mouseMoveUp } from '../event';

function editorInputEventHandler(evt) {
  const v = evt.target.value;
}

function editorSetTextareaRange(position) {
  const { textEl } = this;
  textEl.el.setSelectionRange(position, position);
  textEl.el.focus();
}

function editorReset() {
  const {
    offset, textEl, textlineEl, el,
  } = this;
  if (offset) {
    const {
      left, top, width, height,
    } = offset;
    el.offset({ left: left - 1, top: top - 1 }).show();
    textEl.offset({ width: width - 8, height: height - 1 });
    /*
    const oldWidth = textlineEl.offset().width + 16;
    if (cell) {
    }
    */
  }
}

export default class Editor {
  constructor() {
    this.el = h('div', 'xss-editor').children(
      this.textEl = h('textarea', '')
        .on('input', evt => editorInputEventHandler.call(this, evt)),
      this.textlineEl = h('div', 'textline'),
    );

    this.offset = null;
    this.cell = null;
  }

  set(offset, cell) {
    this.offset = offset;
    let text = '';
    const { textEl, textlineEl, el } = this;
    if (cell) {
      text = cell.text || '';
      this.cell = cell;
      textEl.val(text);
      textlineEl.html(text);
    }
    editorReset.call(this);
    editorSetTextareaRange.call(this, text.length);
  }
}
