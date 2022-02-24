// import helper from '../helper';
// import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';

export default class History {
  constructor() {
    this.undoItems = [];
    this.redoItems = [];
  }

  init(data) {
    if (data) {
      this.initialState = cloneDeep(data);
    }
    this.undoItems = [];
    this.redoItems = [];
  }

  add([data, selector]) {
    const [state] = this.undoItems.at(-1) || [{}];
    this.undoItems.push(
      [merge({}, state, data), selector],
    );
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
      cb(
        [merge({}, this.initialState, state || {}), currentState[1]],
      );
    }
  }

  redo(cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      const [state, selector] = redoItems.pop();
      undoItems.push([state, selector]);
      cb(
        [merge({}, this.initialState, state), selector],
      );
    }
  }

  getChangedCellValues() {
    const [state] = this.undoItems.at(-1) || [{}];
    const { rows } = state;
    const getValue = (ri, ci) => {
      let val;
      if (rows[ri].cells[ci]
        && rows[ri].cells[ci].text
          && ((this.initialState[ri]
            && this.initialState[ri].cells[ci]
              && (this.initialState[ri].cells[ci].text !== rows[ri].cells[ci].text))
              || !this.initialState[ri]
              || !this.initialState[ri].cells[ci])) {
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
}
