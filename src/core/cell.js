// formulaParser is a Parser object from the hot-formula-parser package
const cellRender = (src, formulaParser) => {
  // If cell contains a formula, recursively parse that formula to get the value
  if (src.length > 0 && src[0] === '=') {
    const parsedResult = formulaParser.parse(src.slice(1));
    const recursedSrc = (parsedResult.error) ?
            parsedResult.error :
            parsedResult.result;

    const parsedResultRecurse = cellRender(recursedSrc, formulaParser);
    return parsedResultRecurse;
  }

  // If cell doesn't contain a formula, render its content as is
  return src;
};

export default {
  render: cellRender,
};
