# Identity — deep dive

> What makes an app feel "designed" vs. "generic", and where Jewelzz sits today.
> Distilled from Wispr Flow, Linear, Raycast, Arc, Superhuman.

## The pattern behind apps with real identity

Every app that "has presence" does at least four of these:

1. **A single obsessive signature element** — not a logo, an interaction or motif that appears at every emotional moment.
   - Wispr Flow: the dotted-elliptical waveform and rotating text rings around headlines. ([design analysis](https://design.withfudge.com/share/wisprflow.ai-design))
   - Arc: the coloured ring around the window that changes with Spaces. ([Arc rewrite](https://opendesigner.io/design-systems/arc))
   - Raycast: the "pressed key" inner-shadow on every interactive card. ([Raycast rebuild](https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8))
   - Linear: aggressive negative letter-spacing at display sizes + Inter Variable with `cv01`/`ss03` features → a font nobody else uses even though the source is public. ([Linear design system as constraints](https://identityforge.io/learn/linear-design-system))

2. **A prohibition list** — the identity lives in what the app *refuses to do*.
   - Linear: no bold, no shadows, no second accent. Copying Linear's hex codes without the prohibitions captures the least distinctive part. ([logrocket teardown](https://blog.logrocket.com/ux-design/linear-design/))
   - Wispr Flow: no pure black, no saturation-based accent, no sharp corners.

3. **A physical / tactile metaphor** the whole product hangs off.
   - Wispr: "editorial publication reimagined for software" — Garamond serif at display + generous 40px card radii.
   - Raycast: "dark power-tool cockpit" — near-black #040506 canvas, hairline borders, pressed keys.
   - Arc: "workspace" — Spaces, coloured rings, sidebar-is-tab-bar.
   - Superhuman: "cockpit" — dense keyboard-first email.

4. **Opinionated typography, never a default**.
   - Wispr: EB Garamond (display) + Figtree (utility).
   - Linear: Inter Variable but with `cv01`, `ss03`, and a custom `510` weight between regular and medium.
   - Nobody who cares uses Inter/Roboto with default settings.

Extra credit:
- 5. Sound as identity (Wispr's activation chime, macOS system sounds)
- 6. An empty state with personality — never "no results"
- 7. A hero interaction (Wispr's hotkey overlay, Raycast's ⌘K, Arc's Space switching)
- 8. A voice — button labels, tooltips, loading text have character

## Where Jewelzz is right now — honest audit

**What we've done well:**
- Signature element candidate — the **J-scale mark with the gold gem** exists in the logo, favicon, invoice PDF, and nav icons.
- Editorial serif accent — **Fraunces italic** on screen titles, tab labels, and TOTAL. Matches Wispr's approach.
- Palette has a mood — parchment + burnished gold + ink evokes a real ledger book.
- Metaphor exists on paper — "ledger-modern" is written down in `design.md`.
- Custom nav icons — the through-line motif (hairline + gold-dot accent) is in place.

**What still reads generic:**

| Signal | Why it feels off |
|---|---|
| Body font is **Inter**, out of the box | The safest choice on the internet. Every landing page since 2020 uses it. Zero personality unless tuned. |
| **Rounded-4px cards** on a paper-textureless off-white surface | The Vercel/shadcn look. Cards feel like a marketing site, not a ledger. |
| The gold gem **doesn't animate at moments users care about** | We have it as a static element but it never *does* anything. A signature should show up at the emotional beat, not just decorate. |
| **No hero interaction** — there is no ⌘K, no Bell, no thing to demo | When someone shows the app to a friend, there is nothing to show off in 3 seconds. |
| **No prohibition list** — we happily use shadows, second accents, gradients when convenient | Identity erodes across features because there's no "you can't do that" rule enforced. |
| **Copywriting is functional** — "Post & print", "Backup now", "no items yet" | Every SaaS says these exact words. No voice. |
| **Loading text is "loading…"** | Every SaaS. |
| **Empty states = mono uppercase "NO ITEMS"** | Correct information, wrong emotional tone for a jewellery ledger. |
| **Motion is subtle but not distinctive** — the flash-gold + gem pulse are good but they could belong to any app | No motion signature that only makes sense for us. |
| **The topbar is search + title + date** | The standard dashboard chrome. Not memorable. |
| **Physical/tactile texture is absent** — the "paper" is a flat colour, not paper | We claim ledger-modern but the surface doesn't act like paper. |

## Concrete moves — pick what to ship

Ordered by impact-per-hour. Copy in-line as `identity.md#N` in commits.

### 1. The Weighing (signature moment) — **the highest ROI single move**

When a sale is posted, instead of the current `.flash-gold` on the totals card:

- The bill number scale-fades in
- A miniature version of the J-scale mark renders in place under the total
- The scale beam tilts left → right → left → settles (weighing motion, ~600ms)
- The gold gem drops from above the pan with a slight bounce
- 900ms total, muted by `prefers-reduced-motion`

This is our waveform. It's not a decoration; it happens at the exact moment the shop owner cares most, 50× a day. Nobody else's app does this because nobody else's app is for jewellers.

Effort: ~1 hour of SVG animation + wire-up.

### 2. The Bell — hero interaction (⌘Space)

A floating panel invoked from anywhere. Shows:
- Today's live gold + silver rates (from Settings)
- Open karigar work-in-progress count
- Today's bill count + total ₹
- A search box that jumps straight to the right screen with keyboard navigation

Positioned like Raycast: overlay, keyboard-first, escape closes. Never blocks the sale screen — the counter operator can invoke it mid-sale, glance, dismiss.

This is what a demo shows off in 3 seconds.

Effort: ~2 hours. Reuses existing `search` + `ratesList` + `karigarBalances` IPCs.

### 3. Prohibition list — `rules.md#identity`

Write these down and stick to them:

- **No box shadows.** Ever. Depth is hairline borders + surface colour shifts.
- **No second accent colour.** Gold is the only saturated colour. Semantic red/green/amber for status only.
- **No gradients.** Flat surfaces + hairlines. (One exception: the ledger paper texture below.)
- **Border radius ceiling: 6px.** Nothing rounder.
- **No emoji.** Ever.
- **No default button labels.** "Post & print" becomes "Weigh & print". "Backup now" becomes "Seal the day". Voice matters.
- **Fraunces italic for every section label and screen title.** Never sans-serif for these.
- **Numbers are always mono, always tabular, always right-aligned in tables.**
- **The gold gem must appear at every emotional moment.** Post success, backup success, first-launch, day-close.

Effort: 15 min to write. Compounds forever.

### 4. Copywriting pass — voice everywhere

Concrete swaps:

| Now | Proposed |
|---|---|
| Post & print | Weigh & print |
| Backup now | Seal the day |
| Backup 3h ago | Sealed 3h ago |
| Sign out | Close the counter |
| No parties | No customers on the ledger yet |
| No items | Nothing in the case yet |
| Loading… | Opening the ledger… |
| Saved to backups/... | Ledger sealed. Copy stored in… |
| posted INV-0148 · total ₹76,323 | Bill INV-0148 · ₹76,323 · weighed. |
| IPC ok | Counter online |

Effort: 30 min. Free personality. Best copy-and-paste-proof-of-identity you can do.

### 5. Paper texture on parchment surfaces

Very subtle noise/grain overlay on the `--paper-2` and `--paper-3` panels. Rendered as a CSS SVG data-URI so it's zero bytes and ships in the bundle. Not so heavy it looks vintage — just enough that hovering feels like *touching paper*.

Effort: 20 min. One CSS `background-image` on `.card`.

### 6. Custom empty state illustrations

Three small hand-drawn ink SVGs — a scale, a small stack of bills, a folded receipt — that appear on the corresponding empty screens (stock / sales / catalog). Not full illustrations; line drawings that echo the mark.

Effort: ~1 hour for the three SVGs.

### 7. Type tuning — Inter with the Linear treatment

Keep Inter (good readability decision, keep it), but add:

```css
body {
  font-family: 'Inter';
  font-feature-settings: 'cv11', 'ss01', 'ss03', 'cv05';
  font-variation-settings: 'opsz' 14;
  /* At display sizes: negative tracking */
}
.screen-title {
  letter-spacing: -0.025em;  /* Linear's move */
}
```

Free distinctiveness — same source font, different personality. Effort: 5 min.

### 8. Sound (deferred — do only if a client asks)

Optional off-by-default in Settings. A single soft brass-bell chime on sale post, 180ms, ends quickly. Real jewellers will love it. Some will hate it. Toggle in Settings.

Effort: 30 min if we do it. Skip until asked.

## What I'd ship first

If I could pick two:

1. **Identity move #1 (The Weighing)** — biggest emotional payoff, happens 50×/day
2. **Copywriting pass (#4)** — free personality, best identity-per-hour

Then #3 (prohibition list — protects everything else) and #5 (paper texture).

The Bell (#2) is a beautiful stretch move but it's genuinely a phase of its own — sketch it as its own PR.

## References

- [Wispr Flow design system](https://design.withfudge.com/share/wisprflow.ai-design) — EB Garamond + Figtree, warm cream + teal, dotted-ellipse waveform, editorial positioning.
- [Linear design system as constraints](https://identityforge.io/learn/linear-design-system) — "identity is in the prohibitions".
- [Raycast native-feel skill (75-item ship audit)](https://github.com/yetone/native-feel-skill) — eight tenets, common failures.
- [Raycast design tokens](https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8) — dark cockpit, hairline borders, pressed-key shadows.
- [Arc rewrite of the browser as a workspace](https://opendesigner.io/design-systems/arc) — Spaces with coloured rings, frosted glass, single gradient.
- [Wispr Flow product review](https://efficient.app/apps/wispr-flow) — how the design language reads to end users.
- [Linear teardown](https://blog.logrocket.com/ux-design/linear-design/) — the design "trend" of restrained typography + achromatic palettes.
