import { expect, it } from 'vitest';
import type { LocaleDefinition, LocaleMessages } from '../../../src';
import {
  de,
  en,
  nl,
  resolveLocale,
  zhCN,
} from '../../../src/locales';

function message(messages: LocaleMessages, path: string): string | undefined {
  let current: string | LocaleMessages = messages;
  for (const segment of path.split('.')) {
    if (typeof current === 'string') return undefined;
    const next: string | LocaleMessages | undefined = current[segment];
    if (next === undefined) return undefined;
    current = next;
  }
  return typeof current === 'string' ? current : undefined;
}

it('@parity:locale.message-resolution exports stable React-safe definitions', () => {
  expect(en.id).toBe('en');
  expect(de.id).toBe('de');
  expect(nl.id).toBe('nl');
  expect(zhCN.id).toBe('zh-CN');
  expect(message(zhCN.messages, 'toolbar.undo')).toBe('撤销');
});

it('overlays partial messages recursively on bundled English', () => {
  const partial: LocaleDefinition = {
    id: 'de-DE',
    messages: {
      toolbar: {
        undo: 'Zurück',
      },
      validation: {
        required: 'Erforderlich',
      },
    },
  };
  const resolved = resolveLocale(partial);

  expect(resolved.id).toBe('de-DE');
  expect(message(resolved.messages, 'toolbar.undo')).toBe('Zurück');
  expect(message(resolved.messages, 'toolbar.redo')).toBe('Redo');
  expect(message(resolved.messages, 'validation.required')).toBe('Erforderlich');
  expect(message(resolved.messages, 'validation.remove')).toBe('Remove validation');
});

it('returns independent locale trees without mutating inputs', () => {
  const firstInput: LocaleDefinition = {
    id: 'fr',
    messages: { toolbar: { undo: 'Annuler' } },
  };
  const before = structuredClone(firstInput);
  const first = resolveLocale(firstInput);
  const second = resolveLocale({ id: 'es', messages: { toolbar: { redo: 'Rehacer' } } });
  const english = resolveLocale();

  expect(firstInput).toEqual(before);
  expect(first.messages).not.toBe(second.messages);
  expect(message(first.messages, 'toolbar.undo')).toBe('Annuler');
  expect(message(first.messages, 'toolbar.redo')).toBe('Redo');
  expect(message(second.messages, 'toolbar.undo')).toBe('Undo');
  expect(message(second.messages, 'toolbar.redo')).toBe('Rehacer');
  expect(message(english.messages, 'toolbar.undo')).toBe('Undo');
});
