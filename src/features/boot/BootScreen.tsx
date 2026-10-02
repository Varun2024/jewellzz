/* BootScreen — the first few seconds between opening the app and either the
 * login card appearing or the Shell mounting. Parchment surface, centred
 * brand lockup, mono phrase, gold progress hairline — same visual family as
 * LoginScreen so the transition is a crossfade, not a mood switch.
 */

import { LogoMark, Wordmark } from '@/components/Logo';
import { Progress } from '@/components/ui';
import { loading as pickPhrase } from '@/lib/phrases';
import { useMemo } from 'react';

export function BootScreen() {
  const phrase = useMemo(() => pickPhrase('bootup'), []);
  return (
    <div
      className="ds-v2"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg)',
        backgroundImage:
          'radial-gradient(ellipse at 50% 40%, var(--paper-50) 0%, var(--bg) 70%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--s4)',
          width: 320,
          animation: 'ds-screen-enter 320ms var(--ease-out, cubic-bezier(0.20, 0, 0, 1))',
        }}
      >
        {/* brand lockup — mark + wordmark + the identity's single gold rule */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s2)' }}>
          <LogoMark size={56} boot />
          <Wordmark size={28} />
          <div
            aria-hidden
            style={{
              width: 40,
              height: 1,
              background: 'var(--accent)',
              marginTop: 'var(--s2)',
              opacity: 0.9,
            }}
          />
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--t-sm)',
            color: 'var(--text-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          {phrase}
        </div>

        <div style={{ width: '100%' }}>
          <Progress />
        </div>
      </div>
    </div>
  );
}
