// Thanks to https://stackoverflow.com/questions/4576694/saving-and-restoring-caret-position-for-contenteditable-div

export function getCaretPosition(context) {
  const selection = window.getSelection();
  const range = selection.getRangeAt(0).cloneRange();
  range.setStart(context, 0);
  const index = range.toString().length;
  return index;
}

function getTextNodeAtPosition(root, index) {
  const treeWalker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    function next(elem) {
      if (index > elem.textContent.length) {
        index -= elem.textContent.length;
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  );
  const c = treeWalker.nextNode();
  return {
    node: c ? c : root,
    position: index,
  };
}

export function setCaretPosition(context, index) {
  const selection = window.getSelection();
  const pos = getTextNodeAtPosition(context, index);
  selection.removeAllRanges();
  const range = new Range();
  range.setStart(pos.node, pos.position);
  selection.addRange(range);
}

export function saveCaretPosition(context) {
  const index = getCaretPosition(context);
  return function restore() {
    setCaretPosition(context, index);
  };
}