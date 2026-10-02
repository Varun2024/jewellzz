/* v2 primitives preview.
 * Two pages: `atoms` shows each primitive in isolation, `composed` shows a
 * real Sale-screen mockup built entirely from primitives.
 * Reached via Ctrl+Alt+U — see main.tsx.
 */

import { useState } from 'react';
import {
  Sheet, Row, Button, Kbd, Field, Num, Rupee, Weight,
  Nav, Tabs, Empty, Progress, Pill,
} from '@/components/ui';

type Page = 'atoms' | 'composed';

export function UiPreview() {
  const [page, setPage] = useState<Page>('composed');
  const [mood, setMood] = useState<'counter' | 'book'>('counter');

  return (
    <div className={`ds-v2 mood-${mood}`} style={{ minHeight: '100vh' }}>
      {/* top strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Jewelzz UI · v2 preview</div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 20 }}>
          <Button variant={page === 'composed' ? 'primary' : 'secondary'} onClick={() => setPage('composed')}>Composed screen</Button>
          <Button variant={page === 'atoms' ? 'primary' : 'secondary'} onClick={() => setPage('atoms')}>Atoms</Button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Button variant={mood === 'counter' ? 'primary' : 'secondary'} onClick={() => setMood('counter')}>Counter mood</Button>
          <Button variant={mood === 'book' ? 'primary' : 'secondary'} onClick={() => setMood('book')}>Book mood</Button>
        </div>
      </div>
      {page === 'composed' ? <ComposedSale /> : <Atoms />}
    </div>
  );
}

/* ============================================================
 * Composed Sale screen — proves the system carries real work.
 * ============================================================ */

const NAV_LEDGERS = [
  { key: 'sale',     label: 'Sale',     kbd: '1' },
  { key: 'purchase', label: 'Purchase', kbd: '2' },
  { key: 'karigar',  label: 'Karigar',  kbd: '3' },
  { key: 'refining', label: 'Refining', kbd: '4' },
] as const;
const NAV_BOOKS = [
  { key: 'cash',    label: 'Cash ledger',    kbd: '5' },
  { key: 'metal',   label: 'Metal ledger',   kbd: '6' },
  { key: 'party',   label: 'Party ledger',   kbd: '7' },
  { key: 'gst',     label: 'GST reports',    kbd: '8' },
] as const;

const MOCK_LINES = [
  { id: 1, code: 'GC-2201', name: '22K chain — 18"',         wtMg: 12_450, ratePaise: 6_450_00, amountPaise: 80_320_50 },
  { id: 2, code: 'GC-2418', name: '22K stud pair (pcs)',     wtMg:  3_100, ratePaise: 6_450_00, amountPaise: 19_995_00 },
  { id: 3, code: 'DM-A012', name: 'Solitaire · 0.62 ct',     wtMg:    124, ratePaise: 0,         amountPaise: 1_45_000_00 },
  { id: 4, code: 'GC-2201', name: '22K bangle · matte',      wtMg:  8_720, ratePaise: 6_450_00, amountPaise: 56_244_00 },
];

function ComposedSale() {
  const [nav, setNav] = useState<string>('sale');
  const [tab, setTab] = useState<'items' | 'payments' | 'notes'>('items');
  const [emphasizedRow, setEmphasizedRow] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const totalPaise = MOCK_LINES.reduce((s, l) => s + l.amountPaise, 0);
  const totalWtMg  = MOCK_LINES.reduce((s, l) => s + l.wtMg, 0);

  function fakeWeighAndPrint() {
    setLoading(true);
    setEmphasizedRow(null);
    setTimeout(() => {
      setLoading(false);
      setEmphasizedRow(999);            // the totals row flash
      setTimeout(() => setEmphasizedRow(null), 500);
    }, 900);
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '224px 1fr 300px',
      minHeight: 'calc(100vh - 42px)',
    }}>
      {/* ---------- sidebar ---------- */}
      <aside style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 4,
            background: 'var(--accent)', color: 'var(--accent-fg)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
          }}>J</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Ramesh & Sons</div>
          <span style={{ marginLeft: 'auto' }}><Kbd>⌘K</Kbd></span>
        </div>

        <Nav>
          <Nav.Section>Counter</Nav.Section>
          {NAV_LEDGERS.map((n) => (
            <Nav.Item
              key={n.key}
              active={nav === n.key}
              kbd={n.kbd}
              onClick={() => setNav(n.key)}
            >
              {n.label}
            </Nav.Item>
          ))}
          <Nav.Section>Books</Nav.Section>
          {NAV_BOOKS.map((n) => (
            <Nav.Item
              key={n.key}
              active={nav === n.key}
              kbd={n.kbd}
              onClick={() => setNav(n.key)}
            >
              {n.label}
            </Nav.Item>
          ))}
        </Nav>

        {/* today's rates panel */}
        <div style={{ padding: 16, marginTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{
            fontSize: 'var(--t-xs)', color: 'var(--text-faint)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
          }}>Today's rates</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RateLine label="Gold 22K" paise={6_450_00} unit="g" />
            <RateLine label="Gold 18K" paise={5_280_00} unit="g" delta="up" />
            <RateLine label="Silver"   paise={   82_00} unit="g" delta="down" />
          </div>
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <main style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}>
        {/* screen header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 'var(--t-lg)', fontWeight: 600 }}>New sale</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-sm)', color: 'var(--text-mute)' }}>
                draft · INV-0148
              </div>
              <Pill tone="accent">unposted</Pill>
            </div>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', marginTop: 2 }}>
              Ramesh Jewellers · Mumbai · GSTIN 27ABCDE1234F1Z5
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button kbd="Esc">Discard</Button>
            <Button variant="primary" kbd="⌘↵" onClick={fakeWeighAndPrint} disabled={loading}>
              Weigh & print
            </Button>
          </div>
        </div>

        {/* loading hairline slot */}
        {loading && <Progress />}

        {/* customer + tabs */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
            <Field label="Party" defaultValue="Ramesh Jewellers" hint="12 previous bills · balance ₹42,000 Cr" />
            <Field label="Bill date"  defaultValue="2026-10-01" />
            <Field label="Payment terms" defaultValue="On delivery" />
          </div>
        </div>

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'items',    label: 'Items',    count: MOCK_LINES.length },
            { value: 'payments', label: 'Payments', count: 2 },
            { value: 'notes',    label: 'Notes' },
          ]}
        />

        <div style={{ flex: 1, overflow: 'auto' }}>
          {tab === 'items' && (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Code</th>
                  <th>Description</th>
                  <th className="num" style={{ width: 100 }}>Weight</th>
                  <th className="num" style={{ width: 120 }}>Rate</th>
                  <th className="num" style={{ width: 140 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_LINES.map((l) => (
                  <tr key={l.id}>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-mute)',
                      fontSize: 'var(--t-sm)',
                    }}>{l.code}</td>
                    <td>{l.name}</td>
                    <td className="num"><Weight mg={l.wtMg} /></td>
                    <td className="num">
                      {l.ratePaise > 0 ? <Rupee paise={l.ratePaise} /> : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td className="num"><Rupee paise={l.amountPaise} /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ padding: '8px 12px' }}>
                    <Button variant="link" kbd="N">+ add line</Button>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {tab === 'payments' && (
            <div style={{ padding: 24 }}>
              <Empty
                title="No payment splits yet"
                action={<Button variant="primary" kbd="P">Add payment</Button>}
              >
                A bill can be split across cash, UPI, card, or old-gold adjustment. Add rows as needed — they don't post until the whole bill posts.
              </Empty>
            </div>
          )}

          {tab === 'notes' && (
            <div style={{ padding: 24, color: 'var(--text-mute)' }}>
              <div className="section" style={{ maxWidth: 600 }}>
                No notes. Anything you write here prints on the invoice back.
              </div>
            </div>
          )}
        </div>

        {/* totals bar */}
        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 24,
        }}>
          <MetaCol label="Items" value={MOCK_LINES.length} />
          <MetaCol label="Gross weight" value={<Weight mg={totalWtMg} />} />
          <MetaCol label="CGST 1.5%" value={<Rupee paise={Math.round(totalPaise * 0.015)} />} />
          <MetaCol label="SGST 1.5%" value={<Rupee paise={Math.round(totalPaise * 0.015)} />} />
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <div style={{ fontSize: 'var(--t-xs)', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total
            </div>
            <Row
              emphasize={emphasizedRow === 999}
              style={{
                border: 'none',
                padding: '0 0 0 14px',
                minHeight: 'auto',
                background: 'transparent',
              }}
            >
              <span style={{ fontSize: 'var(--t-2xl)', fontWeight: 500 }}>
                <Rupee paise={totalPaise + Math.round(totalPaise * 0.03)} />
              </span>
            </Row>
          </div>
        </div>
      </main>

      {/* ---------- right rail ---------- */}
      <aside style={{
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <Sheet title="Party — Ramesh Jewellers" flush>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatRow label="Bills · 90 days"    value={<Num value={12} />} />
            <StatRow label="Turnover"           value={<Rupee paise={18_45_000_00} />} />
            <StatRow label="Current balance"    value={<Rupee paise={42_000_00} signed />} tone="pos" />
            <StatRow label="Last visit"         value="14 Sep 2026" />
          </div>
        </Sheet>

        <Sheet title="Yesterday" flush>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatRow label="Bills"           value={<Num value={7} />} />
            <StatRow label="Gross"           value={<Rupee paise={4_82_100_00} />} />
            <StatRow label="Cash collected"  value={<Rupee paise={2_40_000_00} />} />
            <StatRow label="Metal received"  value={<Weight mg={14_200} />} />
          </div>
        </Sheet>

        <div style={{ marginTop: 'auto', fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>
          Ctrl+Space ring the Bell · ? all shortcuts
        </div>
      </aside>
    </div>
  );
}

function RateLine({ label, paise, unit, delta }: {
  label: string; paise: number; unit: 'g' | 'ct'; delta?: 'up' | 'down';
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 'var(--t-sm)' }}>
      <span style={{ color: 'var(--text-mute)', flex: 1 }}>{label}</span>
      <Rupee paise={paise} />
      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-faint)' }}>/{unit}</span>
      {delta && (
        <span style={{
          fontSize: 10,
          color: delta === 'up' ? 'var(--pos)' : 'var(--neg)',
          width: 8,
        }}>
          {delta === 'up' ? '▲' : '▼'}
        </span>
      )}
    </div>
  );
}

function MetaCol({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        fontSize: 'var(--t-xs)', color: 'var(--text-mute)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>{label}</div>
      <div style={{ fontSize: 'var(--t-md)' }}>{value}</div>
    </div>
  );
}

function StatRow({ label, value, tone }: {
  label: string; value: React.ReactNode; tone?: 'pos' | 'neg';
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ color: 'var(--text-mute)', flex: 1, fontSize: 'var(--t-sm)' }}>{label}</span>
      <span style={{ color: tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : undefined }}>
        {value}
      </span>
    </div>
  );
}

/* ============================================================
 * Atoms page — every primitive in isolation.
 * ============================================================ */

function Atoms() {
  const [selected, setSelected] = useState<number>(1);
  const [emph, setEmph] = useState<number | null>(null);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');

  const rows = [
    { id: 1, bill: 'INV-0142', party: 'Ramesh Jewellers',  paise: 12_34_567_89, wt: 45_230 },
    { id: 2, bill: 'INV-0143', party: 'Kapoor & Sons',     paise:  4_82_100_00, wt: 12_450 },
    { id: 3, bill: 'INV-0144', party: 'Krishna Ornaments', paise:    75_600_00, wt:  2_300 },
    { id: 4, bill: 'INV-0145', party: 'Sunita Devi',       paise:  1_20_000_00, wt:  4_120 },
  ];

  function flash() {
    setEmph(2);
    setTimeout(() => setEmph(null), 500);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960, margin: '0 auto' }}>

        <Sheet title="Buttons">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" kbd="⌘S">Save</Button>
            <Button variant="secondary" kbd="Esc">Cancel</Button>
            <Button variant="link">Reset filters</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-mute)' }}>Ring:</span>
              <Kbd>Ctrl</Kbd> <Kbd>Space</Kbd>
            </div>
          </div>
        </Sheet>

        <Sheet title="Tabs (sliding indicator)" flush>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'a', label: 'Overview',  count: 4 },
              { value: 'b', label: 'Ledgers',   count: 12 },
              { value: 'c', label: 'Settings' },
            ]}
          />
          <div style={{ padding: 20, color: 'var(--text-mute)' }}>
            Panel content for <b style={{ color: 'var(--text)' }}>{tab}</b>. Click tabs — watch the accent bar slide.
          </div>
        </Sheet>

        <Sheet title="Fields">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Field label="Party name" placeholder="e.g. Ramesh Jewellers" hint="Existing customer? Start typing." />
            <Field label="Rate" numeric placeholder="0" hint="₹ per gram, 22K" />
            <Field
              label="PIN"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              error={pin.length > 0 && pin.length < 4 ? 'PIN must be 4+ digits' : undefined}
            />
          </div>
        </Sheet>

        <Sheet title="Numbers">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <NumSample label="Amount">        <Rupee paise={12_34_567_89} /></NumSample>
            <NumSample label="Small">         <Rupee paise={75_00} /></NumSample>
            <NumSample label="Signed credit"> <Rupee paise={  4_82_100_00} signed /></NumSample>
            <NumSample label="Signed debit">  <Rupee paise={-2_10_000_00} signed /></NumSample>
            <NumSample label="Weight (g)">    <Weight mg={45_230} /></NumSample>
            <NumSample label="Weight (mg)">   <Weight mg={125} unit="mg" /></NumSample>
            <NumSample label="Weight (carat)"><Weight mg={615} unit="ct" /></NumSample>
            <NumSample label="Plain int">     <Num value={12345} /></NumSample>
          </div>
        </Sheet>

        <Sheet
          title="Rows (column-rule signature)"
          action={<Button variant="link" onClick={flash}>Flash row 2 · post</Button>}
          flush
        >
          {rows.map((r) => (
            <Row
              key={r.id}
              active={selected === r.id}
              emphasize={emph === r.id}
              onClick={() => setSelected(r.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ width: 96, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)', fontSize: 'var(--t-sm)' }}>
                {r.bill}
              </div>
              <div style={{ flex: 1 }}>{r.party}</div>
              <div style={{ width: 120, textAlign: 'right' }}><Weight mg={r.wt} /></div>
              <div style={{ width: 160, textAlign: 'right' }}><Rupee paise={r.paise} /></div>
            </Row>
          ))}
        </Sheet>

        <Sheet title="Pills, Progress, Empty">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Pill>draft</Pill>
            <Pill tone="accent">unposted</Pill>
            <Pill tone="pos">paid</Pill>
            <Pill tone="neg">overdue</Pill>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--text-mute)', marginBottom: 4 }}>loading a list…</div>
            <Progress />
          </div>
          <Empty title="Nothing on the ledger yet" action={<Button variant="primary" kbd="N">New sale</Button>}>
            The counter opens with an empty book. Ring a customer up to write the first line.
          </Empty>
        </Sheet>

      </div>
    </div>
  );
}

function NumSample({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize: 'var(--t-sm)',
        color: 'var(--text-mute)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>{label}</div>
      <div style={{ fontSize: 'var(--t-lg)' }}>{children}</div>
    </div>
  );
}
