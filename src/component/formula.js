import { stringAt, expr2xy } from '../core/alphabet';
import { setCaretPosition, getCaretPosition } from '../core/caret';
import CellRange from '../core/cell_range';

function renderCell(left, top, width, height, color, selected = false) {
  let style = `position:absolute;box-sizing: border-box;`;
  style += `left:${left}px;`;
  style += `top:${top}px;`;
  style += `width:${width}px;`;
  style += `height:${height}px;`;
  style += `border:${color} 2px dashed;`;
  if (selected) {
    style += `background:rgba(101, 101, 101, 0.1);`;
  }
  return `<div style="${style}"></div>`;
}

export default class Formula {
  constructor(editor) {
    this.editor = editor;
    this.el = this.editor.textEl.el;
    this.cellEl = this.editor.cellEl.el;

    this.cells = [];
    this.cell = null;
    document.addEventListener("selectionchange", () => {
      if (document.activeElement !== this.el) return;

      this.cell = null;
      if (this.editor.inputText[0] != '=') return;

      const index = getCaretPosition(this.el);
      for (let cell of this.cells) {
        const { from, to } = cell;
        if (from <= index && index <= to) {
          this.cell = cell;
          break;
        }
      }

      this.renderCells();
    });

    this.el.addEventListener("keydown", (e) => {
      const keyCode = e.keyCode || e.which;
      if ([37, 38, 39, 40].indexOf(keyCode) == -1) return;

      if (!this.cell || this.cell.from == this.cell.to) return;

      e.preventDefault();
      e.stopPropagation();

      const text = this.editor.inputText;
      let expr = text.slice(this.cell.from, this.cell.to);
      let [ci, ri] = expr2xy(expr);

      const { merges } = this.editor.data;
      let mergeCell = merges.getFirstIncludes(ri, ci);
      if (mergeCell) {
        ri = mergeCell.sri;
        ci = mergeCell.sci;
      }

      if (keyCode == 37 && ci >= 1) {
        ci -= 1;
      } else if (keyCode == 38 && ri >= 1) {
        ri -= 1;
      }
      else if (keyCode == 39) {
        if (mergeCell) {
          ci = mergeCell.eci;
        }
        ci += 1;
      }
      else if (keyCode == 40) {
        if (mergeCell) {
          ri = mergeCell.eri;
        }
        ri += 1;
      }

      mergeCell = merges.getFirstIncludes(ri, ci);
      if (mergeCell) {
        ri = mergeCell.sri;
        ci = mergeCell.sci;
      }

      this.selectCell(ri, ci);
    });
  }

  clear() {
    this.cell = null;
    this.cells = [];
    this.cellEl.innerHTML = '';
  }

  selectCell(ri, ci) {
    if (this.cell) {
      const row = String(ri + 1);
      const col = stringAt(ci);
      const text = this.editor.inputText;
      const { from, to } = this.cell;

      this.editor.inputText = text.slice(0, from) + col + row + text.slice(to);
      this.editor.render();
      setTimeout(() => {
        setCaretPosition(this.el, from + col.length + row.length);
      });

      this.cell = null;
    }
  }

  render() {
    const text = this.editor.inputText;
    this.cells = [];

    let i = 0;
    let m = null;
    let html = "";

    const goldenRatio = 0.618033988749895;
    let h = 34 / 360;
    function pickColor() {
      const color = `hsl(${Math.floor(h * 360)}, 90%, 50%)`;
      h += goldenRatio;
      h %= 1;
      return color;
    }

    let pre = 0;
    while (i < text.length) {
      const sub = text.slice(i);
      if ((m = sub.match(/^[A-Za-z]+[1-9][0-9]*/))) {
        // cell
        const color = pickColor();
        html += `<span class="formula-token" style="color:${color}">${m[0]}</span>`;

        this.cells.push({
          from: i,
          to: i + m[0].length,
          color,
        });
        pre = 1;
        i = i + m[0].length;
      } else if ((m = sub.match(/^[A-Za-z]+/))) {
        // function
        html += `<span class="formula-token">${m[0]}</span>`;
        pre = 2;
        i = i + m[0].length;
      } else if ((m = sub.match(/^[0-9.]+/))) {
        // number
        html += `<span class="formula-token">${m[0]}</span>`;
        pre = 3;
        i = i + m[0].length;
      } else if ((m = sub.match(/^[\+\-\*\/\,\=]/))) {
        // operator
        html += `<span class="formula-token">${m[0]}</span>`;
        if (pre == 4) {
          // between two operators
          this.cells.push({
            from: i,
            to: i,
          });
        }
        if (text[i - 1] == '(') {
          // between '(' and operator
          this.cells.push({
            from: i,
            to: i,
          });
        }
        pre = 4;
        i = i + 1;
      } else if ((m = sub.match(/^[\(\)]/))) {
        // parenthesis
        html += `<span class="formula-token">${m[0]}</span>`;
        if (text[i - 1] == '(' && text[i] == ')') {
          // between parenthesis pair
          this.cells.push({
            from: i,
            to: i,
          });
        }
        if (pre == 4 && text[i] == ')') {
          // between operator and ')'
          this.cells.push({
            from: i,
            to: i,
          });
        }
        pre = 5;
        i = i + 1;
      } else {
        // unknown
        html += `<span class="formula-token">${text.charAt(i)}</span>`;
        pre = 6;
        i = i + 1;
      }
    }

    if (pre == 4) {
      // between operator and the end of text
      this.cells.push({
        from: text.length,
        to: text.length,
      });
    }

    // console.log('formula cells', this.cells);

    this.el.innerHTML = html;
  }

  renderCells() {
    const text = this.editor.inputText;
    const cells = this.cells;
    const data = this.editor.data;
    let cellHtml = "";

    for (let cell of cells) {
      const { from, to, color } = cell;
      if (color) {
        const [ci, ri] = expr2xy(text.slice(from, to));
        const mergeCell = data.merges.getFirstIncludes(ri, ci);
        let box = null;
        if (mergeCell) {
          box = data.getRect(mergeCell);
        } else {
          box = data.getRect(new CellRange(ri, ci, ri, ci));
        }
        const { left, top, width, height } = box;
        cellHtml += renderCell(left, top, width, height, color, this.cell === cell);
      }
    }

    this.cellEl.innerHTML = cellHtml;
  }
}