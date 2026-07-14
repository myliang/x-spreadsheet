export type FormulaErrorValue = '#CYCLE!' | '#ERROR!' | '#NAME?';
export type RenderedValue = string | number | boolean;

export type FormatType = 'string' | 'number' | 'date';

export interface FormatDefinition {
  readonly key: string;
  readonly type: FormatType;
  readonly label?: string;
}

function formatNumber(value: string): string {
  if (!/^-?\d*(?:\.\d*)?$/.test(value)) return value;
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return `${(integer as string).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}.${decimal}`;
}

export const FORMAT_DEFINITIONS: readonly FormatDefinition[] = Object.freeze([
  { key: 'normal', type: 'string' },
  { key: 'text', type: 'string' },
  { key: 'number', type: 'number', label: '1,000.12' },
  { key: 'percent', type: 'number', label: '10.12%' },
  { key: 'rmb', type: 'number', label: '￥10.00' },
  { key: 'usd', type: 'number', label: '$10.00' },
  { key: 'eur', type: 'number', label: '€10.00' },
  { key: 'date', type: 'date', label: '26/09/2008' },
  { key: 'time', type: 'date', label: '15:59:00' },
  { key: 'datetime', type: 'date', label: '26/09/2008 15:59:00' },
  { key: 'duration', type: 'date', label: '24:01:00' },
]);

export function isFormulaError(value: unknown): value is FormulaErrorValue {
  return value === '#CYCLE!'
    || value === '#ERROR!'
    || value === '#NAME?';
}

export function renderFormulaValue(value: RenderedValue | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function formatValue(format: string | undefined, value: RenderedValue): string {
  const source = String(value);
  if (format === 'number') return formatNumber(source);
  if (format === 'percent') return `${source}%`;
  if (format === 'rmb') return `￥${formatNumber(source)}`;
  if (format === 'usd') return `$${formatNumber(source)}`;
  if (format === 'eur') return `€${formatNumber(source)}`;
  return source;
}
