import type { ReactNode } from 'react';
import { Info } from '@phosphor-icons/react';

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--ink-500)]">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </span>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="errbox">
      <span className="whitespace-pre-wrap break-words">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="dismiss" style={{ fontSize: 14, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

export function LoadingBlock({ label = 'loading' }: { label?: string }) {
  return (
    <div className="py-2">
      <div className="loadbar" />
      <div className="mt-2 text-[11px] text-[var(--ink-500)] mono tracking-wider uppercase">{label}</div>
    </div>
  );
}

// Illustrated empty state: optional icon + primary line + hint line.
export function EmptyState({ icon, children, hint }: { icon?: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 text-center">
      <div className="text-[var(--ink-300)]" style={{ marginBottom: 4 }}>
        {icon ?? <Info size={28} weight="thin" />}
      </div>
      <div className="text-xs mono text-[var(--ink-500)] tracking-widest uppercase">{children}</div>
      {hint && <div className="text-[11px] text-[var(--ink-500)] max-w-xs">{hint}</div>}
    </div>
  );
}
