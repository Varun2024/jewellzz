/* Field — label + input + hint/error.
 *
 * Numeric fields set `numeric` to swap to mono + right-align + tnum.
 * The Field owns the label→input association; no `<label htmlFor>` boilerplate
 * at call sites.
 */

import { useId } from 'react';
import type { InputHTMLAttributes, Ref, ReactNode } from 'react';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  numeric?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

export function Field({
  label,
  hint,
  error,
  numeric,
  className,
  id,
  inputRef,
  ...rest
}: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const inputCls = [
    'field__input',
    numeric ? 'field__input--num' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>{label}</label>
      <input id={inputId} ref={inputRef} className={inputCls} {...rest} />
      {error
        ? <div className="field__error">{error}</div>
        : hint
          ? <div className="field__hint">{hint}</div>
          : null}
    </div>
  );
}
