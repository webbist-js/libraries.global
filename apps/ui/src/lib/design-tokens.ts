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
