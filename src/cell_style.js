/* eslint lines-between-class-members: ["error", "never"] */
// default cell style
const defaultCellStyle = {
  color: '#ffffff',
  align: 'left',
  valign: 'middle',
  wrapText: false,
  font: {
    name: 'Arial',
    size: 14,
    color: '#666666',
    bitmap: 0,
  },
};

// font
const fontProperties = ['name', 'size', 'color', 'bitmap'];

class Font {
  constructor(options = {}) {
    this.name = options.name;
    this.size = options.size;
    this.color = options.color;
    this.bitmap = options.bitpmap || 0;
  }
  toJson() {
    const map = {};
    fontProperties.forEach((prop) => {
      if (this[prop]) {
        map[prop] = this[prop];
      }
    });
    return JSON.stringify(map);
  }
  equals(font) {
    return fontProperties.every(p => this[p] === font[p]);
  }
}

// cell style
const cellStyleProperties = ['color', 'align', 'valign', 'wrapText', 'font'];

class CellStyle {
  constructor(options = {}) {
    this.color = options.color;
    this.align = options.align;
    this.valign = options.valign;
    this.wrapText = options.wrapText;
    this.font = options.font;
  }
  toJson() {
    const map = {};
    cellStyleProperties.forEach((prop) => {
      if (this[prop]) {
        map[prop] = this[prop];
      }
    });
    return JSON.stringify(map);
  }
  equals(font) {
    return cellStyleProperties.every(p => this[p] === font[p]);
  }
}

export default {
  default: defaultCellStyle,
  Font,
  CellStyle,
};
