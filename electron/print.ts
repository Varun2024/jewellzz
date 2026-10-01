import type Database from 'better-sqlite3';
import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

// A5 portrait PDF, ledger-modern typography (Fraunces / General Sans / JetBrains Mono).
// pdfkit ships Times / Helvetica / Courier by default; we approximate the design with those
// and the palette from the app so the printed bill feels part of the system.

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const p = (paise: number) => `${inr.format(paise / 100)}`;
const g = (mg: number) => (mg / 1000).toFixed(3);

const INK    = '#14100E';
const MUTED  = '#7A6E64';
const RULE   = '#B2A69B';
const GOLD   = '#B8892E';
const FOREST = '#0F2A26'; // night ink — the leather-ledger deep green
const PAPER  = '#F6F2EA';

type Row = Record<string, any>;

// Small J-scale mark drawn with pdfkit primitives (same shape as the app SVG).
function drawLogoStamp(
  doc: PDFKit.PDFDocument,
  x: number, y: number, size: number,
  opts: { onDark?: boolean } = {},
) {
  const s = size / 32;
  const stroke = opts.onDark ? PAPER : INK;
  doc.save();
  doc.strokeColor(stroke).lineWidth(1.2 * s).lineCap('round');
  // J-hook top
  const hookY = y + 5 * s;
  const cx = x + 16 * s;
  doc.path(`M ${x + 10 * s} ${hookY} Q ${x + 10 * s} ${y + 10 * s}, ${cx} ${y + 10 * s} Q ${x + 22 * s} ${y + 10 * s}, ${x + 22 * s} ${hookY}`).stroke();
  // suspension
  doc.moveTo(cx, y + 10 * s).lineTo(cx, y + 17.5 * s).stroke();
  // beam
  doc.moveTo(x + 7 * s, y + 18.5 * s).lineTo(x + 25 * s, y + 18.5 * s).stroke();
  // pan
  doc.path(`M ${x + 7 * s} ${y + 18.5 * s} Q ${cx} ${y + 26.5 * s}, ${x + 25 * s} ${y + 18.5 * s}`).stroke();
  // gem
  doc.fillColor(GOLD).circle(cx, y + 20.5 * s, 1.6 * s).fill();
  doc.restore();
}

function invoicesDir(): string {
  const dir = path.join(app.getPath('userData'), 'invoices');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function printSaleInvoice(db: Database.Database, saleId: number): Promise<{ path: string }> {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as Row | undefined;
  if (!sale) throw new Error(`sale ${saleId} not found`);
  const lines = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id').all(saleId) as Row[];
  const pays = db.prepare('SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id').all(saleId) as Row[];
  const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(sale.party_id) as Row;
  const company = db.prepare('SELECT * FROM companies ORDER BY id LIMIT 1').get() as Row;

  const file = path.join(invoicesDir(), `${sale.bill_no.replace(/[^\w-]/g, '_')}.pdf`);
  const doc = new PDFDocument({ size: 'A5', margin: 32 });
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  const W = doc.page.width;
  const M = 32;
  const rightX = W - M;

  // ─── faint J-scale watermark centered on the page ────────────────────
  // Sits behind everything, only visible if you look for it — real ledger
  // book detail. Drawn first so it renders below the header stripe + text.
  doc.save();
  doc.opacity(0.05);
  drawLogoStamp(doc, W / 2 - 60, doc.page.height / 2 - 60, 120);
  doc.restore();

  // ─── night-ink header strip (deep-green ledger cover) ────────────────
  // A slim forest band at the very top with a gold hairline below anchors
  // the invoice visually — this is what a customer keeps in their file.
  const stripeH = 46;
  doc.rect(0, 0, W, stripeH).fill(FOREST);
  doc.strokeColor(GOLD).lineWidth(0.6);
  doc.moveTo(0, stripeH).lineTo(W, stripeH).stroke();
  doc.moveTo(0, stripeH + 2.5).lineTo(W, stripeH + 2.5).stroke();

  // Company brand rendered on the forest stripe in paper cream
  drawLogoStamp(doc, M, 12, 22, { onDark: true });
  const brandX = M + 30;
  doc.font('Times-Italic').fontSize(18).fillColor(PAPER)
    .text(company.name || 'Jewelzz', brandX, 12);
  doc.font('Helvetica').fontSize(7).fillColor('#D8CFBE')
    .text(`GSTIN ${company.gstin || '—'}   ·   ${company.address || ''}   ·   Ph ${company.phone || '—'}`,
          brandX, 30, { width: W - 2 * M - 30, ellipsis: true });

  // Bill number card top-right, inside the forest stripe
  doc.font('Times-Italic').fontSize(9).fillColor('#EED9A6').text('TAX INVOICE', M, 10, { width: W - 2 * M, align: 'right' });
  doc.font('Courier-Bold').fontSize(13).fillColor(PAPER).text(sale.bill_no, M, 22, { width: W - 2 * M, align: 'right' });
  doc.font('Courier').fontSize(7).fillColor('#D8CFBE').text(
    new Date(sale.ts * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    M, 36, { width: W - 2 * M, align: 'right' }
  );

  // Body starts below the stripe
  const sepY = stripeH + 18;

  // ─── buyer block ─────────────────────────────────────────────────────
  let y = sepY + 12;
  doc.font('Times-Italic').fontSize(8).fillColor(MUTED).text('— buyer —————————————————————', M, y);
  y += 12;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(party.name, M, y);
  y += 14;
  doc.font('Helvetica').fontSize(8).fillColor(MUTED);
  if (party.gstin) doc.text(`GSTIN ${party.gstin}`, M, y), y += 10;
  if (party.address) doc.text(party.address, M, y, { width: W - 2 * M }), y += 12;
  doc.text(`State ${party.state_code || '—'}    ·    Place of supply ${sale.party_state || '—'}    ·    ${sale.interstate ? 'IGST · interstate' : 'CGST + SGST'}`,
    M, y);
  y += 16;

  // ─── items table ─────────────────────────────────────────────────────
  doc.font('Times-Italic').fontSize(8).fillColor(MUTED).text('— items —————————————————————————', M, y);
  y += 12;

  const cols = [
    { h: '#',            w: 18,  align: 'left'  as const },
    { h: 'Item / HSN',   w: 128, align: 'left'  as const },
    { h: 'Qty',          w: 24,  align: 'right' as const },
    { h: 'Wt',           w: 42,  align: 'right' as const },
    { h: 'Rate',         w: 48,  align: 'right' as const },
    { h: 'Making',       w: 42,  align: 'right' as const },
    { h: 'Taxable',      w: 54,  align: 'right' as const },
    { h: 'Tax',          w: 42,  align: 'right' as const },
    { h: 'Total',        w: 54,  align: 'right' as const },
  ];

  doc.strokeColor(RULE).lineWidth(0.5);
  doc.moveTo(M, y).lineTo(rightX, y).stroke();
  let x = M;
  doc.font('Times-Italic').fontSize(7).fillColor(MUTED);
  for (const c of cols) {
    doc.text(c.h.toUpperCase(), x, y + 4, { width: c.w, align: c.align, characterSpacing: 1 });
    x += c.w;
  }
  y += 16;
  doc.moveTo(M, y).lineTo(rightX, y).stroke();
  y += 4;

  doc.font('Helvetica').fontSize(8).fillColor(INK);
  lines.forEach((l, i) => {
    x = M;
    const cells = [
      String(i + 1),
      `${l.description}${l.stamp ? ` (${l.stamp})` : ''}\nHSN ${l.hsn}`,
      String(l.qty || ''),
      l.weight_mg ? (l.unit === 'carat' ? `${(l.weight_mg / 200).toFixed(3)} ct` : `${g(l.weight_mg)} g`) : '',
      p(l.rate_paise),
      p(l.making_paise + l.wastage_paise),
      p(l.taxable_paise),
      p(l.cgst_paise + l.sgst_paise + l.igst_paise),
      p(l.total_paise),
    ];
    for (let ci = 0; ci < cols.length; ci++) {
      const font = ci === 0 || ci === 1 ? 'Helvetica' : 'Courier';
      doc.font(font).fontSize(ci === 0 ? 7 : 8).fillColor(ci === 0 ? MUTED : INK);
      doc.text(cells[ci], x, y, { width: cols[ci].w, align: cols[ci].align });
      x += cols[ci].w;
    }
    y += 22;
  });

  // ─── totals block (right-aligned, torn-ledger treatment) ─────────────
  doc.strokeColor(RULE).lineWidth(0.5);
  doc.moveTo(M, y).lineTo(rightX, y).stroke();
  y += 8;

  const labelX = rightX - 200;
  const valueX = rightX - 60;
  const totalsRow = (label: string, val: string, opts: { bold?: boolean; big?: boolean; muted?: boolean } = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.big ? 10 : 8)
      .fillColor(opts.muted ? MUTED : INK);
    doc.text(label, labelX, y, { width: 140, align: 'right' });
    doc.font('Courier' + (opts.bold ? '-Bold' : '')).fontSize(opts.big ? 12 : 8);
    doc.text(val, valueX, y, { width: 60, align: 'right' });
    y += opts.big ? 16 : 11;
  };

  totalsRow('Subtotal', p(sale.subtotal_paise), { muted: true });
  if (sale.cgst_paise) totalsRow('CGST', p(sale.cgst_paise), { muted: true });
  if (sale.sgst_paise) totalsRow('SGST', p(sale.sgst_paise), { muted: true });
  if (sale.igst_paise) totalsRow('IGST', p(sale.igst_paise), { muted: true });
  if (sale.discount_paise) totalsRow('Discount', `− ${p(sale.discount_paise)}`, { muted: true });
  if (sale.round_off_paise) totalsRow('Round-off', p(sale.round_off_paise), { muted: true });

  // Double hairline in gold above TOTAL
  y += 2;
  doc.strokeColor(GOLD).lineWidth(0.5);
  doc.moveTo(labelX, y).lineTo(rightX, y).stroke();
  doc.moveTo(labelX, y + 2).lineTo(rightX, y + 2).stroke();
  y += 8;
  totalsRow('TOTAL', p(sale.total_paise), { bold: true, big: true });
  y += 4;

  if (sale.paid_cash_paise)     totalsRow('Paid (cash)', p(sale.paid_cash_paise), { muted: true });
  if (sale.paid_bank_paise)     totalsRow('Paid (bank)', p(sale.paid_bank_paise), { muted: true });
  if (sale.old_gold_value_paise) totalsRow('Old-gold credit', p(sale.old_gold_value_paise), { muted: true });
  if (sale.balance_paise) {
    doc.strokeColor(RULE).lineWidth(0.3);
    doc.moveTo(labelX, y).lineTo(rightX, y).stroke();
    y += 4;
    totalsRow('BALANCE', p(sale.balance_paise), { bold: true });
  }

  // ─── old-gold detail (if any) ────────────────────────────────────────
  const og = pays.filter((x) => x.kind === 'old_gold');
  if (og.length) {
    y += 8;
    doc.font('Times-Italic').fontSize(7).fillColor(MUTED)
      .text('— old-gold received —————————————————', M, y);
    y += 10;
    doc.font('Helvetica').fontSize(7).fillColor(INK);
    for (const o of og) {
      doc.text(
        `${o.metal_category} ${o.metal_stamp}  ·  ${g(o.metal_weight_mg)} g  @  ${p(o.metal_rate_paise)}/g  =  ${p(o.amount_paise)}`,
        M, y,
      );
      y += 10;
    }
  }

  // ─── footer ──────────────────────────────────────────────────────────
  y = doc.page.height - 32;
  doc.strokeColor(GOLD).lineWidth(0.4);
  doc.moveTo(M, y - 12).lineTo(rightX, y - 12).stroke();
  doc.font('Times-Italic').fontSize(7).fillColor(MUTED)
    .text('E&OE  ·  Goods once sold cannot be returned  ·  Subject to local jurisdiction',
          M, y - 4, { width: W - 2 * M, align: 'center' });

  // Ledger-book page number, bottom-right
  doc.font('Times-Italic').fontSize(7).fillColor(RULE)
    .text(`p. ${sale.bill_no}`, W - M - 40, doc.page.height - 14, { width: 40, align: 'right' });

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  shell.openPath(file).catch(() => {});
  return { path: file };
}
