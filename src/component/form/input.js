import Element from '../element';
import { cssPrefix } from '../../config';

export default class Input extends Element {
  constructor() {
    super('input', `${cssPrefix}-input`);
  }
}
