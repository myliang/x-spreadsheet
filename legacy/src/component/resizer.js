/* global window */
import { h } from './element';
import { mouseMoveUp } from './event';
import { cssPrefix } from '../config';

export default class Resizer {
  constructor(vertical = false, minDistance) {
    this.moving = false;
    this.vertical = vertical;
    this.el = h('div', `${cssPrefix}-resizer ${vertical ? 'vertical' : 'horizontal'}`).children(
      this.unhideHoverEl = h('div', `${cssPrefix}-resizer-hover`)
        .on('dblclick.stop', evt => this.mousedblclickHandler(evt))
        .css('position', 'absolute').hide(),
      this.hoverEl = h('div', `${cssPrefix}-resizer-hover`)
        .on('mousedown.stop', evt => this.mousedownHandler(evt)),
      this.lineEl = h('div', `${cssPrefix}-resizer-line`).hide(),
    ).hide();
    // cell rect
    this.cRect = null;
    this.finishedFn = null;
    this.minDistance = minDistance;
    this.unhideFn = () => {};
  }

  showUnhide(index) {
    this.unhideIndex = index;
    this.unhideHoverEl.show();
  }

  hideUnhide() {
    this.unhideHoverEl.hide();
  }

  // rect : {top, left, width, height}
  // line : {width, height}
  show(rect, line) {
    const {
      moving, vertical, hoverEl, lineEl, el,
      unhideHoverEl,
    } = this;
    if (moving) return;
    this.cRect = rect;
    const {
      left, top, width, height,
    } = rect;
    el.offset({
      left: vertical ? left + width - 5 : left,
      top: vertical ? top : top + height - 5,
    }).show();
    hoverEl.offset({
      width: vertical ? 5 : width,
      height: vertical ? height : 5,
    });
    lineEl.offset({
      width: vertical ? 0 : line.width,
      height: vertical ? line.height : 0,
    });
    unhideHoverEl.offset({
      left: vertical ? 5 - width : left,
      top: vertical ? top : 5 - height,
      width: vertical ? 5 : width,
      height: vertical ? height : 5,
    });
  }

  hide() {
    this.el.offset({
      left: 0,
      top: 0,
    }).hide();
    this.hideUnhide();
  }

  mousedblclickHandler() {
    if (this.unhideIndex) this.unhideFn(this.unhideIndex);
  }

  mousedownHandler(evt) {
    let startEvt = evt;
    const {
      el, lineEl, cRect, vertical, minDistance,
    } = this;
    let distance = vertical ? cRect.width : cRect.height;
    // console.log('distance:', distance);
    lineEl.show();
    mouseMoveUp(window, (e) => {
      this.moving = true;
      if (startEvt !== null && e.buttons === 1) {
        // console.log('top:', top, ', left:', top, ', cRect:', cRect);
        if (vertical) {
          distance += e.movementX;
          if (distance > minDistance) {
            el.css('left', `${cRect.left + distance}px`);
          }
        } else {
          distance += e.movementY;
          if (distance > minDistance) {
            el.css('top', `${cRect.top + distance}px`);
          }
        }
        startEvt = e;
      }
    }, () => {
      startEvt = null;
      lineEl.hide();
      this.moving = false;
      this.hide();
      if (this.finishedFn) {
        if (distance < minDistance) distance = minDistance;
        this.finishedFn(cRect, distance);
      }
    });
  }
}
