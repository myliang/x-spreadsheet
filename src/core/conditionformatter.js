import ConditionFactory from "./conditionfactory";

// middleman for conditional formatting - makes setting up easier/less verbose
export default class ConditionFormatter {
  constructor(rows, getCellText) {
    this.ConditionFactory = new ConditionFactory(rows, getCellText);
    this.conditionalFormatting = [];
  }

  // generates conditional styles for given cell
  generateStyles = (ri, ci, text) => {
    let style = {};
    this.conditionalFormatting.forEach(
      (test) => (style = { ...style, ...test(ri, ci, text) })
    );
    return style;
  };

  // functions to create conditions
  addGreaterThan = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.greaterThan(
        minRi,
        maxRi,
        minCi,
        maxCi,
        value,
        style
      )
    );

  addLessThan = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.lessThan(minRi, maxRi, minCi, maxCi, value, style)
    );

  addBetween = (minRi, maxRi, minCi, maxCi, low, high, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.between(
        minRi,
        maxRi,
        minCi,
        maxCi,
        low,
        high,
        style
      )
    );

  addEqualTo = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.equal(minRi, maxRi, minCi, maxCi, value, style)
    );

  addTextContains = (minRi, maxRi, minCi, maxCi, value, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.textContains(
        minRi,
        maxRi,
        minCi,
        maxCi,
        value,
        style
      )
    );

  addCheckDuplicate = (minRi, maxRi, minCi, maxCi, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.duplicateValues(minRi, maxRi, minCi, maxCi, style)
    );

  addTopXItems = (minRi, maxRi, minCi, maxCi, x, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.topXItems(minRi, maxRi, minCi, maxCi, x, style)
    );

  addTopXPercent = (minRi, maxRi, minCi, maxCi, x, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.topXPercent(minRi, maxRi, minCi, maxCi, x, style)
    );

  addBottomXItems = (minRi, maxRi, minCi, maxCi, x, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.bottomXItems(minRi, maxRi, minCi, maxCi, x, style)
    );

  addBottomXPercent = (minRi, maxRi, minCi, maxCi, x, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.bottomXPercent(minRi, maxRi, minCi, maxCi, x, style)
    );

  addAboveAverage = (minRi, maxRi, minCi, maxCi, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.aboveAverage(minRi, maxRi, minCi, maxCi, style)
    );

  addBelowAverage = (minRi, maxRi, minCi, maxCi, style) =>
    this.conditionalFormatting.push(
      this.ConditionFactory.belowAverage(minRi, maxRi, minCi, maxCi, style)
    );
}

// style constants for convenience
const redBorderStyle = ["normal", "#8b0000"];

export const redFill = { bgcolor: "#ffcccb" };
export const darkRedText = { color: "#8b0000" };
export const redBorder = {
  border: {
    left: redBorderStyle,
    right: redBorderStyle,
    top: redBorderStyle,
    bottom: redBorderStyle,
  },
};
export const redFillDarkRedText = { bgcolor: "#ffcccb", color: "#8b0000" };
export const yellowFillDarkYellowText = {
  bgcolor: "#ffffa0",
  color: "#666600",
};
export const greenFillDarkGreenText = { bgcolor: "#99e2b4", color: "#344e41" };

export const styles = {
  redFillDarkRedText,
  redFill,
  darkRedText,
  redBorder,
  yellowFillDarkYellowText,
  greenFillDarkGreenText,
};
