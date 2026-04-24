# DRY UI Refactor — Design Spec

**Date:** 2026-04-24
**Scope:** Extract repeated UI patterns from continent/country/region detail pages into shared `ds/` components.

---

## Problem

Three location detail pages (`ContinentDetailPage`, `CountryDetailPage`, `RegionDetailPage`) each contain private copies of identical or near-identical component functions. Any visual change to these patterns must be applied three times, and the copies have already begun to diverge.

---

## Patterns to Extract

### 1. `HeroStat` + `HeroStatsGrid` + `HeroInlineTabNav` → `ds/HeroStat.tsx`

**`HeroStat`** — the individual stat cell (label + large serif value + optional note). Identical across all three pages.

```tsx
<HeroStat label="Libraries" value={1240} note="Open to the public" />
```

**`HeroStatsGrid`** — the glassmorphic 2-column grid that wraps `HeroStat` cells. Accepts children and a `cols` prop (default 2).

```tsx
<HeroStatsGrid>
  <HeroStat label="Libraries" value={1240} />
  <HeroStat label="Regions" value={12} />
</HeroStatsGrid>
```

**`HeroInlineTabNav`** — the inline anchor-link tab nav that sits below the stats grid in all three heroes. First tab is aurora-tinted; subsequent tabs are dimmed with hover-to-white.

```tsx
<HeroInlineTabNav tabs={[{ id: "overview", label: "Overview" }, ...]} />
```

All three exported from `ds/HeroStat.tsx`, added to `ds/index.ts`.

---

### 2. `EditorialSection` → `ds/EditorialSection.tsx`

Two-column image + text block driven by CMS data. Identical across all three pages; the only differences are the TypeScript type names (`ContinentEditorialBlock` vs `EditorialBlock`). All three types expose the same fields, so we define a minimal structural interface internally:

```ts
interface EditorialSectionData {
  image?: { url?: string | null; alternativeText?: string | null } | null
  imagePosition?: string | null
  eyebrow?: string | null
  title: string
  body?: unknown
  primaryCtaLabel?: string | null
  primaryCtaUrl?: string | null
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
}
```

Usage:

```tsx
<EditorialSection section={section} />
```

---

### 3. `CtaBannerSection` → `ds/CtaBannerSection.tsx`

Full-width CTA banner with radial gradient, centered title, optional subtitle, and aurora CTA link. Identical across all three pages. Minimal structural interface:

```ts
interface CtaBannerData {
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}
```

Usage:

```tsx
<CtaBannerSection section={section} />
```

---

### 4. `LocationGridBrowser` → `ds/LocationGridBrowser.tsx`

The bordered 2×4 grid of location cards (rank prefix + serif name + subtitle + hover arrow). Used for:

- Countries in ContinentDetailPage (prefix `C`)
- Regions in CountryDetailPage (prefix `R`)
- Areas in RegionDetailPage (prefix `A`)

Props:

```ts
interface LocationGridBrowserItem {
  slug: string
  name: string
  subtitle?: string | null // capitalCity / summary / typeLabel
  href: string
}

interface LocationGridBrowserProps {
  items: LocationGridBrowserItem[]
  rankPrefix: string // "C", "R", or "A"
}
```

Usage:

```tsx
<LocationGridBrowser
  rankPrefix="R"
  items={browseRegions.map((r, i) => ({
    slug: r.slug,
    name: r.name,
    subtitle: r.summary,
    href: `/${continentSlug}/${slug}/${r.slug}`,
  }))}
/>
```

---

### 5. `MapSectionHeader` → `ds/MapSectionHeader.tsx`

The repeated map section heading block: `Eyebrow` + `SectionHeader` italic + descriptive `p`. Currently duplicated word-for-word in all three pages.

Props:

```ts
interface MapSectionHeaderProps {
  index?: number // Eyebrow index (default: 3)
  locationName: string // inserted into "Libraries in {locationName}."
}
```

Usage:

```tsx
<MapSectionHeader locationName={country.name ?? "this country"} />
```

---

### 6. Aurora CTA className constant → `lib/styles.ts`

The Tailwind className string for aurora-style CTA buttons is repeated 10+ times:

```
"inline-flex items-center gap-2 rounded-2xl border border-[rgba(127,223,255,.35)] bg-[rgba(127,223,255,.1)] px-5 py-2.5 text-sm font-semibold text-[#7fdfff] transition-colors hover:bg-[rgba(127,223,255,.18)]"
```

Extract as named exports in `lib/styles.ts`:

```ts
export const auroraCta =
  "inline-flex items-center gap-2 rounded-2xl border border-[rgba(127,223,255,.35)] bg-[rgba(127,223,255,.1)] text-sm font-semibold text-[#7fdfff] transition-colors hover:bg-[rgba(127,223,255,.18)]"
export const auroraCta_sm = cn(auroraCta, "px-5 py-2.5") // editorial blocks
export const auroraCta_md = cn(auroraCta, "px-7 py-3") // CTA banners
export const auroraCta_lg = cn(auroraCta, "px-8 py-3.5") // journey fallback CTAs
```

---

## What Does NOT Change

- Component API at the page level (same visual output, same data sources)
- Strapi API types — we use structural interfaces, not the Strapi types directly in ds/ components
- `CountryBrowser.tsx` (continent folder) — already unused after previous refactor; will be left in place unless dead code removal is requested separately
- Library detail page (`LibraryDetailPage`, `LibraryHero`) — separate concerns, not included in this refactor

---

## File Changes Summary

| Action | Path                                                       |
| ------ | ---------------------------------------------------------- |
| Create | `apps/ui/src/components/ds/HeroStat.tsx`                   |
| Create | `apps/ui/src/components/ds/EditorialSection.tsx`           |
| Create | `apps/ui/src/components/ds/CtaBannerSection.tsx`           |
| Create | `apps/ui/src/components/ds/LocationGridBrowser.tsx`        |
| Create | `apps/ui/src/components/ds/MapSectionHeader.tsx`           |
| Update | `apps/ui/src/components/ds/index.ts` (add 5 new exports)   |
| Update | `apps/ui/src/lib/styles.ts` (add aurora CTA constants)     |
| Update | `apps/ui/src/components/continent/ContinentDetailPage.tsx` |
| Update | `apps/ui/src/components/country/CountryDetailPage.tsx`     |
| Update | `apps/ui/src/components/region/RegionDetailPage.tsx`       |

---

## Success Criteria

- All three detail pages render identically to before
- No local `HeroStat`, `EditorialBlock`, `CtaBannerSection` function definitions remain in the page files
- The inline tab nav and stats grid container markup exists only in `ds/HeroStat.tsx`
- The location grid browser markup exists only in `ds/LocationGridBrowser.tsx`
- `ds/index.ts` exports all new components
- No lint errors introduced
