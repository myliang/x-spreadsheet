export type FormulaTokenKind =
  | 'number'
  | 'string'
  | 'reference'
  | 'identifier'
  | 'function'
  | 'operator'
  | 'left-paren'
  | 'right-paren'
  | 'comma'
  | 'colon'
  | 'eof';

export interface FormulaToken {
  readonly kind: FormulaTokenKind;
  readonly value: string;
  readonly offset: number;
}

const REFERENCE = /^\$?[A-Z]+\$?[1-9]\d*/i;
const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)/;
const IDENTIFIER = /^[A-Z_][A-Z0-9_]*/i;

export function tokenizeFormula(source: string): readonly FormulaToken[] {
  const input = source.startsWith('=') ? source.slice(1) : source;
  const tokens: FormulaToken[] = [];
  let index = 0;
  const push = (kind: FormulaTokenKind, value: string, offset = index): void => {
    tokens.push({ kind, value, offset });
  };

  while (index < input.length) {
    const character = input[index] as string;
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '"') {
      const offset = index;
      index += 1;
      let value = '';
      while (index < input.length && input[index] !== '"') {
        value += input[index];
        index += 1;
      }
      if (input[index] !== '"') throw new SyntaxError(`Unterminated string at ${offset}`);
      index += 1;
      push('string', value, offset);
      continue;
    }
    const number = NUMBER.exec(input.slice(index));
    if (number !== null) {
      push('number', number[0]);
      index += number[0].length;
      continue;
    }
    const reference = REFERENCE.exec(input.slice(index));
    if (reference !== null) {
      const following = input[index + reference[0].length];
      if (following === undefined || !/[A-Z0-9_]/i.test(following)) {
        push('reference', reference[0].toUpperCase());
        index += reference[0].length;
        continue;
      }
    }
    const identifier = IDENTIFIER.exec(input.slice(index));
    if (identifier !== null) {
      const value = identifier[0].toUpperCase();
      const rest = input.slice(index + identifier[0].length);
      push(/^\s*\(/.test(rest) ? 'function' : 'identifier', value);
      index += identifier[0].length;
      continue;
    }
    const twoCharacter = input.slice(index, index + 2);
    if (['>=', '<=', '<>', '!=', '=='].includes(twoCharacter)) {
      push('operator', twoCharacter);
      index += 2;
      continue;
    }
    const punctuation: Partial<Record<string, FormulaTokenKind>> = {
      '(': 'left-paren',
      ')': 'right-paren',
      ',': 'comma',
      ':': 'colon',
    };
    const kind = punctuation[character];
    if (kind !== undefined) {
      push(kind, character);
      index += 1;
      continue;
    }
    if ('+-*/=><&'.includes(character)) {
      push('operator', character);
      index += 1;
      continue;
    }
    throw new SyntaxError(`Unexpected character ${character} at ${index}`);
  }
  push('eof', '', input.length);
  return tokens;
}
