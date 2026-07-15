import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ToolbarIconName =
  | 'bold'
  | 'clear'
  | 'filter'
  | 'freeze'
  | 'italic'
  | 'merge'
  | 'paint'
  | 'print'
  | 'redo'
  | 'sort'
  | 'strike'
  | 'undo'
  | 'underline'
  | 'validation'
  | 'wrap';

export interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly icon?: ToolbarIconName;
}

const TOOLBAR_ICON_PATHS: Readonly<Record<ToolbarIconName, string>> = {
  bold: 'M6 4h5a4 4 0 0 1 0 8H6V4Zm0 8h6a4 4 0 0 1 0 8H6v-8Z',
  clear: 'm5 16 8-8 6 6-6 6H9l-4-4Zm9-9 2-2 3 3-2 2-3-3Z',
  filter: 'M4 5h16l-6 7v6l-4 2v-8L4 5Z',
  freeze: 'M5 4h14v16H5V4Zm5 0v16M5 10h14',
  italic: 'M10 4h8M6 20h8M15 4 9 20',
  merge: 'M4 7h6V4l4 4-4 4V9H4V7Zm16 10h-6v3l-4-4 4-4v3h6v2Z',
  paint: 'm5 15 9-9 4 4-9 9H5v-4Zm10-10 2-2 4 4-2 2-4-4Z',
  print: 'M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z',
  redo: 'M8 8h7V5l5 5-5 5v-3H8a4 4 0 0 0-4 4',
  sort: 'm8 5-4 4h8L8 5Zm8 14 4-4h-8l4 4Z',
  strike: 'M5 12h14M7 8c0-3 10-3 10 0M8 16c1 3 8 3 9 0',
  undo: 'm9 5-5 5 5 5v-3h7a4 4 0 0 1 4 4',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  validation: 'M5 4h14v16H5V4Zm3 8 3 3 6-7',
  wrap: 'M4 6h16M4 11h12a3 3 0 0 1 0 6h-4m2-2-2 2 2 2M4 17h5',
};

function ToolbarIcon({ name }: { readonly name: ToolbarIconName }) {
  return (
    <svg
      aria-hidden="true"
      data-tego-icon={name}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={TOOLBAR_ICON_PATHS[name]} />
    </svg>
  );
}

export function ToolbarButton({ active, children, icon, type = 'button', ...props }: ToolbarButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={props['aria-pressed'] ?? active}
      data-active={active === undefined ? undefined : active ? 'true' : 'false'}
    >
      {icon === undefined ? null : <ToolbarIcon name={icon} />}
      <span className="tego-sheet__toolbar-label">{children}</span>
    </button>
  );
}
