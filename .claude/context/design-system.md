## Design System

All design decisions flow from `lib/design-tokens.ts` (`T`). **Never hardcode colors or fonts** that exist in the token system.

### Color tokens (`T`) — v2 light system (light-only, no dark mode)

```ts
T.bg.void // #FAF8F4 — page root (warm paper)
T.bg.space // #F1EDE5 — deeper band: footer, cover strips
T.bg.deep // #FFFFFF — card / panel surface
T.bg.surface // #FBFAF7 — nested surface: row hover, inputs
T.bg.muted // #F3F0EA — muted fills: disabled, neutral chips
T.bg.muted2 // #EFEBE3 — nav hover, segmented-control track

T.ink.base // #17162B — primary text
T.ink.dim // #55536A — secondary text
T.ink.low / faint / ghost // alpha ramp of ink for tertiary states

T.border.line // #E7E3DB — standard border (borders carry elevation; no shadows)
T.border.hi // #D9D3C9 — prominent border
T.border.divider // #F0ECE5 — hairline dividers

T.accent.primary // #4338CA — indigo: CTAs, links, focus, active states
T.accent.primaryHover // #3730A3
T.accent.chip // #ECEBFB — active filter chips
T.accent.ok // #2F5D3A — success/open (on #E6EFE6)
T.accent.danger // #A13A1A — errors (on #F6E3DA)
```

Library-type tint pairs live in `TYPE_TINT` / `tintForLibraryType()` (same file): national purple `#ECE8F6/#4A3F8C`, public green `#E6EFE6/#2F5D3A`, academic blue `#E4ECF5/#28496E`, special rust `#F6E3DA/#8A3F22`, neutral `#F3F0EA/#55536A` — used for badges, card monograms, and stat cards.

### Typography (`T.font`)

| Token          | Font           | Use                                                  |
| -------------- | -------------- | ---------------------------------------------------- |
| `T.font.serif` | Newsreader     | Display headings, card titles, large stat numerals   |
| `T.font.mono`  | JetBrains Mono | Coordinates and technical data ONLY (used sparingly) |
| `T.font.sans`  | Figtree        | Body copy, UI chrome, labels, buttons (site default) |

**Rules:** Serif for display + big data values. Mono is restricted to coordinates/technical strings — the old mono-uppercase eyebrow pattern is retired except for sparing true-metadata use. Pill radii (999px) for buttons/badges, 20–24px for cards, 14px for inputs. The only sanctioned shadow is the card hover: `0 12px 28px rgba(23,22,43,.08)`.

### Accessibility baseline (non-negotiable)

- Global `:focus-visible` — 3px `#4338CA` outline (in globals.css; never suppress)
- Skip-to-content link in the root layout; `#main` landmark
- `prefers-reduced-motion` kill-switch is global
- Status is always conveyed as color + icon + text (never color alone)
- Filters use `fieldset`/`legend`; hours use semantic `<table>` with `th scope="row"`; counts update via `aria-live`
- Honest empty states over fake data ("Hours not added yet", "No photo yet" monograms)

### Design System components (`components/ds/`)

All shared UI primitives live here. Always check `ds/index.ts` before building a new component.

| Component               | Purpose                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Eyebrow`               | Section label with optional index number and extending bar rule                                                                                                                                   |
| `SectionHeader`         | Section heading with italic serif suffix (`italic` prop)                                                                                                                                          |
| `PageHero`              | The only hero band for primary pages — breadcrumb, eyebrow pill, serif title, lead, slot; `chips` (a pills row under the breadcrumb) and `meta` (a meta line under the title) for the staff shell |
| `SearchField`           | Site-wide search pill (magnifier, sr-only label, clear button) — use in hero slots                                                                                                                |
| `EditorialSection`      | Two-column image + rich-text editorial block from CMS                                                                                                                                             |
| `CtaBannerSection`      | Full-width CTA banner with radial gradient and aurora CTA link                                                                                                                                    |
| `LocationGridBrowser`   | Bordered grid of location cards — rank prefix, serif name, subtitle, hover arrow                                                                                                                  |
| `LocationContributeCTA` | Contribute / correction prompt banner                                                                                                                                                             |
| `Breadcrumb`            | Location breadcrumb trail                                                                                                                                                                         |
| `Card`                  | General-purpose content card                                                                                                                                                                      |
| `Badge`                 | Status/type badge                                                                                                                                                                                 |
| `StatBlock`             | Stat display block                                                                                                                                                                                |
| `StatCard`              | Tinted stat tile (icon, serif numeral, label): profile tabs, My submissions                                                                                                                       |
| `ChoiceCard`            | Radio option as a card (tinted icon, title, hint): role, affiliation, visibility choices                                                                                                          |
| `Notice`                | Tinted notice with icon and title (`ok`, `info`, `warn`); status never colour alone                                                                                                               |
| `DismissiblePrompt`     | Prompt a reader can hide (`PromptDismissButton`): per session, or in Settings                                                                                                                     |
| `MetaRow`               | Key-value metadata row                                                                                                                                                                            |
| `EmptyState`            | Empty/not-found state                                                                                                                                                                             |
| `Pager`                 | Pagination control                                                                                                                                                                                |
| `Switch`                | `role="switch"` toggle, 44 px target: settings, live sharing, who can go live                                                                                                                     |
| `SegmentedControl`      | Radio group on the `T.bg.muted2` track: Yes / No / Not sure, Owner / Editor, 7/30/90 days                                                                                                         |
| `StatusBadge`           | Tone (`ok`, `info`, `warn`, `danger`, `neutral`) + icon + text; optional pulse with a reduced-motion fallback: live states, health, feeds                                                         |
| `Sheet`                 | Side or bottom sheet with focus trap, Escape and inert background: publish confirm, stop drawer, console sheets, paste dialog                                                                     |
| `HealthList`            | Record health rows: status dot, label, sub-line, optional outlined action                                                                                                                         |
| `PlanGatePanel`         | Locked Team or Pro tab: plan pill, serif title, checklist, "stay free" line, two CTAs, sample preview, optional "Coming soon"                                                                     |
| `PlanChip`              | "Team plan" (indigo) or "Staff access · free" (neutral) in the staff band                                                                                                                         |
| `KpiTile`               | Traffic tile: label, serif value, change with arrow and text, never colour alone                                                                                                                  |
| `BarSeries`             | Simple bars with a "Show as a table" toggle that renders a real `<table>`                                                                                                                         |
| `LibrarySwitcher`       | "Your libraries (n)" select with a type icon, in the staff band and drawer                                                                                                                        |
| `PublishBar`            | Sticky "{n} unpublished changes · Discard · Publish" bar with an `aria-live` count: staff edit, timetable                                                                                         |
| `DiffCard`              | Field, Now (rust, struck) and Suggested (green), source and actions: suggestions, timetable review                                                                                                |
| `QrCode`                | Server-rendered SVG QR code (`qrcode`): the Go live tab's console link                                                                                                                            |

### Primary CTA pattern

Primary CTAs are indigo pills: `bg-(--t-accent-primary) hover:bg-(--t-accent-primary-hover) text-white rounded-full font-semibold`. Secondary actions are white pills with a `--t-border-hi` border. The old aurora-cyan CTA constants in `lib/styles.ts` are deprecated — do not use them in new code.

### Inline styles vs Tailwind

- **Use inline styles** (via `style={{}}`) for design-token values — colours, fonts, letter-spacing, specific pixel measurements
- **Use Tailwind** for layout, spacing scales, responsive breakpoints, and hover/group state that needs pseudo-classes
- This is intentional — it keeps token values inspectable and prevents Tailwind's purger from stripping dynamic values

### Header pattern

v2 pages use normal in-flow light heroes — the header renders solid from the start. The legacy `data-transparent-header` + `-mt-14` scroll-reveal pattern is retired for v2 pages (the CSS machinery still exists in globals.css for any stragglers). **Never add `overflow-x-hidden` or `overflow: hidden` to the page wrapper or `<main>`** — it breaks `position: sticky`.

### Section hero pattern (PageHero)

Every primary page — Find libraries (`/libraries`), Journal, Events, Knowledge, Contribute — and their search/sub pages open with `PageHero` from `components/ds`. Tinted `T.bg.space` band with a hairline rule; breadcrumb, then an eyebrow pill (Iconify icon + label + optional indigo accent) and a serif `title` on the left (`*italic*` markup renders indigo italic via `parseHeroText`); `lead` plus the children slot on the right. Put the section's primary control in the slot: a `SearchField` first, then any status line. Use `compact` for task/search pages. Never hand-roll a hero h1/band; if a page needs something `PageHero` can't do, add a prop to it. The page wrapper is a plain `T.bg.void` div (`relative isolate flex min-h-screen w-full flex-col`).

### Page shell pattern (v2)

Detail pages follow the POC single-flow layout: breadcrumb → in-flow hero (badges, serif clamp title, action pills) → sticky anchor nav → main column + sticky sidebar, all on `T.bg.void` paper with white section cards. See `components/library/LibraryDetailPage.tsx` for the canonical implementation.

---
