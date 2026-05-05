"use client"

import { useEffect, useRef } from "react"

// ── Variant config ─────────────────────────────────────────────────────────────

export type DotHeroVariant = "aurora" | "journal" | "knowledge" | "events"

interface Config {
  spacing: number
  speed: number
  accentDark: string
  accentLight: string
  dotDark: string
  dotLight: string
}

const CONFIGS: Record<DotHeroVariant, Config> = {
  // Original: scattered noise oscillation, aurora/cyan
  aurora: {
    spacing: 26,
    speed: 0.007,
    accentDark: "127,223,255",
    accentLight: "29,111,140",
    dotDark: "180,205,235",
    dotLight: "22,22,38",
  },
  // Blog / Journal: radial waves, warm amber
  journal: {
    spacing: 32,
    speed: 0.004,
    accentDark: "255,184,138",
    accentLight: "160,80,20",
    dotDark: "200,170,140",
    dotLight: "40,22,10",
  },
  // Wiki / Knowledge: radial waves, cool violet
  knowledge: {
    spacing: 32,
    speed: 0.003,
    accentDark: "163,144,255",
    accentLight: "70,50,160",
    dotDark: "170,160,210",
    dotLight: "22,18,50",
  },
  // Events: discrete dot pulses — random dots emit expanding concentric rings
  events: {
    spacing: 28,
    speed: 0, // unused — animation is frame-driven, not time-driven
    accentDark: "127,223,255",
    accentLight: "29,111,140",
    dotDark: "140,185,215",
    dotLight: "22,22,38",
  },
}

// ── Shared draw function type ──────────────────────────────────────────────────

type DrawFn = (
  ctx: CanvasRenderingContext2D,
  dots: Dot[],
  t: number,
  w: number,
  h: number,
  isLight: boolean,
  cfg: Config
) => void

// ── Dot grid ───────────────────────────────────────────────────────────────────

interface Dot {
  x: number
  y: number
  /** per-dot noise frequencies (aurora mode) */
  px: number
  py: number
  pt: number
}

function buildDots(w: number, h: number, spacing: number): Dot[] {
  const cols = Math.ceil(w / spacing) + 2
  const rows = Math.ceil(h / spacing) + 2
  const out: Dot[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: c * spacing - spacing / 2,
        y: r * spacing - spacing / 2,
        px: 0.032 + Math.random() * 0.052,
        py: 0.025 + Math.random() * 0.042,
        pt: 0.16 + Math.random() * 0.42,
      })
    }
  }

  return out
}

// ── Draw: aurora (original — scattered noise) ──────────────────────────────────

const drawAurora: DrawFn = (ctx, dots, t, w, h, isLight, cfg) => {
  const ACCENT = isLight ? cfg.accentLight : cfg.accentDark
  const DOT = isLight ? cfg.dotLight : cfg.dotDark

  ctx.clearRect(0, 0, w, h)
  for (const d of dots) {
    const s1 = Math.sin(d.x * d.px + t * d.pt)
    const s2 = Math.sin(d.y * d.py + t * d.pt * 0.68)
    const s3 = Math.sin(d.x * 0.016 + d.y * 0.013 + t * 0.11)
    const v = Math.max(0, Math.min(1, 0.5 + 0.38 * s1 * s2 + 0.12 * s3))

    const r = 1 + v * 1.6
    const alpha = isLight ? 0.05 + v * 0.35 : 0.07 + v * 0.5
    const isAccent = v > 0.6

    if (v > 0.63) {
      const glowR = r * 7
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowR)
      const ga = ((v - 0.63) / 0.37) * (isLight ? 0.08 : 0.14)
      g.addColorStop(0, `rgba(${ACCENT},${ga.toFixed(3)})`)
      g.addColorStop(1, `rgba(${ACCENT},0)`)
      ctx.beginPath()
      ctx.arc(d.x, d.y, glowR, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
    ctx.fillStyle = isAccent
      ? `rgba(${ACCENT},${alpha.toFixed(3)})`
      : `rgba(${DOT},${(alpha * 0.5).toFixed(3)})`
    ctx.fill()
  }
}

// ── Draw: radial (journal / knowledge — concentric interference rings) ─────────
//
// Two pulse sources drift slowly across the canvas; their wave patterns
// interfere to produce shifting rings of brightness — like signal propagation
// or ink spreading through paper.

const drawRadial: DrawFn = (ctx, dots, t, w, h, isLight, cfg) => {
  const ACCENT = isLight ? cfg.accentLight : cfg.accentDark
  const DOT = isLight ? cfg.dotLight : cfg.dotDark

  // Two slowly drifting pulse origins
  const cx1 = w * (0.28 + 0.22 * Math.sin(t * 0.14))
  const cy1 = h * (0.38 + 0.18 * Math.sin(t * 0.11))
  const cx2 = w * (0.74 + 0.17 * Math.sin(t * 0.12 + 1.8))
  const cy2 = h * (0.6 + 0.2 * Math.sin(t * 0.09 + 0.9))

  ctx.clearRect(0, 0, w, h)
  for (const d of dots) {
    const dist1 = Math.hypot(d.x - cx1, d.y - cy1)
    const dist2 = Math.hypot(d.x - cx2, d.y - cy2)

    // Rings propagating outward; t scaled higher to keep visible motion at low speed
    const wave1 = Math.sin(dist1 * 0.038 - t * 5.5)
    const wave2 = Math.sin(dist2 * 0.032 - t * 4.8 + 1.4)

    const v = Math.max(0, Math.min(1, 0.5 + 0.32 * wave1 + 0.22 * wave2))

    const r = 0.9 + v * 1.5
    const alpha = isLight ? 0.04 + v * 0.28 : 0.06 + v * 0.42
    const isAccent = v > 0.64

    if (v > 0.68) {
      const glowR = r * 6
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowR)
      const ga = ((v - 0.68) / 0.32) * (isLight ? 0.07 : 0.11)
      g.addColorStop(0, `rgba(${ACCENT},${ga.toFixed(3)})`)
      g.addColorStop(1, `rgba(${ACCENT},0)`)
      ctx.beginPath()
      ctx.arc(d.x, d.y, glowR, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
    ctx.fillStyle = isAccent
      ? `rgba(${ACCENT},${alpha.toFixed(3)})`
      : `rgba(${DOT},${(alpha * 0.45).toFixed(3)})`
    ctx.fill()
  }
}

// ── Draw: events (ripple — wavefronts illuminate nearby grid dots) ─────────────
//
// No circle strokes are drawn. Instead, each expanding wavefront computes a
// brightness contribution for every dot based on how close that dot is to the
// current ring radius. Dots near the wavefront light up; dots far from it stay
// dim. The result looks like a ripple of brightness spreading dot-to-dot
// outward from the source, like a signal radiating from a library on a map.
//
// Multiple independent timers ensure several pulses are always in flight.

interface EventRing {
  x: number
  y: number
  r: number // current radius of the wavefront
  maxR: number // radius at which the ring fully fades
  delay: number // frames before this ring starts expanding
  speed: number // px per frame
}

interface EventPulse {
  rings: EventRing[]
}

// Number of independent pulse timers — controls simultaneous active pulses.
const EVENTS_TIMER_COUNT = 6
const INTERVAL_MIN = 220
const INTERVAL_MAX = 480

function createEventsDrawFn(cfg: Config): {
  drawFn: DrawFn
  reset: () => void
} {
  const pulses: EventPulse[] = []
  let frame = 0

  // Each timer fires on its own random cadence. Stagger initial fires so
  // they don't all burst at once on page load.
  const timers = Array.from({ length: EVENTS_TIMER_COUNT }, (_, i) =>
    Math.floor((i / EVENTS_TIMER_COUNT) * INTERVAL_MAX + Math.random() * 50)
  )

  function firePulse(dots: Dot[]) {
    if (!dots.length) return
    const dot = dots[Math.floor(Math.random() * dots.length)]!
    const ringCount = 2 + Math.floor(Math.random() * 2) // 2–3 rings
    // Rings travel far enough to pass through several dot-spacings
    const baseMaxR = cfg.spacing * 3 + Math.random() * cfg.spacing * 4

    pulses.push({
      rings: Array.from({ length: ringCount }, (_, i) => ({
        x: dot.x,
        y: dot.y,
        r: 0,
        maxR: baseMaxR + i * cfg.spacing * 1.5,
        delay: i * 12, // stagger successive rings
        speed: 0.14 + Math.random() * 0.1, // slow — so the ripple is visible
      })),
    })
  }

  const drawFn: DrawFn = (ctx, dots, _t, w, h, isLight) => {
    const ACCENT = isLight ? cfg.accentLight : cfg.accentDark
    const DOT = isLight ? cfg.dotLight : cfg.dotDark

    // Illumination half-width: how thick the "lit band" is around the
    // wavefront. ~1.3× spacing means roughly one ring of neighbours lights up.
    const SPREAD = cfg.spacing * 1.35

    ctx.clearRect(0, 0, w, h)

    // ── Compute per-dot brightness from all active wavefronts ───────────────
    // brightness[i] in [0, 1]; accumulates contributions from every ring.
    const brightness = new Float32Array(dots.length)

    for (const pulse of pulses) {
      for (const ring of pulse.rings) {
        if (ring.delay > 0 || ring.r <= 0) continue
        // Ring overall fade: ease-out squared so it dims as it travels
        const fade = Math.max(0, 1 - ring.r / ring.maxR)
        if (fade <= 0) continue
        const ringFade = fade * fade

        for (const [di, dot] of dots.entries()) {
          const d = dot!
          const dx = d.x - ring.x
          const dy = d.y - ring.y
          const dist = Math.hypot(dx, dy)
          const delta = Math.abs(dist - ring.r)

          if (delta < SPREAD) {
            // Smooth bell curve peaking exactly at the wavefront
            const proximity = 1 - delta / SPREAD
            const b = proximity * proximity * ringFade
            if (b > brightness[di]!) brightness[di] = b
          }
        }
      }
    }

    // ── Draw dots ───────────────────────────────────────────────────────────
    for (const [i, dot] of dots.entries()) {
      const d = dot!
      const b = brightness[i]!

      // Soft radial glow for visibly illuminated dots
      if (b > 0.12) {
        const glowR = cfg.spacing * 0.9 * b
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowR)
        g.addColorStop(
          0,
          `rgba(${ACCENT},${(b * (isLight ? 0.12 : 0.18)).toFixed(3)})`
        )
        g.addColorStop(1, `rgba(${ACCENT},0)`)
        ctx.beginPath()
        ctx.arc(d.x, d.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
      }

      // Dot radius and alpha scale with brightness
      const radius = 1 + b * 2.2
      const alpha =
        b > 0.05 ? 0.08 + b * (isLight ? 0.5 : 0.65) : isLight ? 0.08 : 0.07

      ctx.beginPath()
      ctx.arc(d.x, d.y, radius, 0, Math.PI * 2)
      ctx.fillStyle =
        b > 0.05
          ? `rgba(${ACCENT},${alpha.toFixed(3)})`
          : `rgba(${DOT},${alpha.toFixed(3)})`
      ctx.fill()
    }

    // ── Trigger new pulses — each timer fires independently ─────────────────
    for (let ti = 0; ti < timers.length; ti++) {
      if (frame >= timers[ti]!) {
        firePulse(dots)
        timers[ti] =
          frame +
          INTERVAL_MIN +
          Math.floor(Math.random() * (INTERVAL_MAX - INTERVAL_MIN))
      }
    }

    // ── Advance rings; expire completed pulses ──────────────────────────────
    let i = 0
    while (i < pulses.length) {
      const pulse = pulses[i]!
      let alive = false

      for (const ring of pulse.rings) {
        if (ring.delay > 0) {
          ring.delay--
          alive = true
          continue
        }
        ring.r += ring.speed
        if (ring.r < ring.maxR) alive = true
      }

      if (alive) i++
      else pulses.splice(i, 1)
    }

    frame++
  }

  const reset = () => {
    pulses.length = 0
    frame = 0
    for (let ti = 0; ti < timers.length; ti++) {
      timers[ti] = Math.floor(
        (ti / timers.length) * INTERVAL_MAX + Math.random() * 50
      )
    }
  }

  return { drawFn, reset }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DotHeroCanvas({
  variant = "aurora",
}: {
  readonly variant?: DotHeroVariant
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const cfg = CONFIGS[variant]

    // Events variant uses a stateful draw factory; others are pure functions
    let draw: DrawFn
    let onRebuild = () => {}
    if (variant === "events") {
      const eventsState = createEventsDrawFn(cfg)
      draw = eventsState.drawFn
      onRebuild = eventsState.reset
    } else {
      draw = variant === "aurora" ? drawAurora : drawRadial
    }

    let raf: number
    let t = 0
    let dots: Dot[] = []

    const rebuild = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      dots = buildDots(canvas.width, canvas.height, cfg.spacing)
      onRebuild()
    }

    rebuild()
    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)

    const tick = () => {
      t += cfg.speed
      const isLight =
        document.documentElement.classList.contains("light") ||
        document.documentElement.dataset.theme === "light"
      draw(ctx, dots, t, canvas.width, canvas.height, isLight, cfg)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ display: "block" }}
    />
  )
}
