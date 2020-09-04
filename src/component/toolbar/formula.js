import DropdownItem from './dropdown_item';
import DropdownFormula from '../dropdown_formula';

export default class Format extends DropdownItem {
  constructor() {
    super('formula');
  }

  getValue(it) {
    return it;
  }

  dropdown() {
    return new DropdownFormula();
  }
}
