// apps/ui/src/lib/design-tokens.ts
//
// Token values reference CSS custom properties defined in globals.css.
// This allows dark/light theming without touching every component.

export const T = {
  bg: {
    void: "var(--t-bg-void)",
    space: "var(--t-bg-space)",
    deep: "var(--t-bg-deep)",
    surface: "var(--t-bg-surface)",
  },
  ink: {
    base: "var(--t-ink-base)",
    dim: "var(--t-ink-dim)",
    low: "var(--t-ink-low)",
    faint: "var(--t-ink-faint)",
    ghost: "var(--t-ink-ghost)",
  },
  border: {
    line: "var(--t-border-line)",
    hi: "var(--t-border-hi)",
  },
  accent: {
    aurora: "var(--t-accent-aurora)",
    violet: "var(--t-accent-violet)",
    ember: "var(--t-accent-ember)",
    gold: "var(--t-accent-gold)",
    ok: "var(--t-accent-ok)",
    warn: "var(--t-accent-warn)",
    danger: "var(--t-accent-danger)",
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
  var(--t-bg-space)
`
