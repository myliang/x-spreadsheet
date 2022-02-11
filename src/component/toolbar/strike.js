import ToggleItem from './toggle_item';

export default class Strike extends ToggleItem {
  constructor(event) {
    super(event, 'strike', 'Ctrl+U');
  }
}
