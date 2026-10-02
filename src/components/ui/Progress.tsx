/* Progress — a 1px indeterminate hairline. Sits directly under a sheet
 * header while a list is loading. Replaces every spinner in tables.
 */

import type { HTMLAttributes } from 'react';

export function Progress({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['progress', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-busy="true"
      {...rest}
    />
  );
}

export function Pill({
  tone = 'default',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'accent' | 'pos' | 'neg' }) {
  const cls = [
    'pill',
    tone === 'accent' ? 'pill--accent' : '',
    tone === 'pos'    ? 'pill--pos'    : '',
    tone === 'neg'    ? 'pill--neg'    : '',
    className,
  ].filter(Boolean).join(' ');
  return <span className={cls} {...rest} />;
}
