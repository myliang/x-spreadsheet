/* global document */
class Element {
  constructor(tag, className = '') {
    this.el = document.createElement(tag);
    this.el.className = className;
    this.data = {};
  }

  data(key, value) {
    if (value !== undefined) {
      this.data[key] = value;
      return this;
    }
    return this.data[key];
  }

  on(eventName, handler) {
    const [fen, ...oen] = eventName.split('.');
    this.el.addEventListener(fen, (evt) => {
      for (let i = 0; i < oen.length; i += 1) {
        const k = oen[i];
        if (k === 'left' && evt.button !== 0) {
          return;
        } if (k === 'right' && evt.button !== 2) {
          return;
        } if (k === 'stop') {
          evt.stopPropagation();
        }
      }
      handler(evt);
    });
    return this;
  }

  offset(value) {
    const {
      offsetTop, offsetLeft, offsetHeight, offsetWidth,
    } = this.el;
    if (value !== undefined) {
      Object.keys(value).forEach((k) => {
        this.css(k, `${value[k]}px`);
      });
      return this;
    }
    return {
      top: offsetTop,
      left: offsetLeft,
      height: offsetHeight,
      width: offsetWidth,
    };
  }

  box() {
    return this.el.getBoundingClientRect();
  }

  parent() {
    return this.el.parentNode;
  }

  children(...eles) {
    eles.forEach(ele => this.child(ele));
    return this;
  }

  child(arg) {
    let ele = arg;
    if (typeof arg === 'string') {
      ele = document.createTextNode(arg);
    } else if (arg instanceof Element) {
      ele = arg.el;
    }
    this.el.appendChild(ele);
    return this;
  }

  contains(ele) {
    return this.el.contains(ele);
  }

  className() {
    return this.el.className;
  }

  addClass(name) {
    this.el.classList.add(name);
    return this;
  }

  hasClass(name) {
    return this.el.classList.contains(name);
  }

  removeClass(name) {
    this.el.classList.remove(name);
    return this;
  }

  toggleClass(name) {
    this.el.classList.toggle(name);
    return this;
  }

  // key, value
  // key
  // {k, v}...
  attr(key, value) {
    if (value !== undefined) {
      this.el.setAttribute(key, value);
    }
    if (typeof value === 'string') {
      return this.el.getAttribute(key);
    }
    Object.keys(key).forEach((k) => {
      this.el.setAttribute(k, key[k]);
    });
    return this;
  }

  removeAttr(key) {
    this.el.removeAttribute(key);
    return this;
  }

  html(content) {
    if (content !== undefined) {
      this.el.innerHTML = content;
      return this;
    }
    return this.el.innerHTML;
  }

  val(v) {
    if (v !== undefined) {
      this.el.value = v;
      return this;
    }
    return this.el.value;
  }

  // css( propertyName )
  // css( propertyName, value )
  // css( properties )
  css(name, value) {
    if (Array.isArray(name)) {
      Object.keys(name).forEach((k) => {
        this.el.style[k] = name[k];
      });
      return this;
    }
    if (value !== undefined) {
      this.el.style[name] = value;
      return this;
    }
    return this.el.style[name];
  }

  show() {
    this.css('display', 'block');
    return this;
  }

  hide() {
    this.css('display', 'none');
    return this;
  }
}

const h = (tag, className = '') => new Element(tag, className);

export {
  Element,
  h,
};
