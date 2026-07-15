import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ToolbarButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly active?: boolean;
  readonly children: ReactNode;
}

export function ToolbarButton({ active, type = 'button', ...props }: ToolbarButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={props['aria-pressed'] ?? active}
      data-active={active === undefined ? undefined : active ? 'true' : 'false'}
    />
  );
}
