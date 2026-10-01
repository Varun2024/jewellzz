/* Tabs — bottom column rule + sliding accent indicator.
 *
 *   <Tabs value={tab} onChange={setTab} tabs={[
 *     { value: 'items',    label: 'Items',    count: 6 },
 *     { value: 'payments', label: 'Payments', count: 2 },
 *   ]} />
 *
 * The indicator is a single absolute-positioned bar that transitions its left
 * and width, so switching tabs feels physically continuous — the accent
 * "slides" instead of blinking.
 */

import { useLayoutEffect, useRef, useState } from 'react';

export interface TabDef<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: readonly TabDef<T>[];
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: TabsProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const active = container.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!active) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    setIndicator({ left: aRect.left - cRect.left, width: aRect.width });
  }, [value, tabs]);

  return (
    <div ref={ref} className={['tabs', className].filter(Boolean).join(' ')}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          className="tab"
          data-active={t.value === value ? 'true' : undefined}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab__count">{t.count}</span>}
        </button>
      ))}
      <span
        className="tabs__indicator"
        style={{ left: indicator.left, width: indicator.width }}
        aria-hidden
      />
    </div>
  );
}
