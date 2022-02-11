/* global document */
import { h } from './element';
import { cssPrefix } from '../config';

export default function tooltip(event, html, target) {
  if (target.classList.contains('active')) {
    return;
  }
  const {
    left, top, width, height,
  } = target.getBoundingClientRect();
  const el = h('div', `${cssPrefix}-tooltip`).html(html).show();
  document.body.appendChild(el.el);
  const elBox = el.box();
  // console.log('elBox:', elBox);
  el.css('left', `${left + (width / 2) - (elBox.width / 2)}px`)
    .css('top', `${top + height + 2}px`);

  event.bind(target, 'mouseleave', () => {
    if (document.body.contains(el.el)) {
      document.body.removeChild(el.el);
    }
  });

  event.bind(target, 'click', () => {
    if (document.body.contains(el.el)) {
      document.body.removeChild(el.el);
    }
  });
}
