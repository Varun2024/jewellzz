/* useAnimatedNumber — rolls a number from its previous value to the current
 * target over a short duration. Used on big figures (sale TOTAL, home KPIs)
 * so changes feel physical rather than instant.
 *
 *   const liveTotal = useAnimatedNumber(totals.total, 400);
 *   <Rupee paise={liveTotal} />
 *
 * The animation uses requestAnimationFrame and an ease-out cubic. If the
 * target doesn't change, no RAFs are scheduled.
 */

import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(target: number, duration = 400): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);

    // Honour prefers-reduced-motion by snapping instantly.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const v = Math.round(from + (target - from) * eased);
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
        rafRef.current = undefined;
      }
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };
  }, [target, duration]);

  return value;
}
