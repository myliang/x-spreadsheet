import IconItem from './icon_item';

export default class Undo extends IconItem {
  constructor(event) {
    super(event, 'undo', 'Ctrl+Z');
  }
}
