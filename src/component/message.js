/* global document */
import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';

export function xalert(title, content) {
  const el = h('div', `${cssPrefix}-alert`);
  const dimmer = h('div', `${cssPrefix}-dimmer active`);
  const remove = () => {
    document.body.removeChild(el.el);
    document.body.removeChild(dimmer.el);
  };

  el.children(
    h('div', `${cssPrefix}-alert-header`).children(
      new Icon('close').on('click.stop', () => remove()),
      title,
    ),
    h('div', `${cssPrefix}-alert-content`).html(content),
  );
  document.body.appendChild(el.el);
  document.body.appendChild(dimmer.el);
  // set offset
  const { width, height } = el.box();
  const { clientHeight, clientWidth } = document.documentElement;
  el.offset({
    left: (clientWidth - width) / 2,
    top: (clientHeight - height) / 3,
  });
}

export default {};
