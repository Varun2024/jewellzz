# Jewelzz — Design System (v2, from scratch)

> Purpose: one document that governs every pixel, keystroke, and printed line in the app. If it isn't here, we don't build it.
>
> Replaces: the collage in `design.md` + the identity flourishes in `identity.md`. Both are archived, not extended.

---

## 0. The signature idea

**A shop-counter tool that respects the operator's speed and the owner's book.**

Two moods, one app, one accent colour, one signature gesture.

- **Counter mood** — sale, purchase, karigar issue/receipt, refining. Dense, keyboard-driven, almost brutalist. Looks like a terminal that grew up. The operator is entering 40+ rows/day and must never wait for an animation.
- **Book mood** — ledgers, GST reports, home, settings. Calmer, wider reading column, more air. This is where the owner sits with tea and reviews the day.

The mood is a *class on `<body>`* (`.mood-counter` / `.mood-book`) that swaps three tokens: row height, container padding, and text scale. Nothing else changes.

**The one signature gesture: the column rule.** A 2px accent bar on the left edge of the currently focused/selected row, tab, nav item, and input. Hairline (0.5px, `--border`) at rest, thickens and turns `--accent` when active. Same idea everywhere — table row, sidebar link, form field, invoice line item. This is the *only* identity element that carries across screens and print. Everything else is quiet.

---

## 1. Token architecture

Three layers. **Components only read semantic + component tokens. Never raw.**

```
raw (palette scale)   →   semantic (role)   →   component (specialised)
--gold-500                --accent               --btn-primary-bg
--ink-900                 --text                 --input-fg
--paper-50                --bg                   --row-bg-hover
```

Renaming a raw value must never touch a component file. If it does, we added a token in the wrong layer.

### 1.1 Raw palette

Small on purpose. Two ramps, one accent.

| Token | Value | Notes |
|---|---|---|
| `--paper-50` | `#FAF7F1` | lightest surface |
| `--paper-100` | `#F4EFE4` | app background (light theme) |
| `--paper-200` | `#EAE2D0` | hairline on paper |
| `--ink-100` | `#E5E1DA` | faint text on ink theme |
| `--ink-400` | `#8A8579` | muted text |
| `--ink-600` | `#3A362F` | hairline on ink |
| `--ink-900` | `#141210` | primary text |
| `--gold-300` | `#E4C878` | accent hover / focus glow |
| `--gold-500` | `#B8892E` | THE accent — one colour, no siblings |
| `--gold-700` | `#8A6420` | pressed accent |
| `--pos-500` | `#2F7A4B` | credit / positive delta (used sparingly, numbers only) |
| `--neg-500` | `#B23A2A` | debit / error (used sparingly) |

No forest green. No secondary accent. If a screen needs another colour, the screen is wrong.

### 1.2 Semantic (the layer components use)

```
--bg               app background
--surface          panels, cards, modals
--surface-hi       hovered row, active tab, selected item
--border           1px hairlines — the only line weight in the app
--border-strong    focus rings, table outer borders
--text             primary text
--text-mute        labels, secondary
--text-faint       placeholders, disabled
--accent           the one warm colour
--accent-hover
--accent-press
--accent-fg        text on accent
--pos --neg        signed numbers only
--focus-ring       2px accent at 40% opacity
```

That is the entire semantic layer. Twelve-plus-three tokens. If a component needs a value that isn't here, we add it as a **component token**, not a new semantic one.

### 1.3 Themes

Light (default): semantics resolve to paper + ink.
Dark (later): same semantic names, resolve to ink + paper-100. Component CSS never changes.

---

## 2. Typography

**One sans. One mono. No display face.**

- Sans: **Inter** (variable). Body, headings, labels, buttons, everything textual.
- Mono: **JetBrains Mono** (variable). Every number, every code, every ID.

Delete Fraunces. Delete the italic small-caps. Hierarchy comes from *size, weight, colour* — never a second family.

### 2.1 Scale

| Token | Size / line-height | Use |
|---|---|---|
| `--t-xs` | 11 / 14 | uppercase micro-labels only |
| `--t-sm` | 12 / 16 | table headers, badges, kbd hints |
| `--t-base` | 13 / 18 | body, inputs, table cells |
| `--t-md` | 14 / 20 | screen subheadings |
| `--t-lg` | 16 / 22 | screen title |
| `--t-xl` | 20 / 26 | totals, home hero numbers |
| `--t-2xl` | 28 / 32 | INV total, KPI cards |

Weights: 400 body, 500 emphasis, 600 headings + buttons. No 700, no italics.

### 2.2 Numeric type — the hero

Every number renders through `<Num>` / `<Rupee>` / `<Weight>` components. Rules:

- Family: JetBrains Mono, `font-feature-settings: "tnum" 1, "zero" 1, "cv02" 1`.
- Right-aligned in tables, always.
- Grouping: Indian lakh — `1,23,45,678.90`.
- Rupee glyph `₹` in `--text-mute`, amount in `--text`.
- Weight: value in `--text`, unit (`g` / `mg` / `ct`) in `--text-mute` and `--t-sm`.
- Sign: `--pos` for credit, `--neg` for debit, `--text` for zero. Prefix with thin space, not `+`.

---

## 3. Spacing & density

4-based scale. `--s1`=4, `--s2`=8, `--s3`=12, `--s4`=16, `--s5`=20, `--s6`=24, `--s7`=32, `--s8`=40.

**Row height is the only variable between moods.**

| Token | Counter | Book |
|---|---|---|
| `--row-h` | 28 | 32 |
| `--input-h` | 28 | 32 |
| `--btn-h` | 28 | 32 |
| `--container-pad` | `--s4` | `--s6` |
| `--section-gap` | `--s5` | `--s7` |
| Body text | 13 | 14 |

Comfortable (36) is a Settings preference. Default counter = 28. This alone is a huge identity signal — most SaaS UIs feel bloated, ours won't.

---

## 4. Surface elevation

**Three surfaces. That is the ceiling.**

| Level | Token | Where |
|---|---|---|
| 0 | `--bg` | the page canvas |
| 1 | `--surface` | cards, sidebar, table wrapper |
| 2 | `--surface-hi` | hovered row, active nav, opened dropdown, dialog |

No shadows. Elevation is expressed by `--border` (level 1 gets a hairline; level 2 gets a hairline + slightly lifted bg). Modals get a `--focus-ring` outline and a scrim (`rgba(20,18,16,0.5)`), no shadow.

No paper texture. No watermark. No gradients. No radius above 6px. `--radius-1`=4, `--radius-2`=6. Buttons + inputs use `--radius-1`. Cards + modals use `--radius-2`.

---

## 5. Motion shelf

Three durations, two easings, four intents. Every animation picks from this shelf.

```
--motion-quick     100ms   focus rings, hover state
--motion-standard  180ms   route changes, dropdowns, tab swaps
--motion-emphasis  320ms   the one signature moment (bill posted)

--ease-out         cubic-bezier(0.2, 0, 0, 1)
--ease-in-out      cubic-bezier(0.4, 0, 0.2, 1)
```

Intents:
- `enter` → `--motion-standard --ease-out`, opacity+translateY(4px→0).
- `exit` → `--motion-quick --ease-in-out`, opacity only.
- `emphasize` → `--motion-emphasis --ease-out`, one shot, gold flash on the row/border.
- `settle` → `--motion-standard --ease-out`, spring-lite for the column rule slide.

**One signature moment reserved:** bill posted. Two things fire together — the TOTAL row column rule flashes `--accent` at `--motion-emphasis`, and the Weighing (J-scale SVG) overlays the right rail for ~1.4s. The Weighing stays — it's the one piece of v1 identity that earned its keep. Everything else in §10 still goes.

`prefers-reduced-motion` collapses all durations to 0 except `emphasize`, which becomes a static gold flash held 400ms.

---

## 6. The column rule (signature)

The one gesture that carries identity across every surface.

```css
.row {
  position: relative;
  padding-left: var(--s4);
}
.row::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: transparent;
  transition: background var(--motion-quick) var(--ease-out);
}
.row:hover::before   { background: var(--border-strong); }
.row[data-active]::before,
.row:focus-within::before { background: var(--accent); }
```

Applies to:
- Sidebar nav items
- Ledger table rows
- Tabs (as a bottom rule instead of left)
- Form fields (left rule inside the field on focus)
- Invoice line items in print (a 1pt gold bar in the left margin)

That's how print inherits identity without stealing screen tricks.

---

## 7. Component recipes

Every component lives in `src/components/ui/` and reads only semantic + its own component tokens.

### 7.1 `<Field>` (label + input + hint)

```
label   --t-sm --text-mute uppercase tracked 0.04em
input   --input-h --radius-1 border --border, bg --surface
        focus → border --accent + column-rule left, ring --focus-ring
hint    --t-xs --text-faint
error   --t-xs --neg
```

Numbers: input gets `text-align: right; font-family: mono; font-feature-settings: 'tnum'`.

### 7.2 `<Button>`

Three variants only. No ghost, no destructive-secondary, no icon-only-with-tooltip layer.

| Variant | Use | Bg | Border | Text |
|---|---|---|---|---|
| `primary` | the one action per screen | `--accent` | none | `--accent-fg` |
| `secondary` | everything else | `--surface` | `--border` | `--text` |
| `link` | inline actions in tables | transparent | none | `--accent` underline on hover |

All buttons `--btn-h`, `--radius-1`, `--t-base`, weight 500. Keyboard hint `<Kbd>` rendered inline on the right in `--t-sm --text-mute`.

### 7.3 `<Row>` (table row)

- Height `--row-h`. Bottom border `--border`.
- Column rule per §6.
- Hover `--surface-hi`. Selected also `--surface-hi` + accent column rule.
- Cell padding `0 --s3`. Numeric cells `text-align: right`.

### 7.4 `<Sheet>` (a panel)

Wraps every screen. Header (title + primary action) — hairline — body — hairline — footer (totals / meta). No shadow, no rounded outer corners on full-screen sheets, `--radius-2` on modals.

### 7.5 `<Kbd>`

`<span>` with `--t-sm`, mono, `--surface-hi` bg, `--border` 1px, `--radius-1`, padding `0 --s1`. Rendered next to every action. If an action lacks a shortcut, that's a design bug, not a Kbd bug.

### 7.6 `<Num>`, `<Rupee>`, `<Weight>`

The three number primitives. No screen formats numbers inline. If a screen needs a new format, extend a primitive.

### 7.7 Empty / Loading / Error

Every list has three designed states.

- **Empty** — illustrated (small line-art SVG at ~64px in `--border-strong`), a short line in `--text-mute`, and one action button. No emoji. No generic clipboard icon.
- **Loading** — a 1px `--accent` progress rule under the sheet header, indeterminate. No spinners in tables. No rotating phrases (delete `phrases.ts`).
- **Error** — the row/section gets `--neg` column rule, a one-line message with a `Retry` link. Never a red banner across the screen.

---

## 8. Keyboard as first-class

- Every action has a shortcut. Every shortcut is visible on the button (`<Kbd>`).
- `?` opens a full shortcut sheet grouped by area.
- `Ctrl+Space` = Bell (keep it, it's earning its keep).
- In tables: `↑↓` navigates rows, `Enter` opens, `n` new, `/` filter, `Esc` blur.
- In forms: `Enter` moves to next field, `Ctrl+Enter` submits, `Esc` cancels.

The command bar and shortcut sheet are the *only* two overlays in the app. Everything else is inline.

---

## 9. Print (invoice, labels, reports)

Print inherits the system, not a separate mood.

- Same Inter + JetBrains Mono. Same 4-based spacing.
- Colours: `--ink-900` text on white paper. `--gold-500` for the column rule and the total row hairline only.
- No forest header strip. No watermark. No page numbers as decoration (real page 1/2 numbering only, when needed).
- Invoice line items get the column rule in the left margin at 1pt.
- TOTAL row: a double `--gold-500` hairline above, `--t-xl` mono number, right aligned.
- Header: brand mark 20mm, company block left, invoice meta right. Hairline separator.
- Footer: signature block, terms in `--t-xs --text-mute`. That's it.

The identity in print = the column rule + mono numbers + one gold hairline above TOTAL. Same three elements as screen.

---

## 10. What we delete from v1

Before writing new CSS, remove:

- Fraunces font import + every `font-family: 'Fraunces'` and `.section-label` small-caps
- Paper texture SVG data-URIs on `.card` / `.statusbar`
- Ambient Weighing variant on Home (`weigh-scale-ambient`) — the one-shot post-success version stays
- Forest tokens (`--ink-forest*`) and every use (Bell backdrop, Login bg, invoice header)
- Watermark in `electron/print.ts`
- Page-number footer in Shell + invoice
- `.pin-bead*` classes and their use in LoginScreen
- `src/lib/phrases.ts` and `LoadingBlock`'s rotating phrase logic — one static hairline progress bar replaces it
- Custom gold scrollbar CSS — use platform default
- Focus pulse animation — replace with static `--focus-ring`
- Right-rail gold hairline in Shell — replaced by the column rule on nav
- Every ad-hoc `text-[13px] text-[var(--ink-700)]` inline utility — replaced by `--text-mute` on a `<Label>` primitive

Net loss: ~600 lines of CSS, ~4 components, 2 fonts, 3 animations. Net gain: the app has an actual system.

---

## 11. Migration order

1. Land this doc. Get sign-off on the palette + type + row-height numbers before touching code.
2. Write `src/styles/tokens.css` (raw + semantic). Land alongside old CSS, unused.
3. Build the eight primitives in `src/components/ui/`: `Sheet`, `Row`, `Field`, `Button`, `Kbd`, `Num`, `Rupee`, `Weight`. Ship with Storybook-lite page under `/dev/ui`.
4. Migrate one screen end-to-end (Sale) to prove the primitives. Nothing else changes.
5. Migrate remaining screens in this order: Purchase → Ledgers → GST → Home → Settings → Auth → Dev.
6. Delete everything in §10 in one commit at the end. No half-state.
7. Rework `electron/print.ts` last, using the same tokens via a shared `printTokens.ts` map.

Each screen migration = one PR. No mixed-state screens in main.

---

## 12. What we skipped and when to add it

- **Dark theme** — token layer supports it; ship after all screens migrate.
- **Density preference in Settings** — trivial once `--row-h` is a token; add when someone asks.
- **Illustrated empty states** — one line-art SVG per surface; ship after core migration.
- **Command palette (beyond Bell)** — Bell is enough for MVP; expand to full palette when actions > 40.
- **Print label templates beyond A4** — add when a shop asks.

Everything else in v1 identity work: not coming back.
