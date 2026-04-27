"use client"

import { useEffect, useRef } from "react"

const SPACING = 26
const AURORA = "127,223,255"

interface Dot {
  x: number
  y: number
  px: number
  py: number
  pt: number
}

function buildDots(w: number, h: number): Dot[] {
  const cols = Math.ceil(w / SPACING) + 2
  const rows = Math.ceil(h / SPACING) + 2
  const out: Dot[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: c * SPACING - SPACING / 2,
        y: r * SPACING - SPACING / 2,
        px: 0.032 + Math.random() * 0.052,
        py: 0.025 + Math.random() * 0.042,
        pt: 0.16 + Math.random() * 0.42,
      })
    }
  }

  return out
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  dots: Dot[],
  t: number,
  w: number,
  h: number
) {
  ctx.clearRect(0, 0, w, h)
  for (const d of dots) {
    const s1 = Math.sin(d.x * d.px + t * d.pt)
    const s2 = Math.sin(d.y * d.py + t * d.pt * 0.68)
    const s3 = Math.sin(d.x * 0.016 + d.y * 0.013 + t * 0.11)
    const v = Math.max(0, Math.min(1, 0.5 + 0.38 * s1 * s2 + 0.12 * s3))

    const r = 1 + v * 1.6
    const alpha = 0.07 + v * 0.5
    const isAurora = v > 0.6

    if (v > 0.63) {
      const glowR = r * 7
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowR)
      const ga = ((v - 0.63) / 0.37) * 0.14
      g.addColorStop(0, `rgba(${AURORA},${ga.toFixed(3)})`)
      g.addColorStop(1, `rgba(${AURORA},0)`)
      ctx.beginPath()
      ctx.arc(d.x, d.y, glowR, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
    ctx.fillStyle = isAurora
      ? `rgba(${AURORA},${alpha.toFixed(3)})`
      : `rgba(180,205,235,${(alpha * 0.5).toFixed(3)})`
    ctx.fill()
  }
}

export function SettingsDotHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    let t = 0
    let dots: Dot[] = []

    const rebuild = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      dots = buildDots(canvas.width, canvas.height)
    }

    rebuild()
    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)

    const tick = () => {
      t += 0.007
      drawFrame(ctx, dots, t, canvas.width, canvas.height)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ display: "block" }}
    />
  )
}
