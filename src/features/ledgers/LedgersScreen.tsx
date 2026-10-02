/* Ledgers (cash / metal / party) — ported to v2 primitives. */

import { useState } from 'react';
import { CH, invoke } from '@/lib/ipc';
import { useAsync } from '@/lib/useAsync';
import type { Party } from '@shared/ipc';
import {
  Sheet, Button, Tabs, Rupee, Weight, Pill, Progress, Empty,
} from '@/components/ui';
import { BalancedMark } from '@/components/illustrations';

type Tab = 'cash' | 'metal' | 'party';

export function LedgersScreen() {
  const [tab, setTab] = useState<Tab>('cash');
  return (
    <div className="ds-v2" style={{ padding: 'var(--container-pad)', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 'var(--s4)', height: '100%', minHeight: 0 }}>
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'cash',  label: 'Cash' },
            { value: 'metal', label: 'Metal' },
            { value: 'party', label: 'Party' },
          ]}
        />
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {tab === 'cash'  && <CashLedger />}
          {tab === 'metal' && <MetalLedger />}
          {tab === 'party' && <PartyLedger />}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Cash ---------------------------- */

function CashLedger() {
  const r = useAsync<any[]>(() => invoke(CH.ledgerCash, {}));
  if (r.loading) return <LoadingState label="opening the cash ledger…" />;
  if (r.error)   return <InlineAlert message={r.error} onDismiss={() => r.reload()} />;
  const rows = r.data ?? [];
  const closing = rows.length ? rows[rows.length - 1].balancePaise : 0;

  return (
    <Sheet
      title="Cash ledger"
      action={
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Closing
          </span>
          <span style={{ fontSize: 'var(--t-lg)' }}>
            <Rupee paise={closing} signed />
          </span>
        </div>
      }
      flush
    >
      {rows.length === 0 ? (
        <Empty mark="till" title="The till has been quiet" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 170 }}>When</th>
              <th style={{ width: 160 }}>Ref</th>
              <th>Note</th>
              <th className="num" style={{ width: 120 }}>Debit</th>
              <th className="num" style={{ width: 120 }}>Credit</th>
              <th className="num" style={{ width: 140 }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                  {new Date(row.ts * 1000).toLocaleString('en-IN')}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                  {row.refType} #{row.refId ?? ''}
                </td>
                <td>{row.note}</td>
                <td className="num">{row.debitPaise  ? <Rupee paise={row.debitPaise}  /> : ''}</td>
                <td className="num">{row.creditPaise ? <Rupee paise={row.creditPaise} /> : ''}</td>
                <td className="num"><Rupee paise={row.balancePaise} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Sheet>
  );
}

/* ---------------------------- Metal --------------------------- */

function MetalLedger() {
  const buckets = useAsync<any[]>(() => invoke(CH.metalBuckets));
  const [bucket, setBucket] = useState<{ category: string; stamp: string } | null>(null);
  const rows = useAsync<any[]>(
    () => bucket ? invoke(CH.ledgerMetal, { category: bucket.category, stamp: bucket.stamp }) : Promise.resolve([]),
    [bucket?.category, bucket?.stamp],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--s4)', height: '100%', minHeight: 0 }}>
      {/* buckets rail */}
      <Sheet title="Buckets" flush>
        {buckets.loading && <div style={{ padding: 12 }}><Progress /></div>}
        {buckets.error && <div style={{ padding: 12 }}><InlineAlert message={buckets.error} onDismiss={() => buckets.reload()} /></div>}
        {!buckets.loading && !buckets.error && (buckets.data?.length ?? 0) === 0 && (
          <div style={{ padding: 'var(--s4)' }}><Empty mark="scale" title="Metal has not moved yet" /></div>
        )}
        <div>
          {(buckets.data ?? []).map((b, i) => {
            const active = bucket?.category === b.category && bucket?.stamp === b.stamp;
            return (
              <BucketRow
                key={i}
                active={active}
                onClick={() => setBucket({ category: b.category, stamp: b.stamp })}
                left={<span>{b.category}{b.stamp ? ` · ${b.stamp}` : ''}</span>}
                right={<Weight mg={b.balanceMg} />}
              />
            );
          })}
        </div>
      </Sheet>

      {/* rows */}
      <div style={{ minWidth: 0, overflow: 'auto' }}>
        {!bucket && (
          <Sheet title="Metal rows"><Empty title="Pick a bucket on the left" /></Sheet>
        )}
        {bucket && rows.loading && <LoadingState label="turning the page…" />}
        {bucket && rows.error && <InlineAlert message={rows.error} onDismiss={() => rows.reload()} />}
        {bucket && !rows.loading && !rows.error && (
          <Sheet title={`${bucket.category}${bucket.stamp ? ' · ' + bucket.stamp : ''}`} flush>
            {(rows.data?.length ?? 0) === 0 ? (
              <Empty title="No rows for this bucket yet" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 170 }}>When</th>
                    <th style={{ width: 160 }}>Ref</th>
                    <th>Note</th>
                    <th className="num" style={{ width: 110 }}>In</th>
                    <th className="num" style={{ width: 110 }}>Out</th>
                    <th className="num" style={{ width: 130 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                        {new Date(r.ts * 1000).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                        {r.refType} #{r.refId ?? ''}
                      </td>
                      <td>{r.note}</td>
                      <td className="num">{r.debitMg  ? <Weight mg={r.debitMg} />  : ''}</td>
                      <td className="num">{r.creditMg ? <Weight mg={r.creditMg} /> : ''}</td>
                      <td className="num"><Weight mg={r.balanceMg} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Sheet>
        )}
      </div>
    </div>
  );
}

function BucketRow({
  active, onClick, left, right,
}: {
  active?: boolean;
  onClick: () => void;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div
      className="row"
      data-active={active ? 'true' : undefined}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ flex: 1, fontSize: 'var(--t-sm)' }}>{left}</div>
      <div style={{ fontSize: 'var(--t-sm)' }}>{right}</div>
    </div>
  );
}

/* ---------------------------- Party --------------------------- */

function PartyLedger() {
  const parties = useAsync<Party[]>(() => invoke(CH.partiesList));
  const [partyId, setPartyId] = useState<number | null>(null);
  const rows = useAsync<any[]>(
    () => partyId ? invoke(CH.ledgerParty, { partyId }) : Promise.resolve([]),
    [partyId],
  );
  const cashRows = (rows.data ?? []).filter((r) => r.kind === 'cash');
  const cashClose = cashRows.length ? cashRows[cashRows.length - 1].balance : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      {parties.error && <InlineAlert message={parties.error} onDismiss={() => parties.reload()} />}
      <div className="field" style={{ maxWidth: 360 }}>
        <label className="field__label">Party</label>
        <select
          className="input"
          value={partyId ?? ''}
          onChange={(e) => setPartyId(Number(e.target.value) || null)}
          disabled={parties.loading}
        >
          <option value="">{parties.loading ? 'opening the directory…' : '— pick party —'}</option>
          {(parties.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
          ))}
        </select>
      </div>

      {partyId && rows.error   && <InlineAlert message={rows.error} onDismiss={() => rows.reload()} />}
      {partyId && rows.loading && <LoadingState label="consulting the ledger…" />}
      {partyId && !rows.loading && !rows.error && (
        <>
          <OwesCard paise={cashClose} />
          <Sheet title="Movements" flush>
            {(rows.data?.length ?? 0) === 0 ? (
              <Empty mark="ledger" title="No movements yet for this party" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>When</th>
                    <th style={{ width: 90 }}>Kind</th>
                    <th style={{ width: 150 }}>Ref</th>
                    <th>Note</th>
                    <th className="num" style={{ width: 120 }}>Debit</th>
                    <th className="num" style={{ width: 120 }}>Credit</th>
                    <th className="num" style={{ width: 140 }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                        {new Date(r.ts * 1000).toLocaleString('en-IN')}
                      </td>
                      <td style={{ fontSize: 'var(--t-sm)' }}>
                        {r.kind}
                        {r.kind === 'metal' && r.category ? ` · ${r.category}${r.stamp ? '/' + r.stamp : ''}` : ''}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                        {r.refType} #{r.refId ?? ''}
                      </td>
                      <td>{r.note}</td>
                      <td className="num">
                        {r.debit ? (r.kind === 'cash' ? <Rupee paise={r.debit} /> : <Weight mg={r.debit} />) : ''}
                      </td>
                      <td className="num">
                        {r.credit ? (r.kind === 'cash' ? <Rupee paise={r.credit} /> : <Weight mg={r.credit} />) : ''}
                      </td>
                      <td className="num">
                        {r.kind === 'cash' ? <Rupee paise={r.balance} /> : <Weight mg={r.balance} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Sheet>
        </>
      )}
    </div>
  );
}

/* OwesCard — the token-driven replacement for the old pink/moss card.
 * Keeps the "party owes shop" vs "shop owes party" vocabulary but speaks in
 * pos/neg tokens so the moment stays within the v2 palette. */
function OwesCard({ paise }: { paise: number }) {
  if (paise === 0) {
    return (
      <Sheet>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
          <BalancedMark size={56} />
          <div>
            <Pill>settled</Pill>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--t-lg)',
              color: 'var(--text-mute)',
              marginTop: 4,
            }}>
              <Rupee paise={0} />
            </div>
          </div>
        </div>
      </Sheet>
    );
  }
  const partyOwes = paise > 0;
  return (
    <Sheet>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s4)' }}>
        <Pill tone={partyOwes ? 'neg' : 'pos'}>
          {partyOwes ? 'party owes shop' : 'shop owes party'}
        </Pill>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--t-2xl)',
          color: partyOwes ? 'var(--neg)' : 'var(--pos)',
          fontWeight: 500,
        }}>
          <Rupee paise={Math.abs(paise)} />
        </span>
      </div>
    </Sheet>
  );
}

/* ---------------------------- bits ---------------------------- */

function LoadingState({ label }: { label: string }) {
  return (
    <div>
      <Progress />
      <div style={{
        marginTop: 8, fontSize: 'var(--t-sm)',
        color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>{label}</div>
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

/* Make Button survive tree-shaking in case something imports LedgersScreen
 * before the file compiles — Button is used indirectly via jsx helpers. */
void Button;
