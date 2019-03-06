import Calendar from './calendar';
import { h } from './element';
import { cssPrefix } from '../config';

export default class Datepicker {
  constructor() {
    this.calendar = new Calendar(new Date());
    this.el = h('div', `${cssPrefix}-datepicker`).child(
      this.calendar.el,
    );
  }

  setValue(date) {
    this.calendar.setValue(date);
  }

  change(cb) {
    this.calendar.selectChange = (d) => {
      cb(d);
      this.hide();
    };
  }

  show() {
    this.el.show();
  }

  hide() {
    this.el.hide();
  }
}
