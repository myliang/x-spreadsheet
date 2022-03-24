import Modal from './modal';
import FormInput from './form_input';
import FormField from './form_field';
import Checkbox from './checkbox';
import Button from './button';
import { t } from '../locale/locale';
import { h } from './element';
import { cssPrefix } from '../config';
import { CellRange } from '../core/cell_range';
import DropdownSearchOptions from './dropdown_seach_options';

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

    const ddOptions = new DropdownSearchOptions();

    const rangeField = new FormInput('100px', '');

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
          ddOptions.el,
          rangeField.el.css({ 'padding-left': '6px' }),
        ).css({ padding: '6px 0 6px 110px', display: 'flex', 'align-items': 'center' }),
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

    this.el.on('keydown', (evt) => {
      if (evt.keyCode === 13) {
        this.btnClick('find');
      }
    });

    this.findField = findField;
    this.replaceWithField = replaceWithField;
    this.ddOptions = ddOptions;
    this.ddOptions.change = ({ key }) => {
      if (key === 'sheet') {
        rangeField.el.hide();
      } else {
        rangeField.el.show();
      }
      this.idx = 0;
      this.selected = key;
    };
    this.rangeField = rangeField;
    this.rangeField.vchange = ({ target }) => {
      this.range = CellRange.valueOf(target.value);
    };
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
      setTimeout(() => {
        this.findField.input.input.focus();
      }, 1);
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

  show() {
    const [width, height] = this.range ? this.range.size() : [1, 1];
    if (width !== 1 || height !== 1) {
      this.ddOptions.setTitle('Selected range');
      this.ddOptions.change({ key: 'range' });
    } else {
      this.ddOptions.setTitle('This sheet');
      this.ddOptions.change({ key: 'sheet' });
      this.rangeField.el.hide();
    }
    super.show();
    this.findField.input.input.click();
    this.findField.input.input.focus();
  }

  setRange({
    sri, sci, eri, eci,
  }) {
    this.range = new CellRange(sri, sci, eri, eci);
    this.rangeField.val(this.range.toString());
  }
}
