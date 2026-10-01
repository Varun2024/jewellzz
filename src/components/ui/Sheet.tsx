/* Sheet — the wrapper every screen sits inside.
 * Row — the atom of every list, table, and nav.
 *
 *   <Sheet title="Sales" action={<Button variant="primary">New · N</Button>}>
 *     <table className="table">...</table>
 *   </Sheet>
 *
 * A Row can wrap any content but always brings the left column-rule with it.
 */

import type { HTMLAttributes, ReactNode } from 'react';

export interface SheetProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  flush?: boolean;
}

export function Sheet({
  title,
  action,
  footer,
  flush,
  className,
  children,
  ...rest
}: SheetProps) {
  return (
    <div className={['sheet', className].filter(Boolean).join(' ')} {...rest}>
      {(title || action) && (
        <div className="sheet__header">
          {title && <div className="sheet__title">{title}</div>}
          {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
        </div>
      )}
      <div className={flush ? 'sheet__body sheet__body--flush' : 'sheet__body'}>
        {children}
      </div>
      {footer && <div className="sheet__footer">{footer}</div>}
    </div>
  );
}

export interface RowProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  emphasize?: boolean;
}

export function Row({
  active,
  emphasize,
  className,
  children,
  ...rest
}: RowProps) {
  const cls = [
    'row',
    emphasize ? 'row--emphasize' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} data-active={active ? 'true' : undefined} {...rest}>
      {children}
    </div>
  );
}
