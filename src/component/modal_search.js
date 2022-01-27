import Modal from './modal';
import FormInput from './form_input';
import FormField from './form_field';
import Checkbox from './checkbox';
import Button from './button';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';

export default class ModalFind extends Modal {
  constructor() {
    const findField = new FormField(
      new FormInput('300px', ''),
      { required: true },
      'Find',
      100,
    );

    findField.input.vchange = ({ target }) => {
      this.soughtValue = target.value.trim();
      this.idx = 0;
    };

    const replaceWithField = new FormField(
      new FormInput('300px', ''),
      { required: true },
      'Replace with',
      100,
    );

    replaceWithField.input.vchange = ({ target }) => {
      this.valToReplace = target.value.trim();
    };

    const matchCase = new Checkbox(t('modal.find.matchCase'));
    const matchCellContents = new Checkbox(t('modal.find.matchCellContents'));

    const messageContainer = h('p').css({ 'font-weight': 'bold' }).hide();

    super(
      t('modal.find.title'),
      [
        h('div', `${cssPrefix}-form-fields`).children(
          findField.el,
        ),
        h('div', `${cssPrefix}-form-fields`).children(
          replaceWithField.el,
        ),
        h('div', `${cssPrefix}-form-fields`).children(
          matchCase.el,
        ).css({ padding: '6px 0 6px 110px' }),
        h('div', `${cssPrefix}-form-fields`).children(
          matchCellContents.el,
        ).css({ padding: '6px 0 12px 110px' }),
        h('div', `${cssPrefix}-form-fields`).children(
          messageContainer.el,
        ).css({ 'padding-bottom': '12px' }),
        h('div', `${cssPrefix}-buttons`).children(
          new Button('find').on('click', () => this.btnClick('find')),
          new Button('replace').on('click', () => this.btnClick('replace')),
          new Button('replaceAll').on('click', () => this.btnClick('replace-all')),
          new Button('done', 'primary').on('click', () => this.btnClick('done')),
        ),
      ],
      '480px',
      false,
      true,
    );
    this.findField = findField;
    this.replaceWithField = replaceWithField;
    this.messageContainer = messageContainer;
    this.matchCase = matchCase;
    this.updateState('matchCase');
    this.matchCellContents = matchCellContents;
    this.updateState('matchCellContents');
    this.find = () => {};
    this.lenOfFoundCells = -1;
  }

  btnClick(action) {
    if (action === 'done') {
      this.hide();
    }
    if (!this.soughtValue) {
      return;
    }
    if (action === 'find') {
      this.findInSheet('none');
      this.idx += 1;
    }
    if (action === 'replace') {
      this.idx = this.idx === 0 ? 0 : this.idx - 1;
      this.findInSheet('current');
      this.idx += 1;
    }

    if (action === 'replace-all') {
      this.findInSheet('all');
    }
  }

  findInSheet(replace = 'none') {
    if (this.idx === this.lenOfFoundCells
      || this.updateState('matchCase')
      || this.updateState('matchCellContents')) {
      this.idx = 0;
    }
    this.lenOfFoundCells = this.find(
      this.soughtValue,
      this.idx,
      replace,
      this.valToReplace,
      this.matchCase.val(),
      this.matchCellContents.val(),
    );
    if (this.lenOfFoundCells === -1) {
      this.messageContainer.html(`There are no entries matching ${this.soughtValue}`);
      this.messageContainer.show();
      return;
    }
    this.messageContainer.hide();
  }

  updateState(member) {
    if (!this[member] || !this[member].val) {
      throw new Error('member not found');
    }

    if (this[member].val() !== this[`${member}State`]) {
      this[`${member}State`] = this[member].val();
      return true;
    }
    return false;
  }

  hide() {
    super.hide();
    // reset values
    this.findField.val('');
    this.replaceWithField.val('');
    this.matchCase.reset();
    this.matchCellContents.reset();
    this.idx = 0;
    this.messageContainer.hide();
  }
}
