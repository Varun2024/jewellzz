/* Shared feedback primitives. Pulls the duplicated `InlineAlert` and
 * `LoadingState` snippets out of individual screens into one place.
 */

import { Progress } from './Progress';

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'opening the ledger…' }: LoadingStateProps) {
  return (
    <div>
      <Progress />
      <div style={{
        marginTop: 8,
        fontSize: 'var(--t-sm)',
        color: 'var(--text-mute)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>{label}</div>
    </div>
  );
}

export interface InlineAlertProps {
  message: string;
  onDismiss?: () => void;
}

export function InlineAlert({ message, onDismiss }: InlineAlertProps) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && (
        <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>
      )}
    </div>
  );
}
