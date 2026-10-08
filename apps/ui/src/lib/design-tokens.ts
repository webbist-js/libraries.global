// apps/ui/src/lib/design-tokens.ts
//
// v2 design system — light only. Warm paper, dark ink, indigo accent.
// Token values reference CSS custom properties defined in globals.css.

export const T = {
  map: {
    stopRing: "#2F5D3A",
    route: "#2F5D3A",
    coarseRing: "#3730A3",
    coarseOpacity: 0.12,
  },
  bg: {
    void: "var(--t-bg-void)", // page root — warm paper
    space: "var(--t-bg-space)", // deeper band — footer, cover strips
    deep: "var(--t-bg-deep)", // card / panel surface (white)
    surface: "var(--t-bg-surface)", // nested surface — row hover, inputs
    muted: "var(--t-bg-muted)", // muted fills — disabled, neutral chips
    muted2: "var(--t-bg-muted-2)", // nav hover, segmented-control track
    selected: "var(--t-bg-selected)",
  },
  ink: {
    base: "var(--t-ink-base)",
    dim: "var(--t-ink-dim)",
    low: "var(--t-ink-low)",
    faint: "var(--t-ink-faint)",
    ghost: "var(--t-ink-ghost)",
    /** Secondary text on an ink-dark surface (the staff card, the console). */
    onDark: "var(--t-ink-on-dark)",
  },
  overlay: {
    /** The dimmed backdrop behind a Drawer, Sheet or console overlay. */
    scrim: "var(--t-scrim)",
  },
  edge: {
    ok: "var(--t-edge-ok)",
    info: "var(--t-edge-info)",
    warn: "var(--t-edge-warn)",
    danger: "var(--t-edge-danger)",
  },
  border: {
    line: "var(--t-border-line)",
    hi: "var(--t-border-hi)",
    divider: "var(--t-divider)",
  },
  accent: {
    primary: "var(--t-accent-primary)", // indigo — CTAs, links, focus
    primaryHover: "var(--t-accent-primary-hover)",
    chip: "var(--t-accent-chip)", // light indigo — active filter chips
    // legacy slots, re-pointed at the v2 palette in globals.css
    aurora: "var(--t-accent-aurora)",
    violet: "var(--t-accent-violet)",
    ember: "var(--t-accent-ember)",
    gold: "var(--t-accent-gold)",
    ok: "var(--t-accent-ok)",
    warn: "var(--t-accent-warn)",
    danger: "var(--t-accent-danger)",
  },
  font: {
    serif: "var(--font-newsreader), Georgia, serif",
    mono: "var(--font-jetbrains-mono), ui-monospace, monospace",
    sans: "var(--font-figtree), system-ui, sans-serif",
  },
} as const

/** [bg, fg] tint pairs for library-type badges, card monograms and stat cards. */
export const TYPE_TINT = {
  national: { bg: "var(--tint-national-bg)", fg: "var(--tint-national-fg)" },
  public: { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
  academic: { bg: "var(--tint-academic-bg)", fg: "var(--tint-academic-fg)" },
  special: { bg: "var(--tint-special-bg)", fg: "var(--tint-special-fg)" },
  neutral: { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" },
} as const

export type TypeTintKey = keyof typeof TYPE_TINT

/**
 * [bg, fg] tint pairs for a Drive's Focus (chips, progress bars), built from
 * the type tints. `other` covers the Focus kinds the task panel can't fill
 * yet (verify, the whole record, the other gap keys).
 */
export const FOCUS_TINT = {
  hours: TYPE_TINT.public,
  photo: TYPE_TINT.special,
  accessibility: TYPE_TINT.academic,
  contact: TYPE_TINT.national,
  other: TYPE_TINT.neutral,
} as const

export type FocusTintKey = keyof typeof FOCUS_TINT

/** Map a Strapi libraryType enum value onto a tint pair. */
export function tintForLibraryType(libraryType?: string | null) {
  switch (libraryType) {
    case "National":
    case "Parliamentary":
    case "State":
      return TYPE_TINT.national
    case "Public":
    case "Municipal":
    case "Mobile":
      return TYPE_TINT.public
    case "Academic":
    case "University":
      return TYPE_TINT.academic
    case "Special":
    case "Monastic":
    case "Archive":
    case "Private":
    case "Cultural":
      return TYPE_TINT.special

    default:
      return TYPE_TINT.neutral
  }
}

export const GRAIN_SVG = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.97  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`
