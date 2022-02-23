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
    this.initialState = cloneDeep(data);
  }

  add(data) {
    this.undoItems.push(
      merge({}, this.undoItems.at(-1) || {}, data),
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
      cb(
        merge({}, this.initialState, this.undoItems.at(-1) || {}),
      );
    }
  }

  redo(cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      const nextState = redoItems.pop();
      undoItems.push(nextState);
      cb(
        merge({}, this.initialState, nextState),
      );
    }
  }
}
