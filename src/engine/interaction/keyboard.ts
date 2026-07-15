export type NavigationKey = 'up' | 'down' | 'left' | 'right';

interface KeyboardEventLike {
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
  readonly key?: string;
  readonly metaKey?: boolean;
  readonly target?: unknown;
  readonly targetKind?: string;
}

interface EditableTargetLike {
  readonly tagName?: string;
  readonly nodeName?: string;
  readonly isContentEditable?: boolean;
  getAttribute?(name: string): string | null;
}

export function isEditableEventTarget(event: KeyboardEventLike): boolean {
  if (event.isComposing === true || event.keyCode === 229) return true;
  const target = event.target as EditableTargetLike | undefined;
  const kind = String(event.targetKind ?? target?.tagName ?? target?.nodeName ?? '').toLowerCase();
  return kind === 'input' || kind === 'textarea' || kind === 'select'
    || target?.isContentEditable === true
    || target?.getAttribute?.('contenteditable') === 'true';
}

export function navigationKey(key: string): NavigationKey | null {
  switch (key) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    default: return null;
  }
}

export function isPrintableKey(event: KeyboardEventLike): boolean {
  return typeof event.key === 'string'
    && event.key.length === 1
    && !event.ctrlKey
    && !event.metaKey
    && !event.altKey;
}
