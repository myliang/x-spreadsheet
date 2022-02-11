import DropdownItem from './dropdown_item';
import DropdownAlign from '../dropdown_align';

export default class Valign extends DropdownItem {
  constructor(event, value) {
    super(event, 'valign', '', value);
  }

  dropdown() {
    const { value } = this;
    return new DropdownAlign(this.event, ['top', 'middle', 'bottom'], value);
  }
}
