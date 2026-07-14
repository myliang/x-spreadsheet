import { parseA1Reference } from '../coordinates/a1';
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

function postfix(expression: FormulaExpression, output: Array<string | readonly [string, number]>): void {
  if (expression.kind === 'number') output.push(String(expression.value));
  else if (expression.kind === 'string') output.push(`"${expression.value}`);
  else if (expression.kind === 'reference') output.push(expression.source);
  else if (expression.kind === 'range') {
    output.push(`${expression.start.column}:${expression.start.row}`);
    output.push(`${expression.end.column}:${expression.end.row}`);
  } else if (expression.kind === 'unary') {
    postfix(expression.operand, output);
    output.push('-');
  } else if (expression.kind === 'binary') {
    postfix(expression.left, output);
    postfix(expression.right, output);
    output.push(expression.operator);
  } else {
    expression.arguments.forEach(argument => postfix(argument, output));
    output.push(expression.arguments.length <= 1
      ? expression.name
      : [expression.name, expression.arguments.length]);
  }
}

export function infixToPostfix(source: string): readonly (string | readonly [string, number])[] {
  const incompleteFunction = /^\s*([A-Z_][A-Z0-9_]*)\(\s*$/i.exec(source);
  if (incompleteFunction !== null) return [incompleteFunction[1].toUpperCase()];
  const output: Array<string | readonly [string, number]> = [];
  postfix(parseFormula(source), output);
  return output;
}
