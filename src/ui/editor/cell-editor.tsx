import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { OverlayAnchor } from '../../engine';
import { DateEditor } from './date-editor';
import { FormulaSuggestions } from './formula-suggestions';

export interface CellEditorProps {
  readonly anchor: OverlayAnchor;
  readonly date: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onCommit: (move?: 'up' | 'down' | 'left' | 'right') => void;
}

export function CellEditor(props: CellEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!props.date) {
      ref.current?.focus();
      ref.current?.setSelectionRange(ref.current.value.length, ref.current.value.length);
    }
  }, [props.date]);
  const style: CSSProperties = {
    position: 'absolute',
    left: props.anchor.left,
    top: props.anchor.top,
    minWidth: props.anchor.width,
    minHeight: props.anchor.height,
  };
  const commitBlur = () => props.onCommit();
  return (
    <div className="tego-sheet__editor" style={style} data-clipped={props.anchor.clipped ? 'true' : 'false'}>
      {props.date ? (
        <DateEditor
          value={props.value}
          onChange={props.onChange}
          onBlur={commitBlur}
          onCancel={props.onCancel}
          onCommit={props.onCommit}
        />
      ) : (
        <textarea
          ref={ref}
          aria-label="Cell editor"
          value={props.value}
          onChange={event => props.onChange(event.currentTarget.value)}
          onBlur={commitBlur}
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
      )}
      <FormulaSuggestions value={props.value} onSelect={props.onChange} />
    </div>
  );
}
