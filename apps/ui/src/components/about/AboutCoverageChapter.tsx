"use client"

/* motion-site · profile: editorial · archetype: coverage chapter in page flow · patterns: sequential-country-build·shared-counter-clock·viewport-gating */

import { useEffect, useRef, type ReactNode } from "react"

import {
  aboutViewport,
  setAboutViewport,
} from "@/components/about/about-viewport"
import {
  coverageFrame,
  coverageTimeline,
} from "@/components/about/coverage-timeline"
import { Container } from "@/components/elementary/Container"

/** A single native animation clock keeps the continents sequential. The server
 * renders final values; only aria-hidden visual copies count up after hydration.
 * The chapter scrolls with the page: it starts once well into view and plays
 * through once, waiting for each row to be readable. */
export function AboutCoverageChapter({
  children,
  footer,
}: {
  readonly children: ReactNode
  readonly footer: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const chapter = ref.current
    if (!chapter || typeof IntersectionObserver === "undefined") return
    const rows = Array.from(
      chapter.querySelectorAll<HTMLElement>("[data-coverage-row]")
    )
    const elements = rows.map((row) => ({
      row,
      total: row.querySelector<HTMLElement>("[data-coverage-total]"),
      countries: Array.from(
        row.querySelectorAll<HTMLElement>("[data-coverage-country]")
      ),
      segments: Array.from(
        row.querySelectorAll<HTMLElement>("[data-coverage-segment]")
      ),
    }))
    const plan = coverageTimeline(
      elements.map(({ row, countries }) => ({
        total: Number(row.dataset.coverageRow),
        countries: countries.map((country) =>
          Number(country.dataset.coverageCountry)
        ),
      }))
    )
    const duration = plan.at(-1)?.end ?? 0
    if (!duration) return
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const scrollTarget =
      chapter.closest<HTMLElement>(".dashboard-page") ?? window
    let frame = 0,
      elapsed = 0,
      lastTime = 0
    let visible = false,
      completed = false,
      started = false
    let prepared = false,
      disposed = false

    const text = (element: HTMLElement | null, value: number) => {
      const next = value.toLocaleString("en-US")
      if (element && element.textContent !== next) element.textContent = next
    }
    const paint = () => {
      for (const row of plan) {
        const nodes = elements[row.index]!
        const state = coverageFrame(row, elapsed)
        nodes.row.dataset.motionState = state.state
        text(nodes.total, state.total)
        state.countries.forEach((country, index) => {
          const label = nodes.countries[index]!
          text(
            label.querySelector<HTMLElement>("[data-coverage-country-count]"),
            country.value
          )
          label.style.opacity = String(country.reveal)
          label.style.transform = `translateY(${(1 - country.reveal) * 6}px)`
          if (nodes.segments[index])
            nodes.segments[index]!.style.transform =
              `scaleX(${country.progress})`
        })
      }
    }
    const finish = () => {
      cancelAnimationFrame(frame)
      frame = 0
      elapsed = duration
      completed = true
      paint()
    }
    const tick = (now: number) => {
      frame = 0
      if (completed || !visible || document.hidden || motion.matches) {
        lastTime = 0

        return
      }
      const viewport = aboutViewport(chapter)
      const bounds = chapter.getBoundingClientRect()
      if (bounds.bottom <= viewport.top || bounds.top >= viewport.bottom) {
        lastTime = 0

        return
      }
      if (!started) {
        if (bounds.top > viewport.top + viewport.height * 0.75) return
        started = true
      }
      // On smaller screens, wait for the next row to be readable. If a visitor
      // scrolls past a row, settle it instead of trapping the later rows at zero.
      let current = plan.find((row) => elapsed < row.end)
      while (
        current &&
        elements[current.index]!.row.getBoundingClientRect().bottom <=
          viewport.top
      ) {
        elapsed = current.end
        current = plan.find((row) => elapsed < row.end)
        paint()
      }
      if (!current) {
        finish()

        return
      }
      const activeBounds = elements[current.index]!.row.getBoundingClientRect()
      if (
        activeBounds.top + Math.min(120, activeBounds.height * 0.6) >
        viewport.bottom
      ) {
        lastTime = 0

        return
      }
      elapsed += lastTime ? Math.min(64, Math.max(0, now - lastTime)) : 0
      lastTime = now
      paint()
      if (elapsed >= duration) finish()
      else schedule()
    }
    function schedule() {
      if (disposed) return
      if (!visible || document.hidden || completed || motion.matches) {
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0

        return
      }
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const measure = () => {
      if (disposed) return
      setAboutViewport(chapter)
      if (motion.matches) {
        finish()

        return
      }
      if (!prepared) {
        prepared = true
        paint()
      }
      schedule()
    }
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false
        schedule()
      },
      { threshold: [0, 0.2, 0.5] }
    )
    const resize = new ResizeObserver(measure)
    intersection.observe(chapter)
    resize.observe(chapter)
    const initialRoot = aboutViewport(chapter).root
    if (initialRoot) resize.observe(initialRoot)
    motion.addEventListener("change", measure)
    window.addEventListener("resize", measure)
    document.addEventListener("visibilitychange", schedule)
    scrollTarget.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    })
    measure()
    document.fonts?.ready.then(measure)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      intersection.disconnect()
      resize.disconnect()
      motion.removeEventListener("change", measure)
      window.removeEventListener("resize", measure)
      document.removeEventListener("visibilitychange", schedule)
      scrollTarget.removeEventListener("scroll", schedule, true)
      elapsed = duration
      paint()
      for (const { row, countries, segments } of elements) {
        delete row.dataset.motionState
        for (const country of countries) {
          country.style.removeProperty("opacity")
          country.style.removeProperty("transform")
        }
        for (const segment of segments)
          segment.style.removeProperty("transform")
      }
    }
  }, [children])

  return (
    <div
      ref={ref}
      id="coverage-by-continent"
      className="about-coverage-chapter about-coverage-rows"
    >
      {children}
      <Container className="about-coverage-chapter-footer">
        <div>{footer}</div>
      </Container>
    </div>
  )
}
