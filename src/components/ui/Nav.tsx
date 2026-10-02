/* Nav — the sidebar list.
 *
 *   <Nav>
 *     <Nav.Section>Ledgers</Nav.Section>
 *     <Nav.Item active kbd="1" onClick={...}>Sale</Nav.Item>
 *     <Nav.Item kbd="2" onClick={...}>Purchase</Nav.Item>
 *   </Nav>
 *
 * The active item gets the accent column rule per design-system.md §6. Hover
 * reveals the shortcut chip.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { Kbd } from './Button';

export function Nav({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['nav', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <div className="nav__section">{children}</div>;
}

interface ItemProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  kbd?: string;
  leading?: ReactNode;
}

function Item({ active, kbd, leading, className, children, ...rest }: ItemProps) {
  return (
    <div
      className={['nav__item', className].filter(Boolean).join(' ')}
      data-active={active ? 'true' : undefined}
      role="button"
      tabIndex={0}
      {...rest}
    >
      {leading}
      <span>{children}</span>
      {kbd && <span className="nav__item__kbd"><Kbd>{kbd}</Kbd></span>}
    </div>
  );
}

Nav.Section = Section;
Nav.Item = Item;
