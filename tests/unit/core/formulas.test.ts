import { describe, expect, it } from 'vitest';
import {
  evaluateCell,
  evaluateFormula,
  FORMULA_FUNCTIONS,
  infixToPostfix,
  legacyDigits,
  legacyNumberCalc,
  parseFormula,
  renderFormulaValue,
  shiftFormulaReferences,
  tokenizeFormula,
} from '../../../src/core';
import type { CellPoint } from '../../../src/core';

describe('formula tokenization and parsing', () => {
  it('tokenizes literals, references, ranges, comparisons, and functions', () => {
    expect(tokenizeFormula('=IF(A1>=2, SUM(A1:B2), "no")').map(token => token.kind)).toEqual([
      'function', 'left-paren', 'reference', 'operator', 'number', 'comma',
      'function', 'left-paren', 'reference', 'colon', 'reference', 'right-paren',
      'comma', 'string', 'right-paren', 'eof',
    ]);
    expect(parseFormula('=1+2*3')).toMatchObject({ kind: 'binary', operator: '+' });
  });

  it.each([
    ['10-5-20', '105-20-'],
    ['1+2*3+(4*5+6)*7', '123*+45*6+7*+'],
    ['9+(3-1*2)*3+4/2', '9312*-3*+42/+'],
    ['(9+(3-1))*(2+3)+4/2', '931-+*23+42/+'],
  ])('keeps observed legacy postfix output for %s', (input, expected) => {
    expect(infixToPostfix(input).join('')).toBe(expected);
  });

  it.each([
    ['CONCAT("my name:", A1, " score:", 50)', '"my name:A1" score:50CONCAT,4'],
    ['AVERAGE(SUM(A1,B2),C1,C5)+50+B20', 'A1B2SUM,2C1C5AVERAGE,350+B20+'],
    ['IF(AND(1=1,2>1),2,1)', '11=21>AND,221IF,3'],
    ['SUM(1)', '1SUM'],
    ['SUM()', 'SUM'],
    ['SUM(', 'SUM'],
  ])('keeps legacy function postfix edge case %s', (input, expected) => {
    expect(infixToPostfix(input).join('')).toBe(expected);
  });

  it.each([
    ['AVERAGE(A1:A3)', 'A1A2A3AVERAGE,3'],
    ['SUM(A1:B2)', 'A1A2B1B2SUM,4'],
    ['CONCAT(B2:C3)', 'B2B3C2C3CONCAT,4'],
  ])('expands legacy range arguments column-first for %s', (input, expected) => {
    expect(infixToPostfix(input).join('')).toBe(expected);
  });

  it('shifts only references outside quoted strings and honors absolute axes', () => {
    expect(shiftFormulaReferences('=SUM(A1,$B2,C$3,$D$4)&"A1"', { row: 1, column: 2 }))
      .toBe('=SUM(C2,$B3,E$3,$D$4)&"A1"');
  });
});

describe('formula functions', () => {
  it('contains exactly the eight supported legacy functions', () => {
    expect(Object.keys(FORMULA_FUNCTIONS)).toEqual([
      'SUM', 'AVERAGE', 'MAX', 'MIN', 'IF', 'AND', 'OR', 'CONCAT',
    ]);
  });

  it.each([
    ['SUM', ['12', '12', 12], '36'],
    ['AVERAGE', ['12', '13', 14], 13],
    ['MAX', ['12', '13', 14], 14],
    ['MIN', ['12', '13', 14], 12],
    ['IF', [true, 12, 11], 12],
    ['AND', ['a', true, 'ok'], true],
    ['AND', ['a', false, 'ok'], false],
    ['OR', ['a', false], true],
    ['OR', [0, false], false],
    ['CONCAT', ['1200', 'USD'], '1200USD'],
  ] as const)('@parity:formulas.functions %s(%j)', (name, args, expected) => {
    expect(FORMULA_FUNCTIONS[name](args)).toEqual(expected);
  });

  it('ports legacy decimal digit counting and arithmetic return shapes exactly', () => {
    expect(legacyDigits('12.340')).toBe(3);
    expect(legacyDigits(12.34)).toBe(2);
    expect(legacyNumberCalc('+', '0.1', '0.2')).toBe('0.3');
    expect(legacyNumberCalc('-', '1.20', '0.1')).toBe('1.10');
    expect(legacyNumberCalc('*', '1.2', 3)).toBe('3.6');
    expect(legacyNumberCalc('/', 1, 3)).toBe('0.33');
    expect(legacyNumberCalc('/', 1, 2)).toBe(0.5);
    expect(legacyNumberCalc('/', 1, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(legacyNumberCalc('+', 'invalid', 1)).toBe('NaN');
    expect(legacyNumberCalc('+', Number.NaN, 1)).toBe('NaN+1');
    expect(FORMULA_FUNCTIONS.SUM(['0.1', '0.2'])).toBe('0.3');
  });
});

describe('pure formula evaluation', () => {
  const cells = new Map<string, string | number | boolean>([
    ['A1', '1'],
    ['A2', '2'],
    ['A3', '3'],
    ['B2', 4],
    ['B20', 20],
  ]);
  const select = ({ row, column }: CellPoint) => {
    const key = `${String.fromCharCode(65 + column)}${row + 1}`;
    return cells.get(key) ?? '';
  };

  it.each([
    ['=SUM(A1,B2,A3)+50+B20', '78'],
    ['=50+B20', '70'],
    ['=IF(2>1,2,1)', 2],
    ['=AVERAGE(A1:A3)+50*10-B20', '482'],
    ['=1=1', true],
    ['=2<>1', true],
    ['=2<=2', true],
    ['=0.1+0.2', '0.3'],
    ['=1/3', '0.33'],
    ['=1/0', Number.POSITIVE_INFINITY],
  ])('@parity:formulas.evaluation evaluates %s', (formula, expected) => {
    expect(evaluateFormula(formula, select)).toEqual(expected);
  });

  it('leaves stored values inert and never mutates selector-owned data', () => {
    const stored = Object.freeze({ text: '=A2+1', value: 99 });
    const selector = (point: CellPoint) => point.row === 0 ? stored.text : '2';

    expect(evaluateCell({ row: 0, column: 0 }, selector)).toBe('3');
    expect(stored).toEqual({ text: '=A2+1', value: 99 });
  });

  it('returns a deterministic rendered error for direct and indirect cycles', () => {
    const direct = (point: CellPoint) => point.row === 0 ? '=A1' : '';
    const indirect = (point: CellPoint) => point.row === 0 ? '=A2' : '=A1';

    expect(evaluateCell({ row: 0, column: 0 }, direct)).toBe('#CYCLE!');
    expect(evaluateCell({ row: 0, column: 0 }, indirect)).toBe('#CYCLE!');
  });

  it('renders supported parse, unknown-function, cycle, and scalar values explicitly', () => {
    expect(evaluateFormula('=NOPE(1)', select)).toBe('#NAME?');
    expect(evaluateFormula('=1+', select)).toBe('#ERROR!');
    expect(renderFormulaValue(null)).toBe('');
    expect(renderFormulaValue(false)).toBe('false');
    expect(renderFormulaValue('#CYCLE!')).toBe('#CYCLE!');
    expect(renderFormulaValue(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});
