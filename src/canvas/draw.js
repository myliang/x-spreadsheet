class DrawBox {
  constructor(x, y, w, h, padding = 0) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.padding = padding;
    this.bgcolor = '#ffffff';
    // border: [width, style, color]
    this.border = null;
    this.borderTop = null;
    this.borderRight = null;
    this.borderBottom = null;
    this.borderLeft = null;
  }
  setBorders(b, bt, br, bb, bl) {
    this.border = b;
    if (bt) this.borderTop = bt;
    if (br) this.borderRight = br;
    if (bb) this.borderBottom = bb;
    if (bl) this.borderLeft = bl;
  }
  innerWidth() {
    return this.width - (this.padding * 2);
  }
  innerHeight() {
    return this.height - (this.padding * 2);
  }
  textx(align) {
    const { width, padding } = this;
    let { x } = this;
    if (align === 'left') {
      x += padding;
    } else if (align === 'center') {
      x += width / 2;
    } else if (align === 'right') {
      x += width - padding;
    }
    return x;
  }
  texty(align) {
    const { height, padding } = this;
    let { y } = this;
    if (align === 'top') {
      y += padding;
    } else if (align === 'middle') {
      y += height / 2;
    } else if (align === 'bottom') {
      y += height - padding;
    }
    return y;
  }
  topxys() {
    const { x, y, width } = this;
    return [[x, y], [x + width, y]];
  }
  rightxys() {
    const {
      x, y, width, height,
    } = this;
    return [[x + width, y], [x + width, y + height]];
  }
  bottomxys() {
    const {
      x, y, width, height,
    } = this;
    return [[x, y + height], [x + width, y + height]];
  }
  leftxys() {
    const {
      x, y, height,
    } = this;
    return [[x, y], [x, y + height]];
  }
}

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
  attr(options) {
    Object.assign(this.ctx, options);
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
  translate(x, y) {
    this.ctx.translate(x, y);
    return this;
  }
  fillRect(x, y, w, h) {
    this.ctx.fillRect(x, y, w, h);
    return this;
  }
  fillText(text, x, y) {
    this.ctx.fillText(text, x, y);
    return this;
  }
  /*
    txt: render text
    box: Box
    attr: {
      textAlign: left | center | right
      textBaseline: top | middle | bottom
      font: text font
      fillStyle: text color
    }
    wrapText: wrap text
  */
  text(txt, box, attr = {}, wrapText = true) {
    // console.log('attr: ', attr, ', wrapText: ', wrapText, ', text:', txt);
    const { ctx } = this;
    const tx = box.textx(attr.textAlign);
    let ty = box.texty(attr.textBaseline);
    ctx.save();
    this.attr(attr);
    const txtWidth = ctx.measureText(txt).width;
    // console.log('txtWidth: ', txtWidth);
    if (wrapText && txtWidth > box.innerWidth()) {
      const textLine = { len: 0, start: 0 };
      for (let i = 0; i < txt.length; i += 1) {
        textLine.len += ctx.measureText(txt[i]).width;
        if (textLine.len >= box.innerWidth()) {
          ctx.fillText(txt.substring(textLine.start, i), tx, ty);
          ty += box.innerHeight();
          textLine.len = 0;
          textLine.start = i;
        }
      }
      if (textLine.len > 0) {
        ctx.fillText(txt.substring(textLine.start), tx, ty);
      }
    } else {
      ctx.fillText(txt, tx, ty);
    }
    ctx.restore();
    return this;
  }
  border(width, style, color) {
    const { ctx } = this;
    ctx.lineWidth = width - 0.5;
    ctx.strokeStyle = color;
    if (style === 'dashed') ctx.setLineDash([5, 2]);
    return this;
  }
  line(...xys) {
    const { ctx } = this;
    if (xys.length > 1) {
      const [x, y] = xys[0];
      ctx.moveTo(x + 0.5, y + 0.5);
      for (let i = 1; i < xys.length; i += 1) {
        const [x1, y1] = xys[i];
        ctx.lineTo(x1 + 0.5, y1 + 0.5);
      }
      ctx.stroke();
    }
  }
  rect(box) {
    const { ctx } = this;
    const {
      x, y, width, height, bgcolor,
    } = box;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.fillStyle = bgcolor;
    ctx.fill();
    // border
    const {
      border, borderTop, borderRight, borderBottom, borderLeft,
    } = box;
    if (border) {
      this.border(...border);
      ctx.stroke();
    } else {
      if (borderTop) {
        this.border(...borderTop);
        this.line(box.topxys());
      }
      if (borderRight) {
        this.border(...borderRight);
        this.line(box.rightxys());
      }
      if (borderBottom) {
        this.border(...borderBottom);
        this.line(box.bottomxys());
      }
      if (borderLeft) {
        this.border(...borderLeft);
        this.line(box.leftxys());
      }
    }
    ctx.restore();
  }
}
export default {};
export {
  Draw,
  DrawBox,
};
