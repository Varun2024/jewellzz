/* Login — reworked. The forest-green cover is gone. Sign-in now lives on the
 * same parchment surface as the rest of the app, so opening the counter feels
 * like opening a drawer, not switching into a dark mood. Brand lockup is
 * amplified; the sign-in flow sits below it as a single tall column.
 */

import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { LogoMark, Wordmark } from '@/components/Logo';
import { UserCircle } from '@phosphor-icons/react';
import { Button, Pill, Progress } from '@/components/ui';

type UserRow = { id: number; name: string; role: 'owner' | 'counter' };
type CurrentUser = { id: number; name: string; role: 'owner' | 'counter' };

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (u: CurrentUser) => void }) {
  const users = useAsync<UserRow[]>(() => invoke(CH.authListUsers));
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const login = useMutation<{ userId: number; pin: string }, CurrentUser>(
    (p) => invoke(CH.authLogin, p),
  );

  useEffect(() => {
    if (pickedId) setTimeout(() => document.getElementById('pin-input')?.focus(), 30);
  }, [pickedId]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!pickedId || pin.length < 4) return;
    try {
      const u = await login.run({ userId: pickedId, pin });
      onLoggedIn(u);
    } catch { /* surfaced */ }
  }

  const picked = (users.data ?? []).find((u) => u.id === pickedId);

  return (
    <div
      className="ds-v2"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'var(--bg)',
        /* subtle vignette on the parchment — warms the centre, falls off at the edges */
        backgroundImage:
          'radial-gradient(ellipse at 50% 40%, var(--paper-50) 0%, var(--bg) 70%)',
      }}
    >
      <div
        style={{
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--s4)',
          padding: 'var(--s7) var(--s5)',
        }}
      >
        {/* Brand lockup — large, centred. The gem boots once as the screen enters. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s2)' }}>
          <LogoMark size={64} boot />
          <Wordmark size={32} />
          {/* a short gold hairline — the identity's one accent, used sparingly */}
          <div
            aria-hidden
            style={{
              width: 48,
              height: 1,
              background: 'var(--accent)',
              marginTop: 'var(--s2)',
            }}
          />
          <div style={{
            fontSize: 'var(--t-xs)',
            color: 'var(--text-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            marginTop: 2,
          }}>
            Demo Jewellers · sign in
          </div>
        </div>

        {users.error && <InlineAlert message={users.error} onDismiss={() => users.reload()} />}
        {users.loading && <div style={{ width: '100%' }}><Progress /></div>}

        {/* ─── user pick */}
        {!pickedId && (users.data ?? []).length > 0 && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <SectionLabel>Pick user</SectionLabel>
            {(users.data ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setPickedId(u.id)}
                className="row"
                style={{
                  cursor: 'pointer',
                  padding: 'var(--s3) var(--s3) var(--s3) var(--s4)',
                  minHeight: 54,
                  gap: 'var(--s3)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-1)',
                  textAlign: 'left',
                  color: 'var(--text)',
                }}
              >
                <UserCircle
                  size={28}
                  weight={u.role === 'owner' ? 'fill' : 'regular'}
                  color={u.role === 'owner' ? 'var(--accent-press)' : 'var(--text-mute)'}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{u.name}</div>
                </div>
                <Pill tone={u.role === 'owner' ? 'accent' : 'default'}>{u.role}</Pill>
              </button>
            ))}
          </div>
        )}

        {/* ─── PIN entry */}
        {pickedId && (
          <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            <SectionLabel>Enter PIN</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s2)' }}>
              <b>{picked?.name}</b>
              {picked && <Pill tone={picked.role === 'owner' ? 'accent' : 'default'}>{picked.role}</Pill>}
            </div>

            <input
              id="pin-input"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              autoComplete="off"
              className="input input--num"
              style={{
                width: '100%',
                height: 48,
                fontSize: 24,
                textAlign: 'center',
                letterSpacing: '0.4em',
              }}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              placeholder="••••"
            />

            {/* The signature PIN beads — kept from v1, each digit lands as a bead. */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--s3)', padding: 'var(--s1) 0' }}>
              {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => {
                const filled = i < pin.length;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className={filled ? 'pin-bead pin-bead-filled' : 'pin-bead'}
                  />
                );
              })}
            </div>

            {login.error && <InlineAlert message={login.error} onDismiss={login.clearError} />}

            <div style={{ display: 'flex', gap: 'var(--s2)' }}>
              <Button
                variant="primary"
                type="submit"
                disabled={login.loading || pin.length < 4}
                style={{ flex: 1, height: 44, fontSize: 'var(--t-md)' }}
              >
                {login.loading ? 'Signing in…' : 'Sign in'}
              </Button>
              <Button
                type="button"
                onClick={() => { setPickedId(null); setPin(''); login.clearError(); }}
                style={{ height: 44 }}
              >
                Back
              </Button>
            </div>

            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)', textAlign: 'center' }}>
              Owner default PIN is <span style={{ fontFamily: 'var(--font-mono)' }}>1234</span> — change it in Settings.
            </div>
          </form>
        )}

        {/* small footer — the kind of thing a leather-bound book has stamped at the bottom */}
        <div style={{
          marginTop: 'var(--s3)',
          fontSize: 10,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
        }}>
          Est. 2026 · offline
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--t-sm)',
      color: 'var(--text-mute)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
    }}>{children}</div>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert" style={{ width: '100%' }}>
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>}
    </div>
  );
}
