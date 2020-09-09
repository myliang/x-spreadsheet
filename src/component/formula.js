import {
  stringAt,
  expr2xy,
  expr2cellRangeArgs,
  cellRangeArgs2expr,
  REGEX_EXPR_NONGLOBAL_AT_START,
  REGEX_EXPR_RANGE_NONGLOBAL_AT_START
} from '../core/alphabet';
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

function generalSelectCell(sri, sci, eri, eci) {
  if (this.cell) {
    const expr = cellRangeArgs2expr(sri, sci, eri, eci);
    const text = this.editor.inputText;
    const { from, to } = this.cell;

    this.editor.inputText = text.slice(0, from) + expr + text.slice(to);
    this.editor.render();
    setTimeout(() => {
      setCaretPosition(this.el, from + expr.length);
    });

    this.cell = null;
  }
}

export default class Formula {
  getCellPositionRange(cell) {
    const cellExpr = this.editor.inputText.slice(cell.from, cell.to);
    const cellRangeArgs = expr2cellRangeArgs(cellExpr);

    return new CellRange(...cellRangeArgs);
  }

  constructor(editor) {
    this.editor = editor;
    this.el = this.editor.textEl.el;
    this.cellEl = this.editor.cellEl.el;

    this.cells = [];
    this.cell = null;
    this.cellSelectStartRowCol = null;
    this.cellSelectEndRowCol = null;

    let cellLastSelectionColor = null;
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

      // If there's an active range/single formula cell (as determined by
      // whether it has the color property), see if either:
      // - there is no start value saved, suggesting that the formula cell was
      //   clicked (bypassing the selectCell call) rather than a sheet cell was
      //   selected via click
      // - there is a start value saved, but it is for a different formula
      //   cell than the current one (as determined by a color change),
      //   suggesting the user clicked on a different formula cell since
      //   last call
      // In either case, update the start/end select accordingly.
      // TODO: find a more reliable way to check a change of cell than by using
      //       the color property
      if (this.cell && this.cell.color &&
         (this.cell.color !== cellLastSelectionColor || !this.cellSelectStartRowCol)) {
          const cellRange = this.getCellPositionRange(this.cell);
          this.cellSelectStartRowCol = [cellRange.sri, cellRange.sci];
          this.cellSelectEndRowCol = [cellRange.eri, cellRange.eci];

          cellLastSelectionColor = this.cell.color;
      }

      this.renderCells();
    });

    this.el.addEventListener("keydown", (e) => {
      const keyCode = e.keyCode || e.which;

      if ([37, 38, 39, 40].indexOf(keyCode) == -1) return;

      if (!this.cell || this.cell.from == this.cell.to) return;

      e.preventDefault();
      e.stopPropagation();

      let rowShift = 0;
      let colShift = 0;

      // Left
      if (keyCode == 37) {
        colShift = -1;
      }
      // Up
      else if (keyCode == 38) {
        rowShift = -1;
      }
      // Right
      else if (keyCode == 39) {
        colShift = 1;
      }
      // Down
      else if (keyCode == 40) {
        rowShift = 1;
      }

      // If the shift key is applied, hold the start position fixed
      if (!e.shiftKey) {
        this.cellSelectStartRowCol[0] = Math.max(0, this.cellSelectStartRowCol[0] + rowShift);
        this.cellSelectStartRowCol[1] = Math.max(0, this.cellSelectStartRowCol[1] + colShift);
      }
      this.cellSelectEndRowCol[0]   = Math.max(0, this.cellSelectEndRowCol[0]   + rowShift);
      this.cellSelectEndRowCol[1]   = Math.max(0, this.cellSelectEndRowCol[1]   + colShift);

      // Get values before merge cells applied
      const cellRangeArgs = this.getCellRangeArgsFromSelectStartEnd();

      // Account for merge cells
      let cellRange = new CellRange(...cellRangeArgs);

      // Reapply merge cells after translation
      cellRange = this.editor.data.merges.union(cellRange)

      generalSelectCell.call(this, cellRange.sri, cellRange.sci, cellRange.eri, cellRange.eci);
    });
  }

  clear() {
    this.cell = null;
    this.cellSelectStartRowCol = null;
    this.cellSelectEndRowCol = null;
    this.cells = [];
    this.cellEl.innerHTML = '';
  }

  selectCell(ri, ci) {
    // To represent a single cell (no range), pass start and end row/col as
    // equal
    generalSelectCell.call(this, ri, ci, ri, ci);
    this.cellSelectStartRowCol = [ri, ci];
    this.cellSelectEndRowCol = [ri, ci];
  }

  selectCellRange(eri, eci) {
    if (this.cell) {
      // Selected end before union with merge cells
      this.cellSelectEndRowCol = [eri, eci];

      const cellRangeArgs = this.getCellRangeArgsFromSelectStartEnd();

      // Account for merge cells
      let cr = new CellRange(...cellRangeArgs);
      cr = this.editor.data.merges.union(cr);

      // Keep current cell range start, but use new range end values
      generalSelectCell.call(this, cr.sri, cr.sci, cr.eri, cr.eci);
    }
  }

  getCellRangeArgsFromSelectStartEnd() {
      // Normalize so that start index is not larger than the end index
      let [sri, sci] = this.cellSelectStartRowCol;
      let [eri, eci] = this.cellSelectEndRowCol;

      if (sri > eri) {
        [sri, eri] = [eri, sri];
      }
      if (sci > eci) {
        [sci, eci] = [eci, sci];
      }

      return [sri, sci, eri, eci];
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
      if ((m = sub.match(REGEX_EXPR_RANGE_NONGLOBAL_AT_START))) {
        // cell range
        const color = pickColor();
        html += `<span class="formula-token" style="color:${color}">${m[0]}</span>`;

        this.cells.push({
          from: i,
          to: i + m[0].length,
          color,
        });
        pre = 1;
        i = i + m[0].length;
      } else if ((m = sub.match(REGEX_EXPR_NONGLOBAL_AT_START))) {
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

    const afterOpenParen = (pre == 5) && (text[i - 1] == '(');
    if (pre == 4 || afterOpenParen) {
      // between operator and the end of text
      this.cells.push({
        from: text.length,
        to: text.length,
      });
    }

    this.el.innerHTML = html;
  }

  renderCells() {
    const cells = this.cells;
    const data = this.editor.data;
    let cellHtml = "";

    for (let cell of cells) {
      const { color } = cell;
      if (color) {
        const cellRange = this.getCellPositionRange(cell);

        const cellRangeIncludingMerges = data.merges.union(cellRange);
        const box = data.getRect(cellRangeIncludingMerges);
        const { left, top, width, height } = box;
        cellHtml += renderCell(left, top, width, height, color, this.cell === cell);
      }
    }

    this.cellEl.innerHTML = cellHtml;
  }
}