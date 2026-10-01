/* Button — three variants. Kbd — inline shortcut chip.
 *
 * If a button needs a fourth variant, the design system is being violated. Talk
 * to design-system.md §7.2 first.
 */

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  kbd?: string;
  leading?: ReactNode;
}

export function Button({
  variant = 'secondary',
  kbd,
  leading,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    variant === 'primary' ? 'btn--primary' : '',
    variant === 'link'    ? 'btn--link'    : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {leading}
      <span>{children}</span>
      {kbd && <Kbd>{kbd}</Kbd>}
    </button>
  );
}

export function Kbd({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={['kbd', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}
