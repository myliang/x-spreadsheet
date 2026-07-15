import type { LocaleDefinition, LocaleMessages } from '../core';
import { en } from './en';

export { de } from './de';
export { en } from './en';
export { nl } from './nl';
export { zhCN } from './zh-cn';

function cloneMessages(messages: LocaleMessages): LocaleMessages {
  return Object.fromEntries(Object.entries(messages).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : cloneMessages(value),
  ]));
}

function mergeMessages(base: LocaleMessages, overlay: LocaleMessages): LocaleMessages {
  const merged: Record<string, string | LocaleMessages> = { ...cloneMessages(base) };
  for (const [key, value] of Object.entries(overlay)) {
    const baseValue = base[key];
    merged[key] = typeof value === 'string'
      ? value
      : typeof baseValue === 'string' || baseValue === undefined
        ? cloneMessages(value)
        : mergeMessages(baseValue, value);
  }
  return merged;
}

export function resolveLocale(locale: LocaleDefinition | undefined = undefined): LocaleDefinition {
  return {
    id: locale?.id ?? en.id,
    messages: mergeMessages(en.messages, locale?.messages ?? {}),
  };
}
