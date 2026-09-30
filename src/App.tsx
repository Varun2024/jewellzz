import { useCallback, useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { Shell } from './app/Shell';
import { LoginScreen } from './features/auth/LoginScreen';
import { LoadingBlock } from './components/Status';

type CurrentUser = { id: number; name: string; role: 'owner' | 'counter' };

export default function App() {
  const [me, setMe] = useState<CurrentUser | null | undefined>(undefined); // undefined = still checking
  const [ping, setPing] = useState<string>('...');

  useEffect(() => {
    invoke<CurrentUser | null>(CH.authWhoami).then(setMe).catch(() => setMe(null));
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

  if (me === undefined) {
    return <div style={{ padding: 40 }}><LoadingBlock label="starting jewelzz" /></div>;
  }

  if (me === null) {
    return <LoginScreen onLoggedIn={setMe} />;
  }

  return <Shell status={ping} me={me} onLogout={onLogout} />;
}
