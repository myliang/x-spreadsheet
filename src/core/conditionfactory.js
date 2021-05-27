// factory for conditional rendering checks
// currently will only check for values -- does not evaluate expressions

import _cell from "./cell";
import { formulam } from "./formula";

export default class ConditionFactory {
  constructor(rows, getCellText) {
    this.rows = rows;
    this.getCellText = getCellText;
  }

  // base for general rules
  baseFunction = (minRi, maxRi, minCi, maxCi, check, style) => {
    // returns the check
    return (ri, ci, text) => {
      text = this.getExpressionValue(text);
      if (ri >= minRi && ri <= maxRi && ci >= minCi && ci <= maxCi) {
        return check(text, ri, ci) ? style : {};
      }
    };
  };

  // base for rules requiring number inputs
  baseNumberFunction = (minRi, maxRi, minCi, maxCi, check, style) => {
    // returns the check
    return (ri, ci, text) => {
      text = this.getExpressionValue(text);
      if (!parseFloat(text)) {
        return false;
      }
      const input = parseFloat(text);
      if (ri >= minRi && ri <= maxRi && ci >= minCi && ci <= maxCi) {
        return check(input, ri, ci) ? style : {};
      }
    };
  };

  // function to evaluate expressions takes text from cell
  getExpressionValue = (expr) => {
    return _cell.render(expr || "", formulam, this.getCellText);
  };

  // get expression values in range
  getExpressionValuesFromRange = (minRi, maxRi, minCi, maxCi, numbersOnly) => {
    const values = this.rows
      .getValuesInRange(minRi, maxRi, minCi, maxCi)
      .map((value) => this.getExpressionValue(value));
    if (!numbersOnly) {
      return values;
    } else {
      return values
        .filter((value) => parseFloat(value).toString() === value.toString())
        .map((value) => parseFloat(value));
    }
  };

  // helper function to check if input text is a number
  isNumber = (value) => {
    return (
      parseFloat(value).toString() === value ||
      parseFloat(value).toFixed(2) === value // hotfix for now - check formats
    );
  };

  //=========================Highlight Cell Conditions=========================//

  // style if input is greater than a given value
  greaterThan = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi, // range
      (text) => {
        const exprVal = this.getExpressionValue(value);
        if (this.isNumber(text) && this.isNumber(exprVal)) {
          // compare numbers
          return parseFloat(text) > parseFloat(exprVal);
        }
        // compare strings
        return text > exprVal;
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
        const exprVal = this.getExpressionValue(value);
        if (this.isNumber(text) && this.isNumber(exprVal)) {
          // compare numbers
          return parseFloat(text) < parseFloat(exprVal);
        }
        console.log("comparing str", text, exprVal);
        // compare strings
        return text < exprVal;
      },
      style
    );

  // style if input is between two given values (inclusive)
  between = (minRi, maxRi, minCi, maxCi, low, high, style) => {
    return this.baseFunction(
      minRi,
      maxRi,
      minCi,
      maxCi,
      (text) => {
        let exprLow = this.getExpressionValue(low);
        let exprHigh = this.getExpressionValue(high);
        if (
          (this.isNumber(exprLow) &&
            this.isNumber(exprHigh) &&
            parseFloat(exprLow) > parseFloat(exprHigh)) ||
          (!this.isNumber(exprLow) &&
            !this.isNumber(exprHigh) &&
            exprLow > exprHigh)
        ) {
          const temp = exprLow;
          exprLow = exprHigh;
          exprHigh = temp;
        }
        if (
          this.isNumber(text) &&
          this.isNumber(exprLow) &&
          this.isNumber(exprHigh)
        ) {
          // compare numbers
          return (
            parseFloat(text) >= parseFloat(exprLow) &&
            parseFloat(text) <= parseFloat(exprHigh)
          );
        }
        // compare strings
        return text >= exprLow && text <= exprHigh;
      },
      style
    );
  };

  // style if input is outside given range - only works on numbers
  variance = (minRi, maxRi, minCi, maxCi, value, tolerance, style) =>
    this.baseNumberFunction(
      minRi,
      maxRi,
      minCi,
      maxCi,
      (input) => {
        let exprValue = parseFloat(this.getExpressionValue(value));
        let exprTolerance = parseFloat(this.getExpressionValue(tolerance));
        if (!exprValue || !exprTolerance) {
          // if not numbers don't style
          return false
        }
        return input < exprValue - exprTolerance || input > exprValue + exprTolerance
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
      (text) => text.toString() === this.getExpressionValue(value).toString(),
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
        const exprValue = this.getExpressionValue(value).toString();
        return text.includes(exprValue);
      },
      style
    );

  // style if there are duplicate values in range
  duplicateValues = (minRi, maxRi, minCi, maxCi, style) => {
    const check = (text) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        false
      );
      // must use toString because we sometimes get numbers in value
      const duplicates = values.filter(
        (value) => value.toString() === text.toString()
      );
      return duplicates.length > 1;
    };
    return this.baseFunction(minRi, maxRi, minCi, maxCi, check, style);
  };

  //=========================Top/Bottom Conditions=========================//
  // The rules below will only consider numeric inputs - ignore all others

  // style if input is in top x items in range
  topXItems = (minRi, maxRi, minCi, maxCi, x, style) => {
    const check = (input) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        true
      );
      const sorted = values.sort((a, b) => (a > b ? -1 : 1));
      if (x >= sorted.length) {
        return true;
      } else {
        return input > sorted[x];
      }
    };
    return this.baseNumberFunction(minRi, maxRi, minCi, maxCi, check, style);
  };

  // style if input is in top x% items in range
  topXPercent = (minRi, maxRi, minCi, maxCi, x, style) => {
    const check = (input) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        true
      );
      const sorted = values.sort((a, b) => (a > b ? -1 : 1));
      const percentage = sorted.indexOf(input) / sorted.length;
      return percentage * 100 < x;
    };
    return this.baseNumberFunction(minRi, maxRi, minCi, maxCi, check, style);
  };

  // style if input is in bottom x items in range
  bottomXItems = (minRi, maxRi, minCi, maxCi, x, style) => {
    const check = (input) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        true
      );
      const sorted = values.sort((a, b) => (a < b ? -1 : 1));
      if (x >= sorted.length) {
        return true;
      } else {
        return input < sorted[x];
      }
    };
    return this.baseNumberFunction(minRi, maxRi, minCi, maxCi, check, style);
  };

  // style if input is in bottom x items in range
  bottomXPercent = (minRi, maxRi, minCi, maxCi, x, style) => {
    const check = (input) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        true
      );
      const sorted = values.sort((a, b) => (a < b ? -1 : 1));
      const percentage = sorted.indexOf(input) / sorted.length;
      return percentage * 100 < x;
    };
    return this.baseNumberFunction(minRi, maxRi, minCi, maxCi, check, style);
  };

  // style if input is above average values in range
  aboveAverage = (minRi, maxRi, minCi, maxCi, style) => {
    const check = (input) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        true
      );
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      return input > sum / values.length;
    };
    return this.baseNumberFunction(minRi, maxRi, minCi, maxCi, check, style);
  };

  // style if input is below average values in range
  belowAverage = (minRi, maxRi, minCi, maxCi, style) => {
    const check = (input) => {
      const values = this.getExpressionValuesFromRange(
        minRi,
        maxRi,
        minCi,
        maxCi,
        true
      );
      const sum = values.reduce((acc, curr) => acc + curr, 0);
      return input < sum / values.length;
    };
    return this.baseNumberFunction(minRi, maxRi, minCi, maxCi, check, style);
  };
}
