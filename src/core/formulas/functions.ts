export type FormulaScalar = string | number | boolean;
export type FormulaFunction = (arguments_: readonly FormulaScalar[]) => FormulaScalar;
export type LegacyArithmeticOperator = '+' | '-' | '*' | '/';

function number(value: FormulaScalar): number {
  return Number(value);
}

export function legacyDigits(value: FormulaScalar): number {
  const source = `${value}`;
  let count = 0;
  let afterDecimal = false;
  for (const character of source) {
    if (afterDecimal) count += 1;
    if (character === '.') afterDecimal = true;
  }
  return count;
}

export function legacyNumberCalc(
  operator: LegacyArithmeticOperator,
  left: FormulaScalar,
  right: FormulaScalar,
): string | number {
  if (Number.isNaN(left) || Number.isNaN(right)) return `${left}${operator}${right}`;
  const leftDigits = legacyDigits(left);
  const rightDigits = legacyDigits(right);
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  let result = 0;
  if (operator === '-') result = leftNumber - rightNumber;
  else if (operator === '+') result = leftNumber + rightNumber;
  else if (operator === '*') result = leftNumber * rightNumber;
  else {
    result = leftNumber / rightNumber;
    return legacyDigits(result) > 5 ? result.toFixed(2) : result;
  }
  return result.toFixed(Math.max(leftDigits, rightDigits));
}

export const FORMULA_FUNCTIONS = Object.freeze({
  SUM: ((values: readonly FormulaScalar[]) => values.reduce<FormulaScalar>(
    (sum, value) => legacyNumberCalc('+', sum, value),
    0,
  )),
  AVERAGE: ((values: readonly FormulaScalar[]) => values.reduce<number>((sum, value) => sum + number(value), 0) / values.length),
  MAX: ((values: readonly FormulaScalar[]) => Math.max(...values.map(number))),
  MIN: ((values: readonly FormulaScalar[]) => Math.min(...values.map(number))),
  IF: (([condition, truthy, falsy]: readonly FormulaScalar[]) => condition ? truthy : falsy),
  AND: ((values: readonly FormulaScalar[]) => values.every(Boolean)),
  OR: ((values: readonly FormulaScalar[]) => values.some(Boolean)),
  CONCAT: ((values: readonly FormulaScalar[]) => values.join('')),
} satisfies Readonly<Record<string, FormulaFunction>>);

export type FormulaFunctionName = keyof typeof FORMULA_FUNCTIONS;
