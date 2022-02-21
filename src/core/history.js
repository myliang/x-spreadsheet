// import helper from '../helper';
// import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import mergeWith from 'lodash/mergeWith';
import isEmpty from 'lodash/isEmpty';

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
      this.undoItems.length === 0 ? data
        : merge({}, this.undoItems.at(-1), data),
    );

    this.redoItems = [];
  }

  canUndo() {
    return this.undoItems.length > 0;
  }

  canRedo() {
    return this.redoItems.length > 0;
  }

  undo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canUndo()) {
      const currentState = undoItems.pop();
      redoItems.push(currentState);
      cb(merge({}, this.initialState, this.undoItems.at(-1) || {}));
    }
  }

  redo(currentd, cb) {
    const { undoItems, redoItems } = this;
    if (this.canRedo()) {
      const nextState = redoItems.pop();
      undoItems.push(nextState);
      console.log('redo', nextState);
      cb(
        merge({}, this.initialState, nextState),
        // mergeWith({}, this.initialState, nextState, (objValue, srcValue, key) => {
        //   if (key === 'text' && srcValue === null) {
        //     return null;
        //   }
        //   return undefined;
        // }),
      );
    }
  }

  merge(current, newState) {
    const diff = cloneDeep(current);
    Object.keys(newState).forEach((key) => {
      if (!diff[key]) {
        diff[key] = newState[key];
        return;
      }
      if (typeof newState[key] === 'object') {
        diff[key] = this.merge(diff[key], newState[key]);
      }
    });
    return diff;
  }
}
