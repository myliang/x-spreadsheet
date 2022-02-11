import ToggleItem from './toggle_item';

export default class Bold extends ToggleItem {
  constructor(event) {
    super(event, 'font-bold', 'Ctrl+B');
  }
}
