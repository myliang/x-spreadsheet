/* global document */
import { h } from './element';
import { bind } from './event';
import { cssPrefix } from '../config';

export default function tooltip(html, target) {
  if (target.classList.contains('active')) {
    return;
  }
  const {
    left, top, width, height,
  } = target.getBoundingClientRect();
  const el = h('div', `${cssPrefix}-tooltip`).html(html).show();
  const where = target.parentElement.parentElement;
  // document.body.appendChild(el.el);
  where.appendChild(el.el);
  const elBox = el.box();
  const wherebox = where.getBoundingClientRect();
  const tooltipLeft = left-wherebox.left;
  const tooltiptop = top-wherebox.top;

  // console.log('elBox:', elBox);
  el.css('left', `${tooltipLeft + (width / 2) - (elBox.width / 2)}px`)
    .css('top', `${tooltiptop + height + 2}px`);

  bind(target, 'mouseleave', () => {
    if (where.contains(el.el)) {
      where.removeChild(el.el);
    }
  });

  bind(target, 'click', () => {
    if (where.contains(el.el)) {
      where.removeChild(el.el);
    }
  });
}
