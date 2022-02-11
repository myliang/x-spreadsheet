import ToggleItem from './toggle_item';

export default class Underline extends ToggleItem {
  constructor(event) {
    super(event, 'underline', 'Ctrl+U');
  }
}
