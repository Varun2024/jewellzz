/* Num / Rupee / Weight — the three numeric primitives.
 *
 * Every number in the app renders through one of these. Screens never format
 * numbers inline. If a screen needs a new numeric format, extend a primitive.
 *
 *   <Rupee paise={sale.total} />           →  ₹ 12,34,567.89
 *   <Weight mg={item.weightMg} />          →  12.345 g
 *   <Weight mg={stone.mg} unit="ct" />     →  0.615 ct
 *   <Num value={42} />                     →  42     (tabular, mono)
 */

import type { HTMLAttributes } from 'react';

const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const intFmt = new Intl.NumberFormat('en-IN');

type Sign = 'pos' | 'neg' | 'zero';

function signOf(n: number): Sign {
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return 'zero';
}

interface NumBaseProps extends HTMLAttributes<HTMLSpanElement> {
  signed?: boolean;
}

export interface NumProps extends NumBaseProps {
  value: number;
  fractionDigits?: number;
}

export function Num({ value, fractionDigits, signed, className, ...rest }: NumProps) {
  const fmt = fractionDigits === undefined
    ? intFmt
    : new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
  const sign = signed ? signOf(value) : undefined;
  return (
    <span
      className={['num', className].filter(Boolean).join(' ')}
      data-sign={sign}
      {...rest}
    >
      {fmt.format(value)}
    </span>
  );
}

export interface RupeeProps extends NumBaseProps {
  paise: number;
  glyph?: boolean;
}

export function Rupee({ paise, signed, glyph = true, className, ...rest }: RupeeProps) {
  const sign = signed ? signOf(paise) : undefined;
  const abs = Math.abs(paise) / 100;
  const magnitude = signed ? abs : paise / 100;
  return (
    <span
      className={['num', className].filter(Boolean).join(' ')}
      data-sign={sign}
      {...rest}
    >
      {glyph && <span className="num__glyph">₹</span>}
      {signed && sign === 'neg' ? '−' : ''}
      {inr.format(signed ? magnitude : magnitude)}
    </span>
  );
}

type WeightUnit = 'g' | 'mg' | 'ct';

export interface WeightProps extends NumBaseProps {
  mg: number;
  unit?: WeightUnit;
  fractionDigits?: number;
}

// 1 carat = 200 mg (see rules.md — locked constant).
const MG_PER_CARAT = 200;

export function Weight({
  mg,
  unit = 'g',
  fractionDigits,
  className,
  ...rest
}: WeightProps) {
  const value =
    unit === 'g'  ? mg / 1000 :
    unit === 'ct' ? mg / MG_PER_CARAT :
                    mg;
  const dp = fractionDigits ?? (unit === 'mg' ? 0 : 3);
  const fmt = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
  return (
    <span
      className={['num', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {fmt.format(value)}
      <span className="num__unit">{unit}</span>
    </span>
  );
}
