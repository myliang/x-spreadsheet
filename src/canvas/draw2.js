class Draw {
  constructor(el) {
    this.el = el;
    this.ctx = el.getContext('2d');
  }

  clear() {
    const { width, height } = this.el;
    this.ctx.clearRect(0, 0, width, height);
    return this;
  }

  attr(m) {
    Object.assign(this.ctx, m);
    return this;
  }

  save() {
    this.ctx.save();
    this.ctx.beginPath();
    return this;
  }

  restore() {
    this.ctx.restore();
    return this;
  }

  beginPath() {
    this.ctx.beginPath();
    return this;
  }

  closePath() {
    this.ctx.closePath();
    return this;
  }

  measureText(text) {
    return this.ctx.measureText(text);
  }

  rect(x, y, width, height) {
    this.ctx.rect(x, y, width, height);
    return this;
  }

  scale(x, y) {
    this.ctx.scale(x, y);
    return this;
  }

  rotate(angle) {
    this.ctx.rotate(angle);
    return this;
  }

  translate(x, y) {
    this.ctx.translate(x, y);
    return this;
  }

  transform(a, b, c, d, e) {
    this.ctx.transform(a, b, c, d, e);
    return this;
  }

  fillRect(x, y, w, h) {
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  strokeRect(x, y, w, h) {
    this.ctx.strokeRect(x, y, w, h);
    return this;
  }

  fillText(text, x, y, maxWidth) {
    this.ctx.fillText(text, x, y, maxWidth);
    return this;
  }

  strokeText(text, x, y, maxWidth) {
    this.ctx.strokeText(text, x, y, maxWidth);
    return this;
  }
}

export default {};
export {
  Draw,
};
