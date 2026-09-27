import { useEffect, useState } from 'react';
import { Shell } from './app/Shell';

export default function App() {
  const [ping, setPing] = useState<string>('...');

  useEffect(() => {
    window.jewelzz
      .invoke<{ ok: boolean; ts: number }>('app.ping')
      .then((r) => setPing(`ok @ ${new Date(r.ts).toLocaleTimeString()}`))
      .catch((e) => setPing(`err: ${e.message}`));
  }, []);

  return <Shell status={ping} />;
}
