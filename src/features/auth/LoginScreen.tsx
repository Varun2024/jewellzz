import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync, useMutation } from '@/lib/useAsync';
import { ErrorBanner, LoadingBlock, Spinner } from '@/components/Status';
import { LogoMark, Wordmark } from '@/components/Logo';
import { UserCircle } from '@phosphor-icons/react';

type UserRow = { id: number; name: string; role: 'owner' | 'counter' };
type CurrentUser = { id: number; name: string; role: 'owner' | 'counter' };

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (u: CurrentUser) => void }) {
  const users = useAsync<UserRow[]>(() => invoke(CH.authListUsers));
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const login = useMutation<{ userId: number; pin: string }, CurrentUser>(
    (p) => invoke(CH.authLogin, p),
  );

  // Auto-focus PIN input when a user is picked
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

  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ background: 'var(--paper)' }}
    >
      <div className="card" style={{ width: 380, padding: 28 }}>
        <div className="flex items-center gap-3 mb-5 pb-5 border-b border-[var(--rule)]">
          <LogoMark size={36} />
          <div>
            <Wordmark size={20} />
            <div className="text-[10px] text-[var(--ink-500)] tracking-widest uppercase mt-1">
              Demo Jewellers · sign in
            </div>
          </div>
        </div>

        {users.error && <ErrorBanner message={users.error} onDismiss={() => users.reload()} />}
        {users.loading && <LoadingBlock label="loading users" />}

        {!pickedId && (users.data ?? []).length > 0 && (
          <div className="space-y-2">
            <div className="section-label mb-2">— pick user ————————</div>
            {(users.data ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setPickedId(u.id)}
                className="w-full flex items-center gap-3 p-3 rounded"
                style={{
                  border: '1px solid var(--rule)',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <UserCircle
                  size={28}
                  weight={u.role === 'owner' ? 'fill' : 'regular'}
                  color={u.role === 'owner' ? 'var(--gold-700)' : 'var(--ink-500)'}
                />
                <div className="flex-1">
                  <div style={{ fontWeight: 500 }}>{u.name}</div>
                  <div className="text-[11px] mono uppercase tracking-wider text-[var(--ink-500)]">
                    {u.role}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {pickedId && (
          <form onSubmit={submit} className="space-y-3">
            <div className="section-label">— enter PIN ————————</div>
            <div className="text-sm">
              <b>{(users.data ?? []).find((u) => u.id === pickedId)?.name}</b>
              <span className="text-[var(--ink-500)] text-[11px] mono uppercase tracking-wider ml-2">
                {(users.data ?? []).find((u) => u.id === pickedId)?.role}
              </span>
            </div>
            <input
              id="pin-input"
              type="password"
              inputMode="numeric"
              pattern="\d*"
              autoComplete="off"
              className="input w-full mono text-center"
              style={{ height: 44, fontSize: 22, letterSpacing: '0.4em' }}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              placeholder="••••"
            />
            {login.error && <ErrorBanner message={login.error} onDismiss={login.clearError} />}
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={login.loading || pin.length < 4}
                style={{ height: 40 }}
              >
                {login.loading ? <Spinner label="signing in" /> : 'Sign in'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => { setPickedId(null); setPin(''); login.clearError(); }}
              >
                Back
              </button>
            </div>
            <div className="text-[11px] text-[var(--ink-500)] text-center">
              Owner default PIN is <span className="mono">1234</span> — change it in Settings.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
