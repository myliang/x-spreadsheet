import ConditionFactory from "./conditionfactory";

// middleman for conditional formatting - makes setting up easier/less verbose
export default class ConditionFormatter {
  constructor(rows, getCellText) {
    this.ConditionFactory = new ConditionFactory(rows, getCellText);
    this.conditionalFormatting = [];
  }

  generateStyles = (ri, ci, text) => {
    let style = {};
    this.conditionalFormatting.forEach(
      (test) => (style = { ...style, ...test(ri, ci, text) })
    );
    return style;
  };

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
  redFill,
  darkRedText,
  redBorder,
  redFillDarkRedText,
  yellowFillDarkYellowText,
  greenFillDarkGreenText
}
