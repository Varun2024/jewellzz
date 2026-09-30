import type Database from 'better-sqlite3';
import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

// ponytail: A4 sheet, 3 columns × 8 rows = 24 labels per page.
// Each label: name + SKU + weight + Code-128 barcode of the SKU.

const INK = '#14100E';
const MUTED = '#7A6E64';
const GOLD = '#B8892E';

function labelsDir(): string {
  const dir = path.join(app.getPath('userData'), 'labels');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fmtG(mg: number): string {
  if (!mg) return '';
  return `${(mg / 1000).toFixed(3)} g`;
}

async function barcode(sku: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: sku,
    scale: 2,
    height: 8,
    includetext: false,
    backgroundcolor: 'FFFFFF',
  });
}

export async function printLabels(
  db: Database.Database,
  input: { itemIds: number[]; copies?: number },
): Promise<{ path: string; count: number }> {
  const { itemIds, copies = 1 } = input;
  if (itemIds.length === 0) throw new Error('no items selected');

  const items = db.prepare(
    `SELECT id, sku, name, category, stamp, unit, stock_wt_mg as stockWtMg
     FROM items WHERE id IN (${itemIds.map(() => '?').join(',')})`,
  ).all(...itemIds) as any[];

  // expand by copies
  const labels: typeof items = [];
  for (const it of items) for (let i = 0; i < copies; i++) labels.push(it);

  const file = path.join(labelsDir(), `labels-${Date.now()}.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 20 });
  const stream = fs.createWriteStream(file);
  doc.pipe(stream);

  // A4 = 595 × 842 pt at pdfkit default. 3×8 grid with 20pt margin.
  const cols = 3, rows = 8;
  const marginX = 20, marginY = 24;
  const cellW = (doc.page.width - marginX * 2) / cols;
  const cellH = (doc.page.height - marginY * 2) / rows;

  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    const pageIdx = Math.floor(i / (cols * rows));
    const slotIdx = i % (cols * rows);
    if (pageIdx > 0 && slotIdx === 0) doc.addPage();

    const c = slotIdx % cols;
    const r = Math.floor(slotIdx / cols);
    const x = marginX + c * cellW;
    const y = marginY + r * cellH;

    // hairline border
    doc.strokeColor('#D8CFBE').lineWidth(0.4);
    doc.rect(x + 3, y + 3, cellW - 6, cellH - 6).stroke();

    // brand mark corner accent
    doc.fillColor(GOLD).circle(x + 8, y + 8, 1.4).fill();

    // Name
    doc.font('Helvetica-Bold').fontSize(9).fillColor(INK);
    doc.text(l.name, x + 8, y + 12, { width: cellW - 16, ellipsis: true, height: 10 });

    // Category + stamp + weight
    doc.font('Helvetica').fontSize(7).fillColor(MUTED);
    const meta = `${l.category}${l.stamp ? ' · ' + l.stamp : ''}${l.stockWtMg ? ' · ' + fmtG(l.stockWtMg) : ''}`;
    doc.text(meta, x + 8, y + 25, { width: cellW - 16, ellipsis: true });

    // Barcode
    try {
      const png = await barcode(l.sku);
      doc.image(png, x + 8, y + 36, { width: cellW - 16, height: cellH - 60 });
    } catch (e) {
      doc.font('Helvetica').fontSize(6).fillColor('#A02C2C')
         .text(`barcode error: ${(e as Error).message}`, x + 8, y + 36, { width: cellW - 16 });
    }

    // SKU
    doc.font('Courier-Bold').fontSize(8).fillColor(INK);
    doc.text(l.sku, x + 8, y + cellH - 18, { width: cellW - 16, align: 'center' });
  }

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  shell.openPath(file).catch(() => {});
  return { path: file, count: labels.length };
}
