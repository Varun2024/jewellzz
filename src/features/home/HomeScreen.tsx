/* Today (Home) screen — ported to v2 primitives.
 *
 * The ambient Weighing of v1 was replaced with a one-shot on-mount play. Same
 * identity, less visual noise while reading.
 */

import { useEffect, useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync } from '@/lib/useAsync';
import { Weighing } from '@/components/Weighing';
import type { Item, MetalRate } from '@shared/ipc';
import { Sheet, Button, Rupee, Weight, Num, Pill, Progress } from '@/components/ui';
import { BalancedMark, SilentCounterMark } from '@/components/illustrations';
import { useAnimatedNumber } from '@/lib/useAnimatedNumber';

type MyUser = { id: number; name: string; role: 'owner' | 'counter' };

export function HomeScreen({ me, onOpenCounter }: { me: MyUser; onOpenCounter: () => void }) {
  // Mark that Home has been shown today — same contract as v1.
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('jewelzz.home.lastShown', today);
    } catch { /* ignore */ }
  }, []);

  // One-shot Weighing — plays on mount, auto-clears so it doesn't loop forever.
  const [weighKey, setWeighKey] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setWeighKey((k) => k + 1), 50);
    return () => clearTimeout(id);
  }, []);

  const rates = useAsync<MetalRate[]>(() => invoke(CH.ratesList));
  const items = useAsync<Item[]>(() => invoke(CH.itemsList));

  const y = yesterdayBounds();
  const salesYesterday = useAsync<Array<{ totalPaise: number }>>(
    () => invoke(CH.salesList, { fromTs: y.from, toTs: y.to }),
    [y.from, y.to],
  );
  const openApprovals = useAsync<any[]>(() => invoke(CH.approvalsList, { status: 'open' }));
  const allOrders = useAsync<any[]>(() => invoke(CH.ordersList, {}));
  const karigarBalances = useAsync<Array<{ metalBalanceMg: number }>>(() => invoke(CH.karigarBalances));

  const au22k = rates.data?.find((r) => r.category === 'gold'   && r.stamp === '22k');
  const ag925 = rates.data?.find((r) => r.category === 'silver' && r.stamp === '925');
  const caseSummary = summarizeCase(items.data ?? []);
  const yesterdayCount = salesYesterday.data?.length ?? 0;
  const yesterdayTotalRaw = (salesYesterday.data ?? []).reduce((s, r) => s + r.totalPaise, 0);
  const yesterdayTotal = useAnimatedNumber(yesterdayTotalRaw, 520);
  const activeOrders = (allOrders.data ?? []).filter(
    (o) => o.status === 'open' || o.status === 'in_progress' || o.status === 'ready',
  ).length;
  const karigarsWithMetal = (karigarBalances.data ?? []).filter((k) => k.metalBalanceMg > 0).length;

  return (
    <div className="ds-v2 mood-book" style={{ padding: 'var(--container-pad)', height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--s7)', padding: 'var(--s5) 0' }}>

        {/* Hero — one-shot Weighing + greeting */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div key={weighKey}>
            <Weighing size={88} mode="once" />
          </div>
          <div style={{
            marginTop: 'var(--s3)',
            fontSize: 24,
            fontWeight: 500,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
          }}>
            {greeting()}, {me.name.toLowerCase()}
          </div>
          <div style={{ marginTop: 6, fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
            {formatToday()}
            {yesterdayCount > 0 && (
              <> · you weighed <b style={{ color: 'var(--text)' }}>{yesterdayCount} {yesterdayCount === 1 ? 'bill' : 'bills'}</b> yesterday</>
            )}
          </div>
        </div>

        {/* Four cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>

          <Sheet title="Today's rates">
            {rates.loading ? <Progress />
              : rates.error ? <InlineAlert message={rates.error} onDismiss={() => rates.reload()} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
                  <RateLine label="Au 22k" rate={au22k} />
                  <RateLine label="Ag 925" rate={ag925} />
                  {au22k && (
                    <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-faint)', paddingTop: 'var(--s1)' }}>
                      set {relTime(au22k.updatedAt)} · by {au22k.updatedBy}
                    </div>
                  )}
                </div>
              )}
          </Sheet>

          <Sheet title="Sitting in your case">
            {items.loading ? <Progress />
              : items.error ? <InlineAlert message={items.error} onDismiss={() => items.reload()} />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
                  <CaseLine label="Gold"       value={caseSummary.gold       ? <Weight mg={caseSummary.gold} />                   : '—'} />
                  <CaseLine label="Silver"     value={caseSummary.silver     ? <Weight mg={caseSummary.silver} />                 : '—'} />
                  <CaseLine label="Stones"     value={caseSummary.stoneCarat ? <Weight mg={caseSummary.stoneCarat} unit="ct" />   : '—'} />
                  <CaseLine
                    label="Artificial"
                    value={caseSummary.artificialPcs
                      ? <><Num value={caseSummary.artificialPcs} /><span style={{ marginLeft: 4, color: 'var(--text-mute)', fontSize: 'var(--t-sm)' }}>pcs</span></>
                      : '—'}
                  />
                </div>
              )}
          </Sheet>

          <Sheet title="Waiting on you">
            {(openApprovals.loading || allOrders.loading || karigarBalances.loading) ? <Progress /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
                <WaitingLine count={openApprovals.data?.length ?? 0} label="approval slip open" plural="approval slips open" />
                <WaitingLine count={activeOrders}                      label="order in progress" plural="orders in progress" />
                <WaitingLine count={karigarsWithMetal}                 label="karigar holds metal" plural="karigars hold metal" />
                {(openApprovals.data?.length ?? 0) === 0 && activeOrders === 0 && karigarsWithMetal === 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--s3)',
                    padding: 'var(--s2) 0',
                  }}>
                    <BalancedMark size={48} />
                    <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                      The ledger is clear.
                    </div>
                  </div>
                )}
              </div>
            )}
          </Sheet>

          <Sheet title="Yesterday">
            {salesYesterday.loading ? <Progress />
              : yesterdayCount === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                  <SilentCounterMark size={48} />
                  <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>No bills recorded yesterday.</div>
                </div>
              )
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
                  <CaseLine label="Bills weighed" value={<Num value={yesterdayCount} />} />
                  <CaseLine label="Total counter" value={<Rupee paise={yesterdayTotal} />} />
                </div>
                /* yesterdayTotal is already count-up smoothed via useAnimatedNumber */
              )}
          </Sheet>
        </div>

        {/* Enter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--s2)' }}>
          <Button
            variant="primary"
            kbd="F2"
            onClick={onOpenCounter}
            style={{ height: 44, padding: '0 24px', fontSize: 'var(--t-md)' }}
          >
            Open the counter
          </Button>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
            this page appears once a day — F2 any morning skips straight to the counter
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- small bits -------------------------- */

function RateLine({ label, rate }: { label: string; rate: MetalRate | undefined }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-mute)', fontSize: 'var(--t-sm)' }}>{label}</span>
      <span style={{ fontSize: 'var(--t-lg)' }}>
        {rate
          ? <><Rupee paise={rate.ratePaisePerG} /><span style={{ color: 'var(--text-mute)', fontSize: 'var(--t-sm)', marginLeft: 2 }}>/g</span></>
          : <span style={{ color: 'var(--text-faint)' }}>—</span>}
      </span>
    </div>
  );
}

function CaseLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-mute)', fontSize: 'var(--t-sm)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function WaitingLine({ count, label, plural }: { count: number; label: string; plural: string }) {
  if (count === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s2)' }}>
      <Pill tone="accent"><Num value={count} /></Pill>
      <span style={{ fontSize: 'var(--t-sm)' }}>{count === 1 ? label : plural}</span>
    </div>
  );
}

function InlineAlert({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="alert">
      <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>
      {onDismiss && <button className="alert__dismiss" onClick={onDismiss} aria-label="dismiss">×</button>}
    </div>
  );
}

/* ---------------------------- helpers --------------------------- */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'good morning';
  if (h < 17) return 'good afternoon';
  return 'good evening';
}
function formatToday(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function yesterdayBounds(): { from: number; to: number } {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
  const from = Math.floor(yesterday.getTime() / 1000);
  const to = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime() / 1000) - 1;
  return { from, to };
}
function relTime(ts: number): string {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
type CaseSummary = { gold: number; silver: number; stoneCarat: number; artificialPcs: number };
function summarizeCase(items: Item[]): CaseSummary {
  const acc: CaseSummary = { gold: 0, silver: 0, stoneCarat: 0, artificialPcs: 0 };
  for (const it of items) {
    if (it.category === 'gold')            acc.gold         += it.stockWtMg;
    else if (it.category === 'silver')     acc.silver       += it.stockWtMg;
    else if (it.category === 'stone')      acc.stoneCarat   += it.stockWtMg;
    else if (it.category === 'artificial') acc.artificialPcs += it.stockQty;
  }
  return acc;
}

/** Public helper for App.tsx to decide whether to auto-land here. */
export function shouldShowHomeToday(): boolean {
  try {
    const today = new Date().toISOString().slice(0, 10);
    return localStorage.getItem('jewelzz.home.lastShown') !== today;
  } catch {
    return false;
  }
}
