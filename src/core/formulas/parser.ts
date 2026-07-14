import { parseA1, parseA1Reference, renderA1 } from '../coordinates/a1';
import type { A1Reference } from '../coordinates/a1';
import { tokenizeFormula } from './tokenizer';
import type { FormulaToken, FormulaTokenKind } from './tokenizer';

export type BinaryOperator = '+' | '-' | '*' | '/' | '&' | '=' | '==' | '<>' | '!=' | '>' | '>=' | '<' | '<=';

export type FormulaExpression =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'reference'; readonly reference: A1Reference; readonly source: string }
  | { readonly kind: 'range'; readonly start: A1Reference; readonly end: A1Reference }
  | { readonly kind: 'unary'; readonly operator: '-'; readonly operand: FormulaExpression }
  | { readonly kind: 'binary'; readonly operator: BinaryOperator; readonly left: FormulaExpression; readonly right: FormulaExpression }
  | { readonly kind: 'call'; readonly name: string; readonly arguments: readonly FormulaExpression[] };

const PRECEDENCE: Readonly<Record<string, number>> = {
  '=': 1, '==': 1, '<>': 1, '!=': 1, '>': 1, '>=': 1, '<': 1, '<=': 1,
  '&': 2,
  '+': 3, '-': 3,
  '*': 4, '/': 4,
};

class Parser {
  private index = 0;

  constructor(private readonly tokens: readonly FormulaToken[]) {}

  parse(): FormulaExpression {
    const expression = this.binary(1);
    this.consume('eof');
    return expression;
  }

  private current(): FormulaToken {
    return this.tokens[this.index] as FormulaToken;
  }

  private consume(kind: FormulaTokenKind): FormulaToken {
    const token = this.current();
    if (token.kind !== kind) throw new SyntaxError(`Expected ${kind} at ${token.offset}`);
    this.index += 1;
    return token;
  }

  private binary(minimum: number): FormulaExpression {
    let left = this.unary();
    while (this.current().kind === 'operator') {
      const token = this.current();
      const precedence = PRECEDENCE[token.value] ?? 0;
      if (precedence < minimum) break;
      this.index += 1;
      const right = this.binary(precedence + 1);
      left = { kind: 'binary', operator: token.value as BinaryOperator, left, right };
    }
    return left;
  }

  private unary(): FormulaExpression {
    if (this.current().kind === 'operator' && this.current().value === '-') {
      this.index += 1;
      return { kind: 'unary', operator: '-', operand: this.unary() };
    }
    return this.primary();
  }

  private primary(): FormulaExpression {
    const token = this.current();
    if (token.kind === 'number') {
      this.index += 1;
      return { kind: 'number', value: Number(token.value) };
    }
    if (token.kind === 'string') {
      this.index += 1;
      return { kind: 'string', value: token.value };
    }
    if (token.kind === 'reference') {
      this.index += 1;
      const reference = parseA1Reference(token.value);
      if (this.current().kind === 'colon') {
        this.index += 1;
        const end = this.consume('reference');
        return { kind: 'range', start: reference, end: parseA1Reference(end.value) };
      }
      return { kind: 'reference', reference, source: token.value };
    }
    if (token.kind === 'function') {
      this.index += 1;
      this.consume('left-paren');
      const args: FormulaExpression[] = [];
      if (this.current().kind !== 'right-paren') {
        do {
          args.push(this.binary(1));
          if (this.current().kind !== 'comma') break;
          this.index += 1;
        } while (true);
      }
      this.consume('right-paren');
      return { kind: 'call', name: token.value, arguments: args };
    }
    if (token.kind === 'left-paren') {
      this.index += 1;
      const expression = this.binary(1);
      this.consume('right-paren');
      return expression;
    }
    throw new SyntaxError(`Expected expression at ${token.offset}`);
  }
}

export function parseFormula(source: string): FormulaExpression {
  return new Parser(tokenizeFormula(source)).parse();
}

export function infixToPostfix(source: string): readonly (string | readonly [string, number])[] {
  const output: Array<string | readonly [string, number]> = [];
  const operators: string[] = [];
  let fragments: string[] = [];
  let functionArgumentType = 0;
  let functionArgumentOperator = '';
  let functionArgumentCount = 1;
  let previous = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (character === ' ') continue;
    if (character >= 'a' && character <= 'z') {
      fragments.push(character.toUpperCase());
    } else if (
      (character >= '0' && character <= '9')
      || (character >= 'A' && character <= 'Z')
      || character === '.'
    ) {
      fragments.push(character);
    } else if (character === '"') {
      index += 1;
      while (index < source.length && source.charAt(index) !== '"') {
        fragments.push(source.charAt(index));
        index += 1;
      }
      output.push(`"${fragments.join('')}`);
      fragments = [];
    } else if (character === '-' && /[+\-*/,(]/.test(previous)) {
      fragments.push(character);
    } else {
      if (character !== '(' && fragments.length > 0) output.push(fragments.join(''));
      if (character === ')') {
        let operator = operators.pop();
        if (functionArgumentType === 2) {
          const endSource = output.pop();
          const startSource = output.pop();
          if (typeof startSource === 'string' && typeof endSource === 'string' && operator !== undefined) {
            const start = parseA1(startSource);
            const end = parseA1(endSource);
            let count = 0;
            for (let column = start.column; column <= end.column; column += 1) {
              for (let row = start.row; row <= end.row; row += 1) {
                output.push(renderA1({ row, column }));
                count += 1;
              }
            }
            output.push([operator, count]);
          }
        } else if (functionArgumentType === 1 || functionArgumentType === 3) {
          if (functionArgumentType === 3) output.push(functionArgumentOperator);
          if (operator !== undefined) output.push([operator, functionArgumentCount]);
          functionArgumentCount = 1;
        } else {
          while (operator !== undefined && operator !== '(') {
            output.push(operator);
            operator = operators.pop();
          }
        }
        functionArgumentType = 0;
      } else if (character === '=' || character === '>' || character === '<') {
        const next = source.charAt(index + 1);
        functionArgumentOperator = character;
        if (next === '=' || next === '-') {
          functionArgumentOperator += next;
          index += 1;
        }
        functionArgumentType = 3;
      } else if (character === ':') {
        functionArgumentType = 2;
      } else if (character === ',') {
        if (functionArgumentType === 3) output.push(functionArgumentOperator);
        functionArgumentType = 1;
        functionArgumentCount += 1;
      } else if (character === '(' && fragments.length > 0) {
        operators.push(fragments.join(''));
      } else {
        if (operators.length > 0 && (character === '+' || character === '-')) {
          let top = operators[operators.length - 1];
          if (top !== '(') output.push(operators.pop() as string);
          if (top === '*' || top === '/') {
            while (operators.length > 0) {
              top = operators[operators.length - 1];
              if (top !== '(') output.push(operators.pop() as string);
              else break;
            }
          }
        } else if (operators.length > 0) {
          const top = operators[operators.length - 1];
          if (top === '*' || top === '/') output.push(operators.pop() as string);
        }
        operators.push(character);
      }
      fragments = [];
    }
    previous = character;
  }
  if (fragments.length > 0) output.push(fragments.join(''));
  while (operators.length > 0) output.push(operators.pop() as string);
  return output;
}
