// factory for conditional rendering checks
// currently will only check for values -- does not evaluate expressions

import _cell from "./cell";
import { formulam } from "./formula";

export default class ConditionFactory {
  constructor(rows, getCellText) {
    this.rows = rows;
    this.getCellText = getCellText;
  }

  // base from which all others will come from
  baseFunction = (minRi, maxRi, minCi, maxCi, check, style) => {
    // returns the check
    return (ri, ci, text) => {
      text = this.getExpressionValue(text);
      // evaluating expressions will be in here or check????
      if (ri >= minRi && ri <= maxRi && ci >= minCi && ci <= maxCi) {
        return check(text, ri, ci) ? style : {};
      }
    };
  };

  // function to evaluate expressions takes text from cell
  getExpressionValue = (expr) => {
    return _cell.render(expr, formulam, this.getCellText);
  };

  // style if input is greater than a given value
  greaterThan = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi, // range
      (text) => {
        return this.getExpressionValue(text) > this.getExpressionValue(value);
      }, // condition
      style // style
    );

  // style if input is less than a given value
  lessThan = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi,
      (text) => {
        return this.getExpressionValue(text) < this.getExpressionValue(value);
      },
      style
    );

  // style if input is between two given values (inclusive)
  between = (minRi, maxRi, minCi, maxCi, low, high, style) =>
    this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi,
      (text) => {
        const exprText = this.getExpressionValue(text);
        return (
          exprText >= this.getExpressionValue(low) &&
          exprText <= this.getExpressionValue(high)
        );
      },
      style
    );

  // style if input equals given value
  equal = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi,
      (text) =>
        this.getExpressionValue(text).toString() ===
        this.getExpressionValue(value).toString(),
      style
    );

  // style if input text contains a given value
  textContains = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi,
      (text) => {
        const exprText = this.getExpressionValue(text).toString();
        const exprValue = this.getExpressionValue(value).toString();
        return exprText.includes(exprValue);
      },
      style
    );

  // style if there are duplicate values in range
  // WILL NOT SCALE WELL TO LARGE RANGES
  duplicateValues = (minRi, maxRi, minCi, maxCi, style) => {
    const check = (text) => {
      const values = this.rows.getValuesInRange(minRi, maxRi, minCi, maxCi);
      // must use toString because we sometimes get numbers in value
      const duplicates = values
        .map((value) => this.getExpressionValue(value))
        .filter((value) => value.toString() === text.toString());
      return duplicates.length > 1;
    };
    return this.baseFunction(minRi, maxRi, minCi, maxCi, check, style);
  };
}
