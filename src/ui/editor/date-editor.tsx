import { useLayoutEffect, useRef } from 'react';

export function DateEditor(props: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur: () => void;
  readonly onCancel: () => void;
  readonly onCommit: (move?: 'up' | 'down' | 'left' | 'right') => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <input
      ref={ref}
      type="date"
      aria-label="Date editor"
      value={props.value}
      onChange={event => props.onChange(event.currentTarget.value)}
      onBlur={props.onBlur}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          props.onCancel();
        } else if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          props.onCommit(event.key === 'Tab'
            ? event.shiftKey ? 'left' : 'right'
            : event.shiftKey ? 'up' : 'down');
        }
      }}
    />
  );
}
