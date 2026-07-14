export type FormulaScalar = string | number | boolean;
export type FormulaFunction = (arguments_: readonly FormulaScalar[]) => FormulaScalar;

function number(value: FormulaScalar): number {
  return Number(value);
}

export const FORMULA_FUNCTIONS = Object.freeze({
  SUM: ((values: readonly FormulaScalar[]) => values.reduce<number>((sum, value) => sum + number(value), 0)),
  AVERAGE: ((values: readonly FormulaScalar[]) => values.reduce<number>((sum, value) => sum + number(value), 0) / values.length),
  MAX: ((values: readonly FormulaScalar[]) => Math.max(...values.map(number))),
  MIN: ((values: readonly FormulaScalar[]) => Math.min(...values.map(number))),
  IF: (([condition, truthy, falsy]: readonly FormulaScalar[]) => condition ? truthy : falsy),
  AND: ((values: readonly FormulaScalar[]) => values.every(Boolean)),
  OR: ((values: readonly FormulaScalar[]) => values.some(Boolean)),
  CONCAT: ((values: readonly FormulaScalar[]) => values.join('')),
} satisfies Readonly<Record<string, FormulaFunction>>);

export type FormulaFunctionName = keyof typeof FORMULA_FUNCTIONS;
