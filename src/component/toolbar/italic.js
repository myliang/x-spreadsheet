import ToggleItem from './toggle_item';

export default class Italic extends ToggleItem {
  constructor(event) {
    super(event, 'font-italic', 'Ctrl+I');
  }
}
