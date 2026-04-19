# Design System Foundation

**Date:** 2026-04-19
**Status:** Approved
**Scope:** `apps/ui/src/`

---

## Goal

Extract duplicated visual patterns from the existing frontend into a shared token file and a small set of presentational components, then immediately refactor every existing page to use them. The aesthetic direction is the richer Wiki design language (deep space background, Fraunces + JetBrains Mono, aurora accent palette) pulled forward across the whole site.

No layout changes. No behaviour changes. No new pages. Pure consistency pass.

---

## Approach

**Option A — Token file + component library**

- A single `lib/design-tokens.ts` exports the full `T` constant
- Shared components live in `components/ds/`
- Tailwind stays for layout utilities only (`flex`, `grid`, `hidden`, `overflow`, responsive prefixes)
- All colour, typography, and border decisions flow through `T` and `ds/` components

---

## Token Layer

**File:** `apps/ui/src/lib/design-tokens.ts`

Replaces:

- The `TOKEN` constant in `WikiLandingPage.tsx`
- The `T` constant in `WikiArticlePage.tsx`
- All hardcoded hex values and `rgba()` strings scattered across other components

### Colour tokens

```ts
T.bg.void = "#030511" // page root background
T.bg.space = "#050816" // header blur base
T.bg.deep = "#070b1e" // card/panel interior
T.bg.surface = "#060b19" // elevated card (collapses #060b19 and #0c1228)

T.ink.base = "#f4f7ff"
T.ink.dim = "rgba(244,247,255,.72)"
T.ink.low = "rgba(244,247,255,.48)"
T.ink.faint = "rgba(244,247,255,.30)"
T.ink.ghost = "rgba(244,247,255,.14)"

T.border.line = "rgba(255,255,255,.08)"
T.border.hi = "rgba(255,255,255,.16)"

T.accent.aurora = "#7fdfff"
T.accent.violet = "#a390ff"
T.accent.ember = "#ffb88a"
T.accent.gold = "#e8c98a"
T.accent.ok = "#8ef0b3"
T.accent.warn = "#ffcf7a"
T.accent.danger = "#ff8a8a"
```

### Typography tokens

```ts
T.font.serif = "var(--font-fraunces), serif"
T.font.mono = "var(--font-jetbrains-mono), ui-monospace, monospace"
T.font.sans = "var(--font-roboto), system-ui, sans-serif"
```

### Named string exports

```ts
GRAIN_SVG // SVG fractal noise data URI for film grain overlay
AURORA_BG // Radial gradient string for aurora background field
```

---

## Component Inventory

**Directory:** `apps/ui/src/components/ds/`

All components are purely presentational. They accept content as props, perform no data fetching, and have no opinion about routing or locale.

### 1. `PageShell`

**Props:** `children`, optional `className`

The deep space page wrapper. Renders:

- Root `div` with `T.bg.void` background and `T.font.sans`
- Fixed radial-gradient aurora field (`AURORA_BG`)
- Fixed film-grain overlay (`GRAIN_SVG`, opacity 0.35, screen blend)
- Content `div` at `z-index: 2`

**Replaces:** Copy-pasted background setup in `WikiLandingPage` and `WikiArticlePage`. Applied to all pages except Homepage (which has a globe backdrop that owns its own background).

---

### 2. `Eyebrow`

**Props:** `children`, optional `index` (number → renders `§ 0n ·` prefix), optional `bar` (boolean → prepends a 40px horizontal rule)

Renders a single line of monospace uppercase text at 10px, `T.ink.faint`, tracking 0.22em.

**Fixes:** Six implementations with drifting opacity (`/30` vs `/35`) and inconsistent bar decoration.

---

### 3. `SectionHeader`

**Props:** `children` (main text), optional `italic` (trailing italic phrase), optional `as` (`h1`|`h2`|`h3`, default `h2`)

Renders a Fraunces serif heading. If `italic` is provided it appends `<em>` with `T.ink.low` colour. Uses `clamp()` for responsive sizing.

**Fixes:** Each page implements its own `<em>` with different opacities and inconsistent font-weight.

---

### 4. `Card`

**Props:** `children`, optional `as` (`div`|`a`|`article`, default `div`), optional `hover` (boolean — adds border brightening on hover), optional `style` passthrough

Renders a panel with `T.bg.surface`, `T.border.line` border, 16px border-radius.

**Fixes:** Competing `#060b19` vs `#0c1228` panel backgrounds across Homepage, Blog, Library, Continent, Wiki.

---

### 5. `Badge`

**Props:** `label`, `color` (one of `aurora`|`violet`|`ember`|`gold`|`ok`|`warn`|`danger`|`dim`), optional `dot` (boolean — prepends coloured dot), optional `size` (`sm`|`md`, default `sm`)

Renders a pill tag with matching border, background tint, and text colour derived from the colour name via `T.accent`.

**Fixes:** Wiki builds badges with inline TOKEN objects; Blog builds the same visual with raw Tailwind classes. Category tags in BlogArticleCard and domain tags in WikiLandingPage become this component.

---

### 6. `Breadcrumb`

**Props:** `items: { label: string; href?: string }[]`

Renders a `/`-separated mono uppercase trail. Active (last) item is `T.ink.base`; ancestors are `T.ink.low` with hover to `T.ink.base`. Separator is `T.ink.ghost`.

**Fixes:** Blog uses `›` with Tailwind at `text-[10px]`; Wiki uses `/` with inline styles at `text-[10.5px]`. Unified at `10.5px`.

---

### 7. `StatBlock`

**Props:** `value` (string | number), `label` (string), optional `size` (`sm`|`lg`, default `lg`)

Renders a Fraunces number (`font-weight: 400`, `T.ink.base`) above a mono uppercase label (`T.ink.low`).

**Fixes:** Homepage uses `font-light` Fraunces; Continent uses `font-bold` default font. Both become `StatBlock`.

---

### 8. `Avatar`

**Props:** `initials` (1–2 chars), optional `index` (number — cycles gradient palette), optional `size` (`sm`|`md`|`lg`, default `md`), optional `title`

Renders a circular div with a gradient background (`T.accent.aurora → T.accent.violet`, cycling through ember/gold variants by index), dark initials text in Fraunces.

**Fixes:** Wiki uses a gradient inline approach; Blog uses a flat `bg-white/10` Tailwind approach. Both become `Avatar`.

---

### 9. `EmptyState`

**Props:** `message` (string)

Renders `py-16 text-center` with the message at `T.ink.faint`, mono font, `13px`.

**Fixes:** Identical JSX duplicated verbatim in `WikiArticleList` and `BlogArticleList`.

---

### 10. `MetaRow`

**Props:** `items: string[]`, optional `separator` (default `·`)

Renders a single line of mono items joined by the separator at `10.5px`, `T.ink.low`.

**Fixes:** Blog and Wiki each build their own inline metadata lines (read time, date, author) with slight structural differences.

---

### 11. `Pager`

**Props:** `prev?: { label: string; href: string }`, `next?: { label: string; href: string }`

Renders a two-column grid of prev/next cards (`Card` internally). Prev aligns left, Next aligns right. Either slot is omitted if prop is absent.

**Fixes:** A TODO stub in `WikiArticlePage`; a different ad-hoc implementation in `BlogArticlePage`.

---

## Refactor Phases

All phases: no layout changes, no behaviour changes, no data-prop changes.

| Phase | Targets                                                                     | Key changes                                                                             |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1     | `WikiLandingPage`, `WikiArticlePage`                                        | Replace local TOKEN/T with shared `T`; swap raw JSX for ds/ components                  |
| 2     | `BlogLandingPage`, `BlogArticlePage`, `BlogArticleCard`, `BlogArticleList`  | `PageShell`, `Badge`, `Breadcrumb`, `Avatar`, `MetaRow`, `EmptyState`, `Pager`          |
| 3     | `LibraryHomePage`, `LibraryHero`, `LibraryTabs`                             | `PageShell`, `Card`, `Badge`, `StatBlock`, `Eyebrow`                                    |
| 4     | `ContinentDetailPage`, `ContinentTile`                                      | `Card`, `StatBlock`, `Eyebrow`, `SectionHeader`, `EmptyState`                           |
| 5     | `HomepageHero`, `HomepageSections`, `FeaturedLibraryCards`, `ContributeCTA` | `Eyebrow`, `SectionHeader`, `Card`, `StatBlock` (homepage bg untouched — globe owns it) |
| 6     | `GlobalHeader`, `GlobalFooter`                                              | Replace hardcoded colour values with `T`                                                |

---

## Constraints

- Tailwind stays for: `flex`, `grid`, `hidden`, `overflow`, `sticky`, `absolute`, responsive prefixes, `transition`, `duration`
- Tailwind removed from: colours, font families, font sizes, letter spacing, border colours, background colours
- No new pages introduced
- No changes to data-fetching, routing, or Strapi API layer
- `WikiProgressBar` client component already extracted — no change needed

---

## Files Created

```
apps/ui/src/lib/design-tokens.ts
apps/ui/src/components/ds/index.ts        (barrel export)
apps/ui/src/components/ds/PageShell.tsx
apps/ui/src/components/ds/Eyebrow.tsx
apps/ui/src/components/ds/SectionHeader.tsx
apps/ui/src/components/ds/Card.tsx
apps/ui/src/components/ds/Badge.tsx
apps/ui/src/components/ds/Breadcrumb.tsx
apps/ui/src/components/ds/StatBlock.tsx
apps/ui/src/components/ds/Avatar.tsx
apps/ui/src/components/ds/EmptyState.tsx
apps/ui/src/components/ds/MetaRow.tsx
apps/ui/src/components/ds/Pager.tsx
```

## Files Modified

```
apps/ui/src/components/wiki/WikiLandingPage.tsx
apps/ui/src/components/wiki/WikiArticlePage.tsx
apps/ui/src/components/wiki/WikiArticleList.tsx
apps/ui/src/components/blog/BlogLandingPage.tsx
apps/ui/src/components/blog/BlogArticlePage.tsx
apps/ui/src/components/blog/BlogArticleCard.tsx
apps/ui/src/components/blog/BlogArticleList.tsx
apps/ui/src/components/home/LibraryHomePage.tsx
apps/ui/src/components/library/LibraryHero.tsx
apps/ui/src/components/library/LibraryTabs.tsx
apps/ui/src/components/continent/ContinentDetailPage.tsx
apps/ui/src/components/home/ContinentTile.tsx
apps/ui/src/components/home/HomepageSections.tsx
apps/ui/src/components/home/FeaturedLibraryCards.tsx
apps/ui/src/components/home/ContributeCTA.tsx
apps/ui/src/components/home/HomepageHero.tsx
apps/ui/src/components/global/GlobalHeader.tsx
apps/ui/src/components/global/GlobalFooter.tsx
```
