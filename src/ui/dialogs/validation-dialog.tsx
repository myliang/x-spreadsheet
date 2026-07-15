import { useState } from 'react';
import type { ValidationOperator, ValidationRule, ValidationType } from '../../core';
import type { Translate } from '../translate';

const validationTypes = [
  ['list', 'List'],
  ['number', 'Number'],
  ['date', 'Date'],
  ['phone', 'Phone'],
  ['email', 'Email'],
] as const;

const validationOperators = [
  ['be', 'between'],
  ['nbe', 'not between'],
  ['eq', 'equal to'],
  ['neq', 'not equal to'],
  ['lt', 'less than'],
  ['lte', 'less than or equal to'],
  ['gt', 'greater than'],
  ['gte', 'greater than or equal to'],
] as const;

export function ValidationDialog(props: {
  readonly onClose: () => void;
  readonly onRemove: () => void;
  readonly onSave: (rule: ValidationRule) => void;
  readonly t: Translate;
}) {
  const [type, setType] = useState<ValidationType>('list');
  const [operator, setOperator] = useState<ValidationOperator | ''>('');
  const [required, setRequired] = useState(false);
  const [value, setValue] = useState('');
  const trimmedValue = value.trim();
  const rangeValues = value.split(',').map(item => item.trim());
  const validationMessage = type === 'list' && operator !== ''
    ? props.t('validation.listOperatorInvalid', 'List validation does not use an operator.')
    : type === 'list' && trimmedValue === ''
      ? props.t('validation.listValueRequired', 'Enter at least one list value.')
      : (operator === 'be' || operator === 'nbe')
          && (rangeValues.length !== 2 || rangeValues.some(item => item === ''))
        ? props.t('validation.rangeValuesRequired', 'Enter exactly two nonblank comma-separated values.')
        : operator !== '' && trimmedValue === ''
          ? props.t('validation.comparisonValueRequired', 'Enter a comparison value.')
          : '';
  const valid = validationMessage === '';
  const save = () => {
    if (!valid) return;
    const rule: ValidationRule = {
      mode: 'cell',
      type,
      required,
      ...(operator === '' ? {} : { operator }),
      ...(operator === 'be' || operator === 'nbe'
        ? { value: rangeValues as [string, string] }
        : trimmedValue === '' ? {} : { value: trimmedValue }),
    };
    props.onSave(rule);
  };
  return (
    <div role="dialog" aria-modal="true" aria-label={props.t('validation.title', 'Data validation')} className="tego-sheet__dialog">
      <label>{props.t('validation.type', 'Type')}
        <select name="type" value={type} onChange={event => setType(event.target.value as ValidationType)}>
          {validationTypes.map(([item, label]) => (
            <option key={item} value={item}>{props.t(`validation.types.${item}`, label)}</option>
          ))}
        </select>
      </label>
      <label>{props.t('validation.operator', 'Operator')}
        <select value={operator} onChange={event => setOperator(event.target.value as ValidationOperator | '')}>
          <option value="">{props.t('validation.none', 'None')}</option>
          {validationOperators.map(([item, label]) => (
            <option key={item} value={item}>{props.t(`validation.operators.${item}`, label)}</option>
          ))}
        </select>
      </label>
      <label>{props.t('validation.value', 'Value')}
        <input aria-describedby="tego-sheet-validation-status" value={value} onChange={event => setValue(event.currentTarget.value)} />
      </label>
      <p id="tego-sheet-validation-status" role="status" aria-live="polite">{validationMessage}</p>
      <label>
        <input type="checkbox" checked={required} onChange={event => setRequired(event.currentTarget.checked)} />
        {props.t('validation.required', 'Required')}
      </label>
      <button type="button" disabled={!valid} onClick={save}>{props.t('common.save', 'Save')}</button>
      <button type="button" onClick={props.onRemove}>{props.t('validation.remove', 'Remove validation')}</button>
      <button type="button" onClick={props.onClose}>{props.t('common.cancel', 'Cancel')}</button>
    </div>
  );
}
