import type { CellPoint } from '../types/coordinates';

export interface A1Reference extends CellPoint {
  readonly rowAbsolute: boolean;
  readonly columnAbsolute: boolean;
}

export interface CoordinateDelta {
  readonly row: number;
  readonly column: number;
}

const A1_REFERENCE = /^(\$?)([A-Z]+)(\$?)([1-9]\d*)$/;

function assertSafeCoordinate(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

function columnIndex(label: string): number {
  let index = 0;
  for (const character of label) {
    index = index * 26 + character.charCodeAt(0) - 64;
    if (!Number.isSafeInteger(index)) throw new RangeError('A1 column is too large');
  }
  return index - 1;
}

function columnLabel(column: number): string {
  assertSafeCoordinate(column, 'column');
  let value = column + 1;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

export function parseA1Reference(input: string): A1Reference {
  const match = A1_REFERENCE.exec(input);
  if (match === null) throw new TypeError(`Invalid A1 reference: ${input}`);
  const [, columnMarker, columnText, rowMarker, rowText] = match;
  const row = Number(rowText) - 1;
  const column = columnIndex(columnText as string);
  assertSafeCoordinate(row, 'row');
  return {
    row,
    column,
    rowAbsolute: rowMarker === '$',
    columnAbsolute: columnMarker === '$',
  };
}

export function parseA1(input: string): CellPoint {
  if (input.includes('$')) throw new TypeError(`Invalid plain A1 coordinate: ${input}`);
  const { row, column } = parseA1Reference(input);
  return { row, column };
}

export function renderA1(point: CellPoint): string {
  assertSafeCoordinate(point.row, 'row');
  assertSafeCoordinate(point.column, 'column');
  return `${columnLabel(point.column)}${point.row + 1}`;
}

export function renderA1Reference(reference: A1Reference): string {
  assertSafeCoordinate(reference.row, 'row');
  assertSafeCoordinate(reference.column, 'column');
  return `${reference.columnAbsolute ? '$' : ''}${columnLabel(reference.column)}${reference.rowAbsolute ? '$' : ''}${reference.row + 1}`;
}

export function shiftA1(input: string, delta: CoordinateDelta): string {
  assertSafeCoordinate(Math.abs(delta.row), 'row delta magnitude');
  assertSafeCoordinate(Math.abs(delta.column), 'column delta magnitude');
  const reference = parseA1Reference(input);
  const shifted: A1Reference = {
    ...reference,
    row: reference.rowAbsolute ? reference.row : reference.row + delta.row,
    column: reference.columnAbsolute ? reference.column : reference.column + delta.column,
  };
  assertSafeCoordinate(shifted.row, 'shifted row');
  assertSafeCoordinate(shifted.column, 'shifted column');
  return renderA1Reference(shifted);
}

export function shiftFormulaReferences(formula: string, delta: CoordinateDelta): string {
  let output = '';
  let index = 0;
  let quoted = false;

  while (index < formula.length) {
    const character = formula[index] as string;
    if (character === '"') {
      quoted = !quoted;
      output += character;
      index += 1;
      continue;
    }
    if (!quoted) {
      const match = /^(\$?[A-Z]+\$?[1-9]\d*)/.exec(formula.slice(index));
      if (match !== null) {
        const before = formula[index - 1];
        const after = formula[index + match[1].length];
        const boundaryBefore = before === undefined || !/[A-Z0-9_$]/i.test(before);
        const boundaryAfter = after === undefined || !/[A-Z0-9_$]/i.test(after);
        if (boundaryBefore && boundaryAfter) {
          output += shiftA1(match[1], delta);
          index += match[1].length;
          continue;
        }
      }
    }
    output += character;
    index += 1;
  }
  return output;
}
