/* global document */
export default class Element {
  constructor(tag) {
    this.el = document.createElement(tag);
  }
}
