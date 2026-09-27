# Design

> Purpose: tokens, patterns, and the shop-counter UX bias. Not a marketing site — an operator tool.

## Direction

Operator UI, not consumer. Dense, keyboard-driven, high info density. Think Bloomberg terminal for a jewellery counter, not shadcn landing page.

Bias: **fewer clicks, more shortcuts.** Every sale-screen action reachable without touching the mouse.

## Tokens

```css
:root {
  /* surfaces */
  --bg:         oklch(98% 0 0);
  --bg-panel:   oklch(96% 0 0);
  --bg-hover:   oklch(93% 0 0);
  --border:     oklch(88% 0 0);

  /* text */
  --text:       oklch(20% 0 0);
  --text-mute:  oklch(45% 0 0);

  /* semantic */
  --accent:     oklch(52% 0.16 250);   /* action, focus */
  --success:    oklch(58% 0.14 145);   /* posted */
  --warn:       oklch(72% 0.16 75);    /* pending */
  --danger:     oklch(55% 0.20 25);    /* reversal, error */
  --gold:       oklch(78% 0.13 85);    /* metal accent */

  /* type */
  --font-ui:    "Inter", system-ui, sans-serif;
  --font-mono:  "JetBrains Mono", ui-monospace, monospace;  /* amounts, weights, bill numbers */

  /* rhythm */
  --row-h:      32px;   /* dense table rows */
  --input-h:    32px;
  --radius:     6px;
}
```

## Layout

- Persistent left rail: Sale, Purchase, Stock, Ledgers, Parties, Reports, Backup.
- Top bar: company name, date, `F1` help, connection/backup status dot.
- Main pane: one feature at a time. No nested modals.

## Sale screen (the one that matters)

- Focus starts in party field. `Tab` → item scan/search. `Enter` → add row.
- Item rows show: item, wt(g), purity, rate, making, amount. All editable inline.
- Right rail: subtotal, GST, old-gold credit, round-off, net. Payment split below.
- `F9` = post + print. `Esc` = cancel with confirm.

## Numeric display

- Amounts: mono font, right-aligned, `₹1,23,456.78` (Indian grouping).
- Weights: mono, right-aligned, `12.345 g` (3 dp).
- Ledger dr/cr in two columns, never signed numbers.

## What we avoid

- Cards with big padding on operational screens
- Emoji, illustrations, marketing copy
- Toast spam — one line status bar bottom-left instead
- Dark mode in v1 (shop counters are lit; skip)
- Animations longer than 120ms
