import Item from './item';
import Icon from '../icon';

export default class IconItem extends Item {
  element() {
    return super.element()
      .child(new Icon(this.tag))
      .on('click', () => this.change(this.tag));
  }

  setState(disabled) {
    this.el.disabled(disabled);
  }
}
