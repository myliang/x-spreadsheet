import ToggleItem from './toggle_item';

export default class Merge extends ToggleItem {
  constructor(event) {
    super(event, 'merge');
  }

  setState(active, disabled) {
    this.el.active(active).disabled(disabled);
  }
}
