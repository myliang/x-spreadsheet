import type { TegoSheetError } from '../../core';

export function NotificationHost(props: {
  readonly error: TegoSheetError | null;
  readonly onDismiss: () => void;
}) {
  if (props.error === null) return null;
  return (
    <div role="status" className="tego-sheet__notification" data-error-code={props.error.code}>
      <span>{props.error.message}</span>
      <button type="button" aria-label="Dismiss notification" onClick={props.onDismiss}>×</button>
    </div>
  );
}
