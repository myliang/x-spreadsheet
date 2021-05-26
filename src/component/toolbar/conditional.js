import DropdownItem from './dropdown_item'
import DropdownConditional from '../dropdown_conditional'

export default class Conditional extends DropdownItem {
  constructor() {
    super('conditional')
  }

  getValue(it) {
    return it.key
  }

  dropdown() {
    return new DropdownConditional()
  }
}
