import Modal from './modal';
import { t } from '../config';

export default class ModalValidation extends Modal {
  constructor() {
    const content = ``;
    super(t('contextmenu.validation'), content);
  }
}
