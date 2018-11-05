export function bind(target, name, fn) {
  target.addEventListener(name, fn);
}
export function unbind(target, name, fn) {
  target.removeEventListener(name, fn);
}
export function mouseMoveUp(target, movefunc, upfunc) {
  bind(target, 'mousemove', movefunc);
  const t = target;
  t.xEvtUp = (evt) => {
    // console.log('mouseup>>>');
    unbind(target, 'mousemove', movefunc);
    unbind(target, 'mouseup', target.xEvtUp);
    upfunc(evt);
  };
  bind(target, 'mouseup', target.xEvtUp);
}
