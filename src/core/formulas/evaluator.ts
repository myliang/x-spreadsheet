import type { CellPoint } from '../types/coordinates';
import type { A1Reference } from '../coordinates/a1';
import { FORMULA_FUNCTIONS, legacyNumberCalc } from './functions';
import type { FormulaFunctionName, FormulaScalar } from './functions';
import { parseFormula } from './parser';
import type { BinaryOperator, FormulaExpression } from './parser';
import { isFormulaError } from './rendered-value';
import type { FormulaErrorValue, RenderedValue } from './rendered-value';

export type CellSelector = (point: CellPoint) => string | number | boolean | null | undefined;

interface EvaluationContext {
  readonly selectCell: CellSelector;
  readonly active: Set<string>;
}

type EvaluationValue = RenderedValue | readonly FormulaScalar[];

function pointKey(point: CellPoint): string {
  return `${point.row}:${point.column}`;
}

function scalar(value: EvaluationValue): FormulaScalar | FormulaErrorValue {
  if (Array.isArray(value)) return '#ERROR!';
  return value as FormulaScalar;
}

function evaluatePoint(point: CellPoint, context: EvaluationContext): RenderedValue {
  const key = pointKey(point);
  if (context.active.has(key)) return '#CYCLE!';
  context.active.add(key);
  try {
    const stored = context.selectCell(point);
    if (stored === null || stored === undefined) return '';
    if (typeof stored !== 'string' || !stored.startsWith('=')) return stored;
    return evaluateSource(stored, context);
  } finally {
    context.active.delete(key);
  }
}

function referencePoint(reference: A1Reference): CellPoint {
  return { row: reference.row, column: reference.column };
}

function binary(operator: BinaryOperator, left: FormulaScalar, right: FormulaScalar): RenderedValue {
  if (operator === '&') return `${left}${right}`;
  if (operator === '=') return Number.isNaN(Number(left)) || Number.isNaN(Number(right))
    ? left === right
    : Number(left) === Number(right);
  if (operator === '==' ) return left === right || Number(left) === Number(right);
  if (operator === '<>' || operator === '!=') return !(left === right || Number(left) === Number(right));
  if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') {
    const a = Number.isNaN(Number(left)) ? String(left) : Number(left);
    const b = Number.isNaN(Number(right)) ? String(right) : Number(right);
    if (operator === '>') return a > b;
    if (operator === '>=') return a >= b;
    if (operator === '<') return a < b;
    return a <= b;
  }
  return legacyNumberCalc(operator, left, right);
}

function evaluate(expression: FormulaExpression, context: EvaluationContext): EvaluationValue {
  if (expression.kind === 'number' || expression.kind === 'string') return expression.value;
  if (expression.kind === 'reference') return evaluatePoint(referencePoint(expression.reference), context);
  if (expression.kind === 'range') {
    const startRow = Math.min(expression.start.row, expression.end.row);
    const endRow = Math.max(expression.start.row, expression.end.row);
    const startColumn = Math.min(expression.start.column, expression.end.column);
    const endColumn = Math.max(expression.start.column, expression.end.column);
    const values: FormulaScalar[] = [];
    // Legacy ranges expand columns first, then rows.
    for (let column = startColumn; column <= endColumn; column += 1) {
      for (let row = startRow; row <= endRow; row += 1) {
        const value = evaluatePoint({ row, column }, context);
        if (isFormulaError(value)) return value;
        values.push(value);
      }
    }
    return values;
  }
  if (expression.kind === 'unary') {
    const operand = scalar(evaluate(expression.operand, context));
    if (isFormulaError(operand)) return operand;
    const value = Number(operand);
    return Number.isNaN(value) ? '#ERROR!' : -value;
  }
  if (expression.kind === 'binary') {
    const left = scalar(evaluate(expression.left, context));
    if (isFormulaError(left)) return left;
    const right = scalar(evaluate(expression.right, context));
    if (isFormulaError(right)) return right;
    return binary(expression.operator, left, right);
  }

  if (!Object.hasOwn(FORMULA_FUNCTIONS, expression.name)) return '#NAME?';
  const parameters: FormulaScalar[] = [];
  for (const argument of expression.arguments) {
    const value = evaluate(argument, context);
    if (Array.isArray(value)) {
      for (const item of value) parameters.push(item);
    } else {
      if (isFormulaError(value)) return value;
      parameters.push(value as FormulaScalar);
    }
  }
  return FORMULA_FUNCTIONS[expression.name as FormulaFunctionName](parameters);
}

function evaluateSource(source: string, context: EvaluationContext): RenderedValue {
  if (!source.startsWith('=')) return source;
  try {
    const value = evaluate(parseFormula(source), context);
    return Array.isArray(value) ? '#ERROR!' : value as RenderedValue;
  } catch {
    return '#ERROR!';
  }
}

export function evaluateFormula(source: string, selectCell: CellSelector): RenderedValue {
  return evaluateSource(source, { selectCell, active: new Set() });
}

export function evaluateCell(point: CellPoint, selectCell: CellSelector): RenderedValue {
  return evaluatePoint(point, { selectCell, active: new Set() });
}
