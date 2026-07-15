import type { LocaleDefinition, LocaleMessages } from '../core';
import { resolveLocale } from '../locales';

export type Translate = (path: string, fallback: string) => string;

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

export function createTranslator(locale: LocaleDefinition | undefined): Translate {
  const resolved = resolveLocale(locale);
  return (path, fallback) => message(resolved.messages, path) ?? fallback;
}
