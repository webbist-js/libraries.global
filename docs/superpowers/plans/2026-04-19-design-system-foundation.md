# Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract duplicated visual patterns into a shared token file and 11 presentational ds/ components, then immediately refactor every page to use them.

**Architecture:** Single `lib/design-tokens.ts` exports the `T` constant (bg/ink/border/accent/font) plus `GRAIN_SVG` and `AURORA_BG` strings. Eleven components in `components/ds/` consume `T`. All 18 page files are then refactored phase-by-phase to import from these shared sources. Tailwind stays for layout utilities only.

**Tech Stack:** React 18, Next.js App Router (server + client components), TypeScript, Tailwind CSS (layout only after this refactor), inline styles for all colour/typography decisions.

---

## File Map

**Created:**

- `apps/ui/src/lib/design-tokens.ts` — canonical T constant + string exports
- `apps/ui/src/components/ds/PageShell.tsx`
- `apps/ui/src/components/ds/Eyebrow.tsx`
- `apps/ui/src/components/ds/SectionHeader.tsx`
- `apps/ui/src/components/ds/Card.tsx`
- `apps/ui/src/components/ds/Badge.tsx`
- `apps/ui/src/components/ds/Breadcrumb.tsx`
- `apps/ui/src/components/ds/StatBlock.tsx`
- `apps/ui/src/components/ds/Avatar.tsx`
- `apps/ui/src/components/ds/EmptyState.tsx`
- `apps/ui/src/components/ds/MetaRow.tsx`
- `apps/ui/src/components/ds/Pager.tsx`
- `apps/ui/src/components/ds/index.ts`

**Modified (Phase 1 — Wiki):**

- `apps/ui/src/components/wiki/WikiLandingPage.tsx` — local TOKEN → shared T; PageShell
- `apps/ui/src/components/wiki/WikiArticlePage.tsx` — local T/MONO/SERIF → shared T

**Modified (Phase 2 — Blog):**

- `apps/ui/src/components/blog/BlogLandingPage.tsx`
- `apps/ui/src/components/blog/BlogArticlePage.tsx`
- `apps/ui/src/components/blog/BlogArticleCard.tsx`
- `apps/ui/src/components/blog/BlogArticleList.tsx`

**Modified (Phase 3 — Library):**

- `apps/ui/src/components/home/LibraryHomePage.tsx`
- `apps/ui/src/components/library/LibraryHero.tsx`
- `apps/ui/src/components/library/LibraryTabs.tsx`

**Modified (Phase 4 — Continent):**

- `apps/ui/src/components/continent/ContinentDetailPage.tsx`
- `apps/ui/src/components/home/ContinentTile.tsx`

**Modified (Phase 5 — Homepage):**

- `apps/ui/src/components/home/HomepageHero.tsx`
- `apps/ui/src/components/home/FeaturedLibraryCards.tsx`
- `apps/ui/src/components/home/ContributeCTA.tsx`

**Modified (Phase 6 — Shell):**

- `apps/ui/src/components/global/GlobalHeader.tsx`
- `apps/ui/src/components/global/GlobalFooter.tsx`

---

## Task 1: Create design-tokens.ts

**Files:**

- Create: `apps/ui/src/lib/design-tokens.ts`

- [ ] **Step 1: Write the file**

```ts
// apps/ui/src/lib/design-tokens.ts

export const T = {
  bg: {
    void: "#030511", // page root background
    space: "#050816", // header blur base
    deep: "#070b1e", // card/panel interior
    surface: "#060b19", // elevated card (replaces both #060b19 and #0c1228)
  },
  ink: {
    base: "#f4f7ff",
    dim: "rgba(244,247,255,.72)",
    low: "rgba(244,247,255,.48)",
    faint: "rgba(244,247,255,.30)",
    ghost: "rgba(244,247,255,.14)",
  },
  border: {
    line: "rgba(255,255,255,.08)",
    hi: "rgba(255,255,255,.16)",
  },
  accent: {
    aurora: "#7fdfff",
    violet: "#a390ff",
    ember: "#ffb88a",
    gold: "#e8c98a",
    ok: "#8ef0b3",
    warn: "#ffcf7a",
    danger: "#ff8a8a",
  },
  font: {
    serif: "var(--font-fraunces), serif",
    mono: "var(--font-jetbrains-mono), ui-monospace, monospace",
    sans: "var(--font-roboto), system-ui, sans-serif",
  },
} as const

export const GRAIN_SVG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.97  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`

export const AURORA_BG = `
  radial-gradient(1200px 800px at 18% 14%, rgba(92,149,255,.14), transparent 50%),
  radial-gradient(900px 700px at 82% 66%, rgba(127,223,255,.08), transparent 55%),
  radial-gradient(700px 500px at 50% 110%, rgba(163,144,255,.08), transparent 50%),
  linear-gradient(180deg, #04061a 0%, #050816 50%, #070b1e 100%)
`
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors referencing `design-tokens.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/design-tokens.ts
git commit -m "feat: add shared design tokens file"
```

---

## Task 2: Create PageShell

**Files:**

- Create: `apps/ui/src/components/ds/PageShell.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/PageShell.tsx
import type { CSSProperties, ReactNode } from "react"

import { AURORA_BG, GRAIN_SVG, T } from "@/lib/design-tokens"

export function PageShell({
  children,
  className,
  style,
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: T.bg.void,
        color: T.ink.base,
        overflowX: "hidden",
        fontFamily: T.font.sans,
        WebkitFontSmoothing: "antialiased",
        ...style,
      }}
      className={className}
    >
      {/* Aurora field */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: AURORA_BG,
        }}
      />
      {/* Film grain */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          opacity: 0.35,
          mixBlendMode: "screen",
          backgroundImage: GRAIN_SVG,
        }}
      />
      {/* Content */}
      <div style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  )
}
```

---

## Task 3: Create Eyebrow

**Files:**

- Create: `apps/ui/src/components/ds/Eyebrow.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/Eyebrow.tsx
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function Eyebrow({
  children,
  index,
  bar,
}: {
  readonly children: ReactNode
  readonly index?: number
  readonly bar?: boolean
}) {
  return (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".22em",
        textTransform: "uppercase",
        color: T.ink.faint,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        margin: 0,
      }}
    >
      {bar && (
        <span
          style={{
            width: "40px",
            height: "1px",
            background: T.ink.ghost,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {index != null ? `§ ${String(index).padStart(2, "0")} · ` : null}
      {children}
    </p>
  )
}
```

---

## Task 4: Create SectionHeader

**Files:**

- Create: `apps/ui/src/components/ds/SectionHeader.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/SectionHeader.tsx
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function SectionHeader({
  children,
  italic,
  as: Tag = "h2",
}: {
  readonly children: ReactNode
  readonly italic?: string
  readonly as?: "h1" | "h2" | "h3"
}) {
  return (
    <Tag
      style={{
        fontFamily: T.font.serif,
        fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        color: T.ink.base,
        margin: 0,
      }}
    >
      {children}
      {italic ? (
        <em
          style={{
            color: T.ink.low,
            fontStyle: "italic",
            fontWeight: 400,
          }}
        >
          {" "}
          {italic}
        </em>
      ) : null}
    </Tag>
  )
}
```

---

## Task 5: Create Card

**Files:**

- Create: `apps/ui/src/components/ds/Card.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/Card.tsx
import type { CSSProperties, ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function Card({
  children,
  as: Tag = "div",
  hover,
  style,
  className,
}: {
  readonly children: ReactNode
  readonly as?: "div" | "article"
  readonly hover?: boolean
  readonly style?: CSSProperties
  readonly className?: string
}) {
  return (
    <Tag
      style={{
        background: T.bg.surface,
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        transition: hover ? "border-color 200ms" : undefined,
        ...style,
      }}
      className={className}
    >
      {children}
    </Tag>
  )
}
```

---

## Task 6: Create Badge

**Files:**

- Create: `apps/ui/src/components/ds/Badge.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/Badge.tsx
import { T } from "@/lib/design-tokens"

export type BadgeColor =
  | "aurora"
  | "violet"
  | "ember"
  | "gold"
  | "ok"
  | "warn"
  | "danger"
  | "dim"

const COLOR_MAP: Record<
  BadgeColor,
  { text: string; border: string; bg: string }
> = {
  aurora: {
    text: T.accent.aurora,
    border: "rgba(127,223,255,.3)",
    bg: "rgba(127,223,255,.08)",
  },
  violet: {
    text: T.accent.violet,
    border: "rgba(163,144,255,.3)",
    bg: "rgba(163,144,255,.08)",
  },
  ember: {
    text: T.accent.ember,
    border: "rgba(255,184,138,.3)",
    bg: "rgba(255,184,138,.08)",
  },
  gold: {
    text: T.accent.gold,
    border: "rgba(232,201,138,.3)",
    bg: "rgba(232,201,138,.08)",
  },
  ok: {
    text: T.accent.ok,
    border: "rgba(142,240,179,.3)",
    bg: "rgba(142,240,179,.08)",
  },
  warn: {
    text: T.accent.warn,
    border: "rgba(255,207,122,.3)",
    bg: "rgba(255,207,122,.08)",
  },
  danger: {
    text: T.accent.danger,
    border: "rgba(255,138,138,.3)",
    bg: "rgba(255,138,138,.08)",
  },
  dim: { text: T.ink.low, border: T.border.line, bg: "rgba(255,255,255,.03)" },
}

export function Badge({
  label,
  color,
  dot,
  size = "sm",
}: {
  readonly label: string
  readonly color: BadgeColor
  readonly dot?: boolean
  readonly size?: "sm" | "md"
}) {
  const { text, border, bg } = COLOR_MAP[color]
  const dotColor = color === "dim" ? T.ink.faint : text

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: size === "md" ? "5px 12px" : "3px 8px",
        borderRadius: "999px",
        fontFamily: T.font.mono,
        fontSize: size === "md" ? "11px" : "10px",
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: text,
        border: `1px solid ${border}`,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: dotColor,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  )
}
```

---

## Task 7: Create Breadcrumb

**Files:**

- Create: `apps/ui/src/components/ds/Breadcrumb.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/Breadcrumb.tsx
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export function Breadcrumb({
  items,
}: {
  readonly items: { label: string; href?: string }[]
}) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: T.font.mono,
        fontSize: "10.5px",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        flexWrap: "wrap",
      }}
    >
      {items.map((item, i) => (
        <span
          key={i}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {i > 0 && <span style={{ color: T.ink.ghost }}>/</span>}
          {item.href && i < items.length - 1 ? (
            <GlobalLink
              href={item.href}
              style={{
                color: T.ink.low,
                textDecoration: "none",
                transition: "color 150ms",
              }}
              className="hover:text-[#f4f7ff]"
            >
              {item.label}
            </GlobalLink>
          ) : (
            <span style={{ color: T.ink.base }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
```

---

## Task 8: Create StatBlock

**Files:**

- Create: `apps/ui/src/components/ds/StatBlock.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/StatBlock.tsx
import { T } from "@/lib/design-tokens"

export function StatBlock({
  value,
  label,
  size = "lg",
}: {
  readonly value: string | number
  readonly label: string
  readonly size?: "sm" | "lg"
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        style={{
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: size === "lg" ? "clamp(1.8rem, 4vw, 2.8rem)" : "1.4rem",
          color: T.ink.base,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.low,
        }}
      >
        {label}
      </span>
    </div>
  )
}
```

---

## Task 9: Create Avatar

**Files:**

- Create: `apps/ui/src/components/ds/Avatar.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/Avatar.tsx
import { T } from "@/lib/design-tokens"

const GRADIENTS = [
  `linear-gradient(135deg, ${T.accent.aurora}, ${T.accent.violet})`,
  `linear-gradient(135deg, ${T.accent.ember}, ${T.accent.gold})`,
  `linear-gradient(135deg, ${T.accent.violet}, ${T.accent.aurora})`,
  `linear-gradient(135deg, ${T.accent.gold}, ${T.accent.ok})`,
]

const SIZES = { sm: "28px", md: "36px", lg: "48px" } as const
const FONT_SIZES = { sm: "10px", md: "12px", lg: "16px" } as const

export function Avatar({
  initials,
  index = 0,
  size = "md",
  title,
}: {
  readonly initials: string
  readonly index?: number
  readonly size?: "sm" | "md" | "lg"
  readonly title?: string
}) {
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const dim = SIZES[size]
  const fs = FONT_SIZES[size]

  return (
    <div
      title={title}
      style={{
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: fs,
          color: T.bg.deep,
          fontWeight: 600,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
    </div>
  )
}
```

---

## Task 10: Create EmptyState

**Files:**

- Create: `apps/ui/src/components/ds/EmptyState.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/EmptyState.tsx
import { T } from "@/lib/design-tokens"

export function EmptyState({ message }: { readonly message: string }) {
  return (
    <div
      style={{ paddingTop: "64px", paddingBottom: "64px", textAlign: "center" }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "13px",
          color: T.ink.faint,
          margin: 0,
        }}
      >
        {message}
      </p>
    </div>
  )
}
```

---

## Task 11: Create MetaRow

**Files:**

- Create: `apps/ui/src/components/ds/MetaRow.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/MetaRow.tsx
import { T } from "@/lib/design-tokens"

export function MetaRow({
  items,
  separator = "·",
}: {
  readonly items: (string | null | undefined)[]
  readonly separator?: string
}) {
  const nonEmpty = items.filter((x): x is string => Boolean(x))
  if (nonEmpty.length === 0) return null

  return (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "10.5px",
        color: T.ink.low,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
        margin: 0,
      }}
    >
      {nonEmpty.map((item, i) => (
        <span
          key={i}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {i > 0 && <span style={{ color: T.ink.ghost }}>{separator}</span>}
          {item}
        </span>
      ))}
    </p>
  )
}
```

---

## Task 12: Create Pager

**Files:**

- Create: `apps/ui/src/components/ds/Pager.tsx`

- [ ] **Step 1: Write the file**

```tsx
// apps/ui/src/components/ds/Pager.tsx
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { Card } from "./Card"

export function Pager({
  prev,
  next,
}: {
  readonly prev?: { label: string; href: string }
  readonly next?: { label: string; href: string }
}) {
  if (!prev && !next) return null

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
    >
      {prev ? (
        <GlobalLink href={prev.href} style={{ textDecoration: "none" }}>
          <Card hover style={{ padding: "16px 20px" }}>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.faint,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                marginBottom: "6px",
                margin: "0 0 6px",
              }}
            >
              ← Previous
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "14px",
                color: T.ink.dim,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {prev.label}
            </p>
          </Card>
        </GlobalLink>
      ) : (
        <div />
      )}
      {next ? (
        <GlobalLink href={next.href} style={{ textDecoration: "none" }}>
          <Card hover style={{ padding: "16px 20px", textAlign: "right" }}>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.faint,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                margin: "0 0 6px",
              }}
            >
              Next →
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "14px",
                color: T.ink.dim,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {next.label}
            </p>
          </Card>
        </GlobalLink>
      ) : (
        <div />
      )}
    </div>
  )
}
```

---

## Task 13: Create ds/index.ts barrel + verify TypeScript

**Files:**

- Create: `apps/ui/src/components/ds/index.ts`

- [ ] **Step 1: Write the barrel**

```ts
// apps/ui/src/components/ds/index.ts
export { Avatar } from "./Avatar"
export { Badge } from "./Badge"
export type { BadgeColor } from "./Badge"
export { Breadcrumb } from "./Breadcrumb"
export { Card } from "./Card"
export { EmptyState } from "./EmptyState"
export { Eyebrow } from "./Eyebrow"
export { MetaRow } from "./MetaRow"
export { PageShell } from "./PageShell"
export { Pager } from "./Pager"
export { SectionHeader } from "./SectionHeader"
export { StatBlock } from "./StatBlock"
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors in `components/ds/` or `lib/design-tokens.ts`

- [ ] **Step 3: Commit all ds/ files**

```bash
git add apps/ui/src/components/ds/ apps/ui/src/lib/design-tokens.ts
git commit -m "feat: add design token file and ds/ component library"
```

---

## Task 14: Phase 1 — Refactor WikiLandingPage

**Files:**

- Modify: `apps/ui/src/components/wiki/WikiLandingPage.tsx`

**What to change:**

1. Replace the local `TOKEN` constant and `GRAIN_SVG` constant with imports from shared sources.
2. Replace every `TOKEN.*` reference with the correct `T.*` key using the mapping below.
3. Replace the root `<div>` + background div + grain div + content div with `<PageShell>`.
4. Replace `"var(--font-jetbrains-mono), ui-monospace, monospace"` literals with `T.font.mono`.
5. Replace `"var(--font-fraunces), serif"` literals with `T.font.serif`.
6. Replace inline tag-badge JSX (the spans with border/bg/color from `TAG_COLORS`) with `<Badge>`.

**Token mapping (TOKEN → T):**
| Old | New |
|-----|-----|
| `TOKEN.aurora` | `T.accent.aurora` |
| `TOKEN.ember` | `T.accent.ember` |
| `TOKEN.violet` | `T.accent.violet` |
| `TOKEN.gold` | `T.accent.gold` |
| `TOKEN.ok` | `T.accent.ok` |
| `TOKEN.bgVoid` | `T.bg.void` |
| `TOKEN.bgSpace` | `T.bg.space` |
| `TOKEN.bgDeep` | `T.bg.deep` |
| `TOKEN.ink` | `T.ink.base` |
| `TOKEN.inkDim` | `T.ink.dim` |
| `TOKEN.inkLow` | `T.ink.low` |
| `TOKEN.inkFaint` | `T.ink.faint` |
| `TOKEN.inkGhost` | `T.ink.ghost` |
| `TOKEN.line` | `T.border.line` |
| `TOKEN.lineHi` | `T.border.hi` |

- [ ] **Step 1: Update imports at top of file**

Replace the existing imports block (lines 1–11) with:

```tsx
import type { Locale } from "next-intl"

import { Badge, PageShell } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type {
  WikiArticleSummary,
  WikiCategorySummary,
  WikiLandingData,
  WikiNavCategory,
} from "@/lib/strapi-api/content/server"
```

- [ ] **Step 2: Delete the local TOKEN constant and GRAIN_SVG constant**

Remove these blocks entirely:

- The `const TOKEN = { ... } as const` block (lines 15–31)
- The `const GRAIN_SVG = ...` line (line 34)
- The `const TAG_COLORS = [...]` block (lines 37–46)

- [ ] **Step 3: Replace TAG_COLORS usage with Badge**

The `DomainCard` component renders a category tag badge. Find this span inside `DomainCard`:

```tsx
<div
  style={{
    fontFamily: "var(--font-jetbrains-mono)...",
    fontSize: "11px",
    letterSpacing: ".14em",
    textTransform: "uppercase" as const,
    color: tagColor.color,
    border: `1px solid ${tagColor.border}`,
    background: tagColor.bg,
    padding: "3px 10px",
    borderRadius: "999px",
    display: "inline-block",
  }}
>
  {category.tagLabel}
</div>
```

Replace with:

```tsx
<Badge
  label={category.tagLabel}
  color={
    ["aurora", "ember", "ok", "violet", "gold", "aurora", "ember", "ok"][
      index % 8
    ] as "aurora" | "ember" | "ok" | "violet" | "gold"
  }
/>
```

The `ARTICLE_TAGS` array inline badge spans in `ArticleChangelogRow` — replace the span with:

```tsx
<Badge
  label={label}
  color={
    ["aurora", "gold", "ok", "aurora", "violet", "ok"][index % 6] as
      | "aurora"
      | "gold"
      | "ok"
      | "violet"
  }
/>
```

(Remove the `ARTICLE_TAGS` constant too.)

- [ ] **Step 4: Replace root div + background divs with PageShell**

Find the root return in `WikiLandingPage`:

```tsx
return (
  <div
    style={{
      position: "relative",
      minHeight: "100vh",
      background: TOKEN.bgVoid,
      color: TOKEN.ink,
      overflowX: "hidden",
      fontFamily: "var(--font-roboto)...",
      WebkitFontSmoothing: "antialiased",
    }}
  >
    {/* Background field */}
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, ... }} />
    {/* Film grain overlay */}
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 1, ... }} />
    {/* Content layer */}
    <div style={{ position: "relative", zIndex: 2 }}>
      ...existing content...
    </div>
  </div>
)
```

Replace with:

```tsx
return (
  <PageShell>
    <GlobalHeader locale={locale} navbar={navbar} />
    ...rest of existing content (previously inside the z-2 content div)...
  </PageShell>
)
```

- [ ] **Step 5: Apply token mapping throughout the file**

Do a global find-replace of all `TOKEN.` references using the mapping table from the task header. Also replace:

- `"var(--font-jetbrains-mono), ui-monospace, monospace"` → `T.font.mono`
- `"var(--font-fraunces), serif"` → `T.font.serif`
- `"var(--font-roboto), system-ui, sans-serif"` → `T.font.sans`

- [ ] **Step 6: TypeScript check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep WikiLandingPage
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/ui/src/components/wiki/WikiLandingPage.tsx
git commit -m "refactor: WikiLandingPage — shared T tokens, PageShell, Badge"
```

---

## Task 15: Phase 1 — Refactor WikiArticlePage

**Files:**

- Modify: `apps/ui/src/components/wiki/WikiArticlePage.tsx`

**What to change:**

1. Replace local `T` flat constant with import from `@/lib/design-tokens`.
2. Remove `MONO` and `SERIF` constants; replace with `T.font.mono` and `T.font.serif`.
3. Wrap root div with `PageShell`.
4. `StatusBadge` component now wraps `Badge` from ds/.

**Token mapping (old flat T → new nested T):**
| Old | New |
|-----|-----|
| `T.aurora` | `T.accent.aurora` |
| `T.ember` | `T.accent.ember` |
| `T.violet` | `T.accent.violet` |
| `T.gold` | `T.accent.gold` |
| `T.ok` | `T.accent.ok` |
| `T.warn` | `T.accent.warn` |
| `T.danger` | `T.accent.danger` |
| `T.bgVoid` | `T.bg.void` |
| `T.bgDeep` | `T.bg.deep` |
| `T.ink` | `T.ink.base` |
| `T.inkDim` | `T.ink.dim` |
| `T.inkLow` | `T.ink.low` |
| `T.inkFaint` | `T.ink.faint` |
| `T.inkGhost` | `T.ink.ghost` |
| `T.line` | `T.border.line` |
| `T.lineHi` | `T.border.hi` |
| `MONO` | `T.font.mono` |
| `SERIF` | `T.font.serif` |

- [ ] **Step 1: Update imports at top of file**

```tsx
import type { Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { Badge, Breadcrumb, MetaRow, PageShell, Pager } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
  countWords,
  estimateReadingTime,
  extractHeadings,
  formatRelativeDate,
} from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type {
  WikiArticleDetail,
  WikiArticleStatus,
  WikiNavCategory,
} from "@/lib/strapi-api/content/server"

import { WikiProgressBar } from "./WikiProgressBar"
```

- [ ] **Step 2: Remove local constants**

Delete these blocks:

- `const T = { ... } as const` (lines 23–40)
- `const MONO = ...` (line 42)
- `const SERIF = ...` (line 43)

- [ ] **Step 3: Rewrite StatusBadge to use Badge**

Replace the entire `StatusBadge` function with:

```tsx
const STATUS_TO_BADGE_COLOR: Record<
  WikiArticleStatus,
  import("@/components/ds").BadgeColor
> = {
  stable: "ok",
  beta: "warn",
  experimental: "ember",
  draft: "dim",
  deprecated: "danger",
}

const STATUS_LABELS: Record<WikiArticleStatus, string> = {
  stable: "Stable",
  beta: "Beta",
  experimental: "Experimental",
  draft: "Draft",
  deprecated: "Deprecated",
}

function StatusBadge({ status }: { status?: WikiArticleStatus | null }) {
  if (!status) return null
  return (
    <Badge
      label={STATUS_LABELS[status] ?? status}
      color={STATUS_TO_BADGE_COLOR[status] ?? "dim"}
      dot
    />
  )
}
```

Keep `NavStatusBadge` as-is (it's a compact sidebar variant that intentionally differs).

- [ ] **Step 4: Apply token mapping**

In the remaining code (WikiLeftNav, WikiRightPanel, main WikiArticlePage component), do a global find-replace for each mapping in the table above. Also replace:

- `"var(--font-jetbrains-mono), ui-monospace, monospace"` → `T.font.mono`
- `"var(--font-fraunces), serif"` → `T.font.serif`

- [ ] **Step 5: Replace root div + background divs with PageShell**

In `WikiArticlePage`'s return, find the root `<div style={{ ... background: T.bgVoid ... }}>` that contains the background gradient div. Replace it with `<PageShell>`, keeping `<WikiProgressBar />` directly inside (before the GlobalHeader).

The result should be:

```tsx
return (
  <PageShell>
    <WikiProgressBar />
    <GlobalHeader locale={locale} navbar={navbar} />
    {/* three-column shell grid */}
    ...
  </PageShell>
)
```

- [ ] **Step 6: Add Pager at bottom of article body**

After the `<ArticleBodyBlocks>` render and before any footer, add:

```tsx
{
  /* Pager — if prev/next article data is not yet in the API shape, omit for now */
}
{
  /* TODO: Pager when prevArticle/nextArticle fields exist on WikiArticleDetail */
}
```

This satisfies the spec note about the TODO stub. The `Pager` component is imported and ready; wire it up when the data is available.

- [ ] **Step 7: Replace breadcrumb inline JSX with Breadcrumb component**

Find the breadcrumb inline JSX near the article header. It looks like:

```tsx
<nav style={{ ... fontFamily: MONO ... }}>
  <GlobalLink href="/wiki" style={{ color: T.inkLow }}>Wiki</GlobalLink>
  <span style={{ color: T.inkGhost }}>/</span>
  ...
</nav>
```

Replace with:

```tsx
<Breadcrumb
  items={[
    { label: "Wiki", href: "/wiki" },
    ...(article.category
      ? [
          {
            label: article.category.name ?? "",
            href: `/wiki?category=${article.category.slug}`,
          },
        ]
      : []),
    { label: article.title ?? "" },
  ]}
/>
```

- [ ] **Step 7: Replace meta inline JSX with MetaRow**

Find the author/date/read-time metadata row in the article header. It typically looks like:

```tsx
<div style={{ fontFamily: MONO, fontSize: "10.5px", color: T.inkLow, ... }}>
  {readTime} min · {date} · {author}
</div>
```

Replace with:

```tsx
<MetaRow
  items={[
    `${readTime} min read`,
    formattedDate,
    article.author ?? undefined,
  ].filter(Boolean)}
/>
```

- [ ] **Step 8: TypeScript check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep WikiArticlePage
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/ui/src/components/wiki/WikiArticlePage.tsx
git commit -m "refactor: WikiArticlePage — shared T tokens, PageShell, Badge, Breadcrumb, MetaRow, Pager"
```

---

## Task 16: Phase 2 — Refactor Blog components

**Files:**

- Modify: `apps/ui/src/components/blog/BlogLandingPage.tsx`
- Modify: `apps/ui/src/components/blog/BlogArticlePage.tsx`
- Modify: `apps/ui/src/components/blog/BlogArticleCard.tsx`
- Modify: `apps/ui/src/components/blog/BlogArticleList.tsx`

### BlogLandingPage

- [ ] **Step 1: Add import + apply PageShell**

Add to imports:

```tsx
import { PageShell } from "@/components/ds"
import { T } from "@/lib/design-tokens"
```

Find the root `<div className="... bg-[#050816] ...">` wrapper and replace with `<PageShell>`. Remove any background gradient divs that duplicate what PageShell provides.

- [ ] **Step 2: Replace RichTitle's `text-white/72` with inline style**

The `<em>` inside `RichTitle` uses `className="italic text-white/72"`. Replace with:

```tsx
<em key={i} style={{ fontStyle: "italic", color: T.ink.dim }}>
  {part.slice(1, -1)}
</em>
```

### BlogArticleCard

- [ ] **Step 3: Replace hardcoded card background with T tokens**

In `BlogArticleCard`, find:

```tsx
className = "... bg-[#060b19] ..."
```

Replace the `bg-[#060b19]` Tailwind class and `border-white/[0.07]` with an inline style using T tokens:

```tsx
style={{
  background: T.bg.surface,
  border: `1px solid ${T.border.line}`,
  borderRadius: "16px",
}}
```

Keep other Tailwind layout classes (`group flex flex-col overflow-hidden transition-[border-color] duration-300`). Add `hover:border-white/[0.14]` → keep as Tailwind or add `onMouseEnter`/`onMouseLeave` — Tailwind hover is acceptable for this transition.

- [ ] **Step 4: Replace category pill with Badge**

In `BlogArticleCard`, find:

```tsx
<span className="font-mono text-[10px] tracking-[0.16em] text-white/32 uppercase">
  {article.category}
</span>
```

Replace with:

```tsx
<Badge label={article.category} color="dim" />
```

Add `import { Badge } from "@/components/ds"` to imports.

### BlogArticleList

- [ ] **Step 5: Replace empty state div with EmptyState**

Find:

```tsx
<div className="py-16 text-center">
  <p className="text-sm text-white/30">No articles in this category.</p>
</div>
```

Replace with:

```tsx
<EmptyState message="No articles in this category." />
```

Add `import { EmptyState } from "@/components/ds"` to imports.

### BlogArticlePage

- [ ] **Step 6: Replace AuthorAvatar with Avatar**

Delete the existing `AuthorAvatar` function and replace all usages with:

```tsx
<Avatar initials={(author ?? "?").charAt(0)} size={size} />
```

Add `import { Avatar, Breadcrumb, MetaRow, PageShell, Pager } from "@/components/ds"` to imports.

- [ ] **Step 7: Apply PageShell to BlogArticlePage root**

Find the root `<div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">` and replace with `<PageShell className="flex flex-col">`.

- [ ] **Step 8: Replace breadcrumb inline nav with Breadcrumb**

Find any breadcrumb `<nav>` or `<div>` that shows "Blog / Article Title" trail. Replace with:

```tsx
<Breadcrumb
  items={[{ label: "Blog", href: "/blog" }, { label: article.title ?? "" }]}
/>
```

- [ ] **Step 9: Replace metadata line with MetaRow**

Find inline metadata spans (date, author, read time). Replace with:

```tsx
<MetaRow
  items={[
    readTime ? `${readTime} min read` : null,
    formatDate(article.publishedAt ?? article.updatedAt),
    article.author ?? null,
  ]}
/>
```

- [ ] **Step 10: Replace ad-hoc prev/next with Pager**

Find any existing prev/next navigation at the bottom of the article (it may use related article cards). Replace with:

```tsx
<Pager
  prev={
    related?.[0]
      ? { label: related[0].title ?? "", href: `/blog/${related[0].slug}` }
      : undefined
  }
  next={
    related?.[1]
      ? { label: related[1].title ?? "", href: `/blog/${related[1].slug}` }
      : undefined
  }
/>
```

- [ ] **Step 11: TypeScript check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "Blog"
```

Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add apps/ui/src/components/blog/
git commit -m "refactor: Blog components — PageShell, Badge, Avatar, Breadcrumb, MetaRow, EmptyState, Pager"
```

---

## Task 17: Phase 3 — Refactor Library components

**Files:**

- Modify: `apps/ui/src/components/home/LibraryHomePage.tsx`
- Modify: `apps/ui/src/components/library/LibraryHero.tsx`
- Modify: `apps/ui/src/components/library/LibraryTabs.tsx`

### LibraryHomePage

- [ ] **Step 1: Replace background gradient div with PageShell**

In `LibraryHomePage`, find the root `<div className="relative isolate ... bg-[#050816]">` and the two inner gradient `<div>` elements. Replace all three with `<PageShell className="flex flex-col">`. Keep the `data-homepage="true"` attribute on an inner div if present.

```tsx
import { PageShell } from "@/components/ds"
```

### LibraryHero

The `LibraryHero` STATUS_CONFIG uses library operational status (open/closed/seasonal etc.) — these are domain-specific and should NOT use the generic `Badge` component. Leave those as Tailwind.

- [ ] **Step 2: Add T import + replace background tokens**

Add to imports:

```tsx
import { T } from "@/lib/design-tokens"
```

Find hardcoded `"#050816"` or `"#060b19"` values in inline styles (if any) and replace with `T.bg.space` or `T.bg.surface` respectively.

### LibraryTabs

- [ ] **Step 3: Read LibraryTabs**

```bash
cat apps/ui/src/components/library/LibraryTabs.tsx | head -80
```

- [ ] **Step 4: Add T import + replace card background**

Find the tab panel card backgrounds (likely `bg-[#060b19]` or similar). Add import and replace with `T.bg.surface` via inline style.

- [ ] **Step 5: TypeScript check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "Library"
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/home/LibraryHomePage.tsx apps/ui/src/components/library/
git commit -m "refactor: Library components — PageShell, T tokens"
```

---

## Task 18: Phase 4 — Refactor Continent components

**Files:**

- Modify: `apps/ui/src/components/continent/ContinentDetailPage.tsx`
- Modify: `apps/ui/src/components/home/ContinentTile.tsx`

### ContinentDetailPage

- [ ] **Step 1: Add imports**

```tsx
import {
  Card,
  EmptyState,
  Eyebrow,
  SectionHeader,
  StatBlock,
} from "@/components/ds"
import { T } from "@/lib/design-tokens"
```

- [ ] **Step 2: Replace StatCard component with StatBlock**

Delete the local `StatCard` function. Replace all `<StatCard label="..." value="..." note="..." />` usages with:

```tsx
<div
  style={{
    background: T.bg.surface,
    border: `1px solid ${T.border.line}`,
    borderRadius: "12px",
    padding: "16px 20px",
  }}
>
  <StatBlock value={value} label={label} size="sm" />
  {note ? (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "11px",
        color: T.ink.faint,
        marginTop: "4px",
      }}
    >
      {note}
    </p>
  ) : null}
</div>
```

Or just use `<StatBlock>` directly if the surrounding card is managed by other elements.

- [ ] **Step 3: Replace Eyebrow-like section labels**

Find patterns like:

```tsx
<span className="text-[10px] font-semibold tracking-[0.14em] text-white/36 uppercase">
  LABEL
</span>
```

Replace with `<Eyebrow>LABEL</Eyebrow>`.

- [ ] **Step 4: Apply Card to panel elements**

Find `className={cn(homepagePanelClassName, ...)}` usages. Replace with `<Card>` + inline padding styles.

### ContinentTile

- [ ] **Step 5: Read ContinentTile**

```bash
cat apps/ui/src/components/home/ContinentTile.tsx
```

- [ ] **Step 6: Add T import + replace hardcoded colors**

Add:

```tsx
import { T } from "@/lib/design-tokens"
```

Replace `bg-[#060b19]`, `border-white/[0.07]`, and similar with `T.bg.surface`, `T.border.line` via inline styles where appropriate.

- [ ] **Step 7: TypeScript check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "Continent"
```

- [ ] **Step 8: Commit**

```bash
git add apps/ui/src/components/continent/ apps/ui/src/components/home/ContinentTile.tsx
git commit -m "refactor: Continent components — Card, StatBlock, Eyebrow, T tokens"
```

---

## Task 19: Phase 5 — Refactor Homepage components

**Files:**

- Modify: `apps/ui/src/components/home/HomepageHero.tsx`
- Modify: `apps/ui/src/components/home/FeaturedLibraryCards.tsx`
- Modify: `apps/ui/src/components/home/ContributeCTA.tsx`

> Note: LibraryHomePage background is intentionally left as-is — the globe backdrop owns its own background layer. Only HomepageHero, FeaturedLibraryCards, and ContributeCTA are targeted here.

### HomepageHero

- [ ] **Step 1: Add imports**

```tsx
import { Eyebrow, SectionHeader, StatBlock } from "@/components/ds"
import { T } from "@/lib/design-tokens"
```

- [ ] **Step 2: Replace eyebrow label**

Find:

```tsx
<p className="font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase ...">
  {heroEyebrow}
</p>
```

Replace with:

```tsx
<Eyebrow>{heroEyebrow}</Eyebrow>
```

- [ ] **Step 3: Replace RichTitle heading with SectionHeader**

The `RichTitle` function renders a large heading with italic em. Replace the `<h1>` that uses `RichTitle` with:

```tsx
<SectionHeader as="h1">
  {/* keep the existing RichTitle render logic inline here, or keep RichTitle as a local helper */}
  <RichTitle text={heroTitle ?? ""} />
</SectionHeader>
```

Note: `SectionHeader` accepts `children` so `RichTitle` can remain as a local helper that outputs the JSX with the styled em.

- [ ] **Step 4: Replace STATS stat blocks**

Find the STATS grid. Each stat renders a number + label. Replace each with:

```tsx
<StatBlock
  value={formatCount(libraryCount)}
  label="Libraries Indexed"
  size="lg"
/>
```

For stats with null values (collections, languages, contributors), use `value="—"`.

### ContributeCTA

- [ ] **Step 5: Replace eyebrow**

Find:

```tsx
<p className="mb-5 font-mono text-[11px] tracking-[0.22em] text-white/35 uppercase">
  § 04 — CONTRIBUTE
</p>
```

Replace with:

```tsx
<Eyebrow index={4}>Contribute</Eyebrow>
```

- [ ] **Step 6: Replace heading**

Find the `<h2 className="font-[family-name:var(--font-fraunces)] ...">` block. Replace with:

```tsx
<SectionHeader as="h2" italic="the complete index.">
  Help us build
</SectionHeader>
```

- [ ] **Step 7: Replace stat cards with Card + StatBlock**

Find:

```tsx
<div className="rounded-2xl border border-white/[0.07] bg-[#060b19] p-6">
  <p className="text-[2.4rem]... font-[family-name:var(--font-fraunces)]">
    {stat.value}
  </p>
  <p className="mt-2 font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">
    {stat.label}
  </p>
</div>
```

Replace with:

```tsx
<Card style={{ padding: "24px" }}>
  <StatBlock value={stat.value} label={stat.label} size="lg" />
</Card>
```

### FeaturedLibraryCards

- [ ] **Step 8: Read FeaturedLibraryCards**

```bash
cat apps/ui/src/components/home/FeaturedLibraryCards.tsx
```

- [ ] **Step 9: Replace card backgrounds with Card component**

Find `className="... bg-[#060b19] border border-white/[0.07] rounded-2xl ..."` card wrappers. Replace with `<Card hover style={{ padding: "..." }}>`.

- [ ] **Step 10: TypeScript check**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "Homepage|Contribute|Featured"
```

- [ ] **Step 11: Commit**

```bash
git add apps/ui/src/components/home/HomepageHero.tsx apps/ui/src/components/home/FeaturedLibraryCards.tsx apps/ui/src/components/home/ContributeCTA.tsx
git commit -m "refactor: Homepage components — Eyebrow, SectionHeader, Card, StatBlock"
```

---

## Task 20: Phase 6 — Refactor GlobalHeader and GlobalFooter

**Files:**

- Modify: `apps/ui/src/components/global/GlobalHeader.tsx`
- Modify: `apps/ui/src/components/global/GlobalFooter.tsx`

### GlobalHeader

- [ ] **Step 1: Add T import**

```tsx
import { T } from "@/lib/design-tokens"
```

- [ ] **Step 2: Replace background color**

Find:

```tsx
className =
  "sticky top-0 z-40 border-b border-white/8 bg-[#050816]/92 backdrop-blur-xl"
```

Replace with an inline style for the background, keeping Tailwind layout utilities:

```tsx
className="sticky top-0 z-40 backdrop-blur-xl"
style={{ borderBottom: `1px solid ${T.border.line}`, background: "rgba(5,8,22,.92)" }}
```

- [ ] **Step 3: Replace hardcoded font family strings**

Find any `font-[family-name:var(--font-fraunces)]` Tailwind class usages in the header and replace with inline `fontFamily: T.font.serif` style.

### GlobalFooter

- [ ] **Step 4: Add T import**

```tsx
import { T } from "@/lib/design-tokens"
```

- [ ] **Step 5: Replace footer background and border**

Find:

```tsx
className = "relative z-20 border-t border-white/8 bg-[#07090f]"
```

Replace with:

```tsx
className="relative z-20"
style={{ borderTop: `1px solid ${T.border.line}`, background: "#07090f" }}
```

(Note: `#07090f` is intentionally slightly darker than `T.bg.void` — keep the exact value, just move it to inline style.)

- [ ] **Step 6: Replace section label mono text**

Find:

```tsx
<h3 className="font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase">
  {section.title}
</h3>
```

Replace with:

```tsx
<Eyebrow>{section.title}</Eyebrow>
```

Add `import { Eyebrow } from "@/components/ds"`.

- [ ] **Step 7: Replace footer heading font class**

Find `className="font-[family-name:var(--font-fraunces)] ..."` on `<h2>` in the footer. Convert to inline `fontFamily: T.font.serif` style.

- [ ] **Step 8: TypeScript check (full)**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors across all modified files.

- [ ] **Step 9: Commit**

```bash
git add apps/ui/src/components/global/
git commit -m "refactor: GlobalHeader and GlobalFooter — T token colors, Eyebrow"
```

---

## Task 21: Final verification

- [ ] **Step 1: Full TypeScript build**

```bash
cd apps/ui && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Start dev server and spot-check pages**

```bash
cd apps/ui && pnpm dev
```

Visually verify these routes:

- `/` — homepage, globe backdrop, aurora unchanged
- `/wiki` — wiki landing, deep space background, grain overlay
- `/wiki/[any-slug]` — article page, sidebar nav, progress bar
- `/blog` — blog landing, PageShell aurora
- `/blog/[any-slug]` — article page, Avatar, Breadcrumb, Pager
- Any library or continent page

Expected: all pages render without hydration errors and the visual aesthetic is unified.

- [ ] **Step 3: Final commit if needed**

```bash
git add -p  # stage any remaining tweaks
git commit -m "refactor: design system foundation complete"
```
