/* global window */
function bind(target, name, fn, before = () => {}) {
  if(target === window || target === window.document.body){
    this.savedEventListeners.push({target, name, fn});
  }
  target.addEventListener(name, fn);
}
function unbind(target, name, fn) {
  if(target === window || target === window.document.body){
    for(let i = 0; i < this.savedEventListeners.length; i++){
      const eventListener = this.savedEventListeners[i];
      if(eventListener.target === target && eventListener.name === name && eventListener.fn === fn){
        target.removeEventListener(name, fn);
        this.savedEventListeners.splice(i, 1);
        i--;
      }
    }
  }
  target.removeEventListener(name, fn);
}
function unbindClickoutside(el) {
  if (el.el.xclickoutside) {
    this.unbind(window.document.body, 'click', el.el.xclickoutside);
    delete el.el.xclickoutside;
  }
}

// the left mouse button: mousedown → mouseup → click
// the right mouse button: mousedown → contenxtmenu → mouseup
// the right mouse button in firefox(>65.0): mousedown → contenxtmenu → mouseup → click on window
function bindClickoutside(el, cb) {
  this.unbindClickoutside(el);
  el.el.xclickoutside = (evt) => {
    // ignore double click
    // console.log('evt:', evt);
    if (evt.detail === 2 || el.contains(evt.target)) return;
    if (cb) cb(el);
    else {
      el.hide();
      this.unbindClickoutside(el);
    }
  };
  this.bind(window.document.body, 'click', el.el.xclickoutside);
}
export function mouseMoveUp(target, movefunc, upfunc) {
  this.bind(target, 'mousemove', movefunc);
  const t = target;
  t.xEvtUp = (evt) => {
    // console.log('mouseup>>>');
    this.unbind(target, 'mousemove', movefunc);
    this.unbind(target, 'mouseup', target.xEvtUp);
    upfunc(evt);
  };
  this.bind(target, 'mouseup', target.xEvtUp);
}

function calTouchDirection(spanx, spany, evt, cb) {
  let direction = '';
  // console.log('spanx:', spanx, ', spany:', spany);
  if (Math.abs(spanx) > Math.abs(spany)) {
    // horizontal
    direction = spanx > 0 ? 'right' : 'left';
    cb(direction, spanx, evt);
  } else {
    // vertical
    direction = spany > 0 ? 'down' : 'up';
    cb(direction, spany, evt);
  }
}
// cb = (direction, distance) => {}
function bindTouch(target, { move, end }) {
  let startx = 0;
  let starty = 0;
  this.bind(target, 'touchstart', (evt) => {
    const { pageX, pageY } = evt.touches[0];
    startx = pageX;
    starty = pageY;
  });
  this.bind(target, 'touchmove', (evt) => {
    if (!move) return;
    const { pageX, pageY } = evt.changedTouches[0];
    const spanx = pageX - startx;
    const spany = pageY - starty;
    if (Math.abs(spanx) > 10 || Math.abs(spany) > 10) {
      // console.log('spanx:', spanx, ', spany:', spany);
      calTouchDirection(spanx, spany, evt, move);
      startx = pageX;
      starty = pageY;
    }
    evt.preventDefault();
  });
  this.bind(target, 'touchend', (evt) => {
    if (!end) return;
    const { pageX, pageY } = evt.changedTouches[0];
    const spanx = pageX - startx;
    const spany = pageY - starty;
    calTouchDirection(spanx, spany, evt, end);
  });
}

// eventemiter
function createEventEmitter() {
  const listeners = new Map();

  function on(eventName, callback) {
    const push = () => {
      const currentListener = listeners.get(eventName);
      return (Array.isArray(currentListener)
          && currentListener.push(callback))
          || false;
    };

    const create = () => listeners.set(eventName, [].concat(callback));

    return (listeners.has(eventName)
        && push())
        || create();
  }

  function fire(eventName, args) {
    const exec = () => {
      const currentListener = listeners.get(eventName);
      for (const callback of currentListener) callback.call(null, ...args);
    };

    return listeners.has(eventName)
        && exec();
  }

  function removeListener(eventName, callback) {
    const remove = () => {
      const currentListener = listeners.get(eventName);
      const idx = currentListener.indexOf(callback);
      return (idx >= 0)
          && currentListener.splice(idx, 1)
          && listeners.get(eventName).length === 0
          && listeners.delete(eventName);
    };

    return listeners.has(eventName)
        && remove();
  }

  function once(eventName, callback) {
    const execCalllback = (...args) => {
      callback.call(null, ...args);
      removeListener(eventName, execCalllback);
    };

    return on(eventName, execCalllback);
  }

  function removeAllListeners() {
    listeners.clear();
  }

  return {
    get current() {
      return listeners;
    },
    on,
    once,
    fire,
    removeListener,
    removeAllListeners,
  };
}

function destroy(){
  for(const eventListener of this.savedEventListeners){
    eventListener.target.removeEventListener(eventListener.name, eventListener.fn);
  }
  this.savedEventListeners = [];
}

function Event() {
  this.savedEventListeners = [];
}

Event.prototype={
  bind,
  unbind,
  unbindClickoutside,
  bindClickoutside,
  mouseMoveUp,
  bindTouch,
  createEventEmitter,
  destroy
}

export default Event;