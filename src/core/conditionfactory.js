// factory for conditional rendering checks
// currently will only check for values -- does not evaluate expressions

/*
 * GOOD MORNING FRIDAY JULIEN
 * The issue is with the getCellText function, it's getting the order mixed up.
 * Kinda funny to see it'll work perfectly on diagonals (A1, B2, C3, ...)
 * You need to look into the function in data_proxy and find a way to fix this behaviour
 * WITHOUT BREAKING THE REST OF THE APP
 */

import _cell from './cell'
import { formulam } from './formula'

export default class ConditionFactory {
  constructor (rows, getCellText) {
    this.rows = rows
    this.getCellText = getCellText
  }

  // base from which all others will come from
  baseFunction = (minRi, maxRi, minCi, maxCi, check, style) => {
    // returns the check
    return (ri, ci, text) => {
      text = this.getExpressionValue(text)
      // evaluating expressions will be in here or check????
      if (ri >= minRi && ri <= maxRi && ci >= minCi && ci <= maxCi) {
        return check(text, ri, ci) ? style : {}
      }
    } 
  }

  // function to evaluate expressions takes text from cell
  getExpressionValue = (expr) => {
    return _cell.render(expr, formulam, this.getCellText)
  }

  // style if a number is greater than a given value
  numberGreaterThan = (minRi, maxRi, minCi, maxCi, value, style) => this.baseFunction(
    minRi, maxRi, minCi, maxCi, // range
    (text) => {
      return this.getExpressionValue(text) > this.getExpressionValue(value)
    }, // condition
    style // style
  )

  // style if there are duplicate values in range
  // WILL NOT SCALE WELL TO LARGE RANGES
  duplicateValues = (minRi, maxRi, minCi, maxCi, style) => {
    const check = (text) => {
      const values = this.rows.getValuesInRange(minRi, maxRi ,minCi, maxCi)
      const duplicates = values.filter(value => value === text)
      return duplicates.length > 1
    }
    return this.baseFunction(minRi, maxRi, minCi, maxCi, check, style)
  }

  // testing expressions
  exprTest = (minRi, maxRi, minCi, maxCi, style) => {
    console.log('=A1+B1:', this.getExpressionValue('=A1+B1'))
    return this.baseFunction(minRi, maxRi, minCi, maxCi, (text) => !!text, style)
  }
}
