import helper from "./helper";

export default class History {
  constructor() {
    this.undoItems = [];
    this.redoItems = [];
  }

  init(data) {
    if (data) {
      this.initialLength = { rows: data.rows.len, cols: data.cols.len };
      this.initial = JSON.stringify(data);
    }
    this.undoItems = [];
    this.redoItems = [];
  }

  get initialState() {
    return JSON.parse(this.initial);
  }

  get initialLen() {
    return this.initialLength;
  }

  add([data, selector]) {
    const [state] = this.undoItems.at(-1) || [{}];
    this.undoItems.push([this.merge(data, state), selector]);
    this.redoItems = [];
  }

  canUndo() {
    return this.undoItems.length > 0;
  }

  canRedo() {
    return this.redoItems.length > 0;
  }

  undo(cb) {
    const { undoItems, redoItems } = this;
    if (this.canUndo()) {
      const currentState = undoItems.pop();
      redoItems.push(currentState);
      const [state] = undoItems.at(-1) || [{}];
      cb([this.merge(state), currentState[1]]);
    }
  }

  redo(cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      const [state, selector] = redoItems.pop();
      undoItems.push([state, selector]);
      cb([this.merge(state), selector]);
    }
  }

  getChangedCellValues() {
    const [state] = this.undoItems.at(-1) || [{}];

    const { rows } = state;

    const parsedInitial = JSON.parse(this.initial);

    const getValue = (ri, ci) => {
      let val;

      if (
        rows[ri].cells[ci] &&
        rows[ri].cells[ci].text &&
        ((parsedInitial.rows[ri] &&
          parsedInitial.rows[ri].cells[ci] &&
          parsedInitial.rows[ri].cells[ci].text !== rows[ri].cells[ci].text) ||
          !parsedInitial.rows[ri] ||
          !parsedInitial.rows[ri].cells[ci])
      ) {
        val = rows[ri].cells[ci].text;
      }

      return val;
    };

    if (rows) {
      const set = [];

      Object.keys(rows).forEach((ri) => {
        if (rows[ri].cells) {
          Object.keys(rows[ri].cells).forEach((ci) => {
            const value = getValue(ri, ci);

            if (value) {
              set.push({ ri: parseInt(ri, 10), ci: parseInt(ci, 10), value });
            }
          });
        }
      });

      return set;
    }

    return [];
  }

  merge(newState, oldState) {
    const initial = oldState || JSON.parse(this.initial);
    return helper.merge(initial, newState);
  }

  updateUndoItemCellText(ri, ci, text, stateIndex = -1) {
    const { undoItems } = this;
    if (undoItems.length === 0) return;
    const [item] = undoItems.at(stateIndex);
    if (!item.rows[ri] || !item.rows[ri].cells || !item.rows[ri].cells[ci])
      return;
    if (item.rows[ri].cells[ci].text !== text) {
      item.rows[ri].cells[ci].text = text;
    }
  }

  destroy() {
    delete this.initial;
    delete this.undoItems;
    delete this.redoItems;
  }
}
