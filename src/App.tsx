import { useCallback, useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { Shell } from './app/Shell';
import { LoginScreen } from './features/auth/LoginScreen';
import { BootScreen } from './features/boot/BootScreen';
import { shouldShowHomeToday } from './features/home/HomeScreen';

type CurrentUser = { id: number; name: string; role: 'owner' | 'counter' };

// Minimum time the boot screen stays visible — otherwise on a fast machine the
// identity moment is just a flash. 900ms gives the gem one full pulse and the
// progress hairline enough time to sweep across once.
const MIN_BOOT_MS = 900;

export default function App() {
  const [me, setMe] = useState<CurrentUser | null | undefined>(undefined); // undefined = still checking
  const [bootHeld, setBootHeld] = useState(true);
  const [ping, setPing] = useState<string>('...');

  useEffect(() => {
    const started = Date.now();
    invoke<CurrentUser | null>(CH.authWhoami)
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => {
        const elapsed = Date.now() - started;
        const wait = Math.max(0, MIN_BOOT_MS - elapsed);
        setTimeout(() => setBootHeld(false), wait);
      });
  }, []);

  useEffect(() => {
    if (!me) return;
    const tick = () => {
      invoke<{ ok: boolean; ts: number }>(CH.ping)
        .then((r) => setPing(`ok @ ${new Date(r.ts).toLocaleTimeString()}`))
        .catch((e) => setPing(`err: ${e.message}`));
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [me]);

  const onLogout = useCallback(async () => {
    try { await invoke(CH.authLogout); } catch { /* ignore */ }
    setMe(null);
  }, []);

  if (me === undefined || bootHeld) {
    return <BootScreen />;
  }

  if (me === null) {
    return <LoginScreen onLoggedIn={setMe} />;
  }

  // Owner lands on the Today screen the first time they log in on a given day.
  // Counter role and same-day subsequent logins go straight to Sale.
  const initialActive = me.role === 'owner' && shouldShowHomeToday() ? 'home' : 'sale';

  return <Shell status={ping} me={me} onLogout={onLogout} initialActive={initialActive} />;
}
