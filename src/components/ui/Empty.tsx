/* Empty state — illustrated line-art + one line of copy + one action.
 * Never emoji, never a generic clipboard icon.
 *
 * Pass `mark="case" | "till" | "scale" | "shop" | "ledger" | "bell"` to pick
 * one of the context-specific illustrations in `components/illustrations.tsx`.
 * Default is the J-scale brand mark.
 */

import type { ReactNode } from 'react';
import { EMPTY_MARKS, type EmptyMarkKey } from '@/components/illustrations';

export interface EmptyProps {
  icon?: ReactNode;
  mark?: EmptyMarkKey;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

// Default mark: the J-scale hook — matches the LogoMark.
const DefaultMark = (
  <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M14 12 Q14 22 28 22 Q42 22 42 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <line x1="28" y1="22" x2="28" y2="38" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    <line x1="10" y1="40" x2="46" y2="40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M10 40 Q28 52 46 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
);

export function Empty({ icon, mark, title, children, action }: EmptyProps) {
  let graphic: ReactNode = icon ?? DefaultMark;
  if (!icon && mark) {
    const MarkComp = EMPTY_MARKS[mark];
    graphic = <MarkComp size={72} />;
  }
  return (
    <div className="empty">
      <div className="empty__mark">{graphic}</div>
      <div className="empty__title">{title}</div>
      {children && <div className="empty__body">{children}</div>}
      {action && <div>{action}</div>}
    </div>
  );
}
