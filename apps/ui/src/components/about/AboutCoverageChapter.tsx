"use client"

/* motion-site · profile: editorial · archetype: full-height coverage chapter · patterns: sequential-country-build·shared-counter-clock·viewport-gating · critique: P5 T4 C5 R5 A5 V5 */

import { Pause, Play, RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState, type ReactNode } from "react"

import {
  aboutViewport,
  setAboutViewport,
} from "@/components/about/about-viewport"
import {
  coverageFrame,
  coverageTimeline,
} from "@/components/about/coverage-timeline"
import { Container } from "@/components/elementary/Container"

type Playback = "idle" | "playing" | "paused" | "complete"

/** A single native animation clock keeps the continents sequential. The server
 * renders final values; only aria-hidden visual copies count up after hydration. */
export function AboutCoverageChapter({
  children,
  footer,
}: {
  readonly children: ReactNode
  readonly footer: ReactNode
}) {
  const t = useTranslations("aboutCoverage")
  const ref = useRef<HTMLDivElement>(null)
  const actions = useRef({ pause: () => {}, replay: () => {} })
  const [enabled, setEnabled] = useState(false)
  const [playback, setPlayback] = useState<Playback>("idle")

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
      paused = false,
      completed = false,
      started = false
    let prepared = false,
      disposed = false,
      awaitingReplay = false
    let owner: HTMLElement | null = null
    let oldSnapTop = ""

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
    const releaseOwner = () => {
      if (!owner) return
      owner.classList.remove("about-coverage-scroll-root")
      if (oldSnapTop) owner.style.setProperty("--coverage-snap-top", oldSnapTop)
      else owner.style.removeProperty("--coverage-snap-top")
      owner = null
    }
    const finish = () => {
      cancelAnimationFrame(frame)
      frame = 0
      elapsed = duration
      completed = true
      paint()
      setPlayback("complete")
    }
    const tick = (now: number) => {
      frame = 0
      if (
        paused ||
        completed ||
        !visible ||
        document.hidden ||
        motion.matches
      ) {
        lastTime = 0

        return
      }
      const viewport = aboutViewport(chapter)
      const bounds = chapter.getBoundingClientRect()
      if (bounds.bottom <= viewport.top || bounds.top >= viewport.bottom) {
        lastTime = 0

        return
      }
      if (awaitingReplay) {
        if (
          bounds.top < viewport.top - 4 ||
          bounds.top > viewport.top + viewport.height * 0.3
        ) {
          lastTime = 0

          return
        }
        awaitingReplay = false
      }
      if (!started) {
        if (bounds.top > viewport.top + viewport.height * 0.3) return
        started = true
        setPlayback("playing")
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
      if (
        !visible ||
        document.hidden ||
        paused ||
        completed ||
        motion.matches
      ) {
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0

        return
      }
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const measure = () => {
      if (disposed) return
      const viewport = setAboutViewport(chapter)
      const root = viewport.root ?? document.documentElement
      if (motion.matches) {
        finish()
        releaseOwner()
        setEnabled(false)

        return
      }
      if (root !== owner) {
        releaseOwner()
        owner = root
        oldSnapTop = owner.style.getPropertyValue("--coverage-snap-top")
        owner.classList.add("about-coverage-scroll-root")
      }
      owner.style.setProperty("--coverage-snap-top", `${viewport.stickyTop}px`)
      if (!prepared) {
        prepared = true
        paint()
        setPlayback("idle")
      }
      setEnabled(true)
      schedule()
    }
    const settled = () => {
      if (!awaitingReplay) return
      awaitingReplay = false
      schedule()
    }
    actions.current = {
      pause: () => {
        paused = !paused
        lastTime = 0
        setPlayback(paused ? "paused" : started ? "playing" : "idle")
        schedule()
      },
      replay: () => {
        cancelAnimationFrame(frame)
        frame = 0
        elapsed = 0
        lastTime = 0
        paused = completed = started = false
        paint()
        setPlayback("idle")
        const viewport = aboutViewport(chapter)
        const offset = chapter.getBoundingClientRect().top - viewport.top
        awaitingReplay = Math.abs(offset) > 4
        if (awaitingReplay)
          (viewport.root ?? window).scrollTo({
            top: offset + (viewport.root?.scrollTop ?? window.scrollY),
            behavior: "smooth",
          })
        schedule()
      },
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
    scrollTarget.addEventListener("scrollend", settled, { capture: true })
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
      scrollTarget.removeEventListener("scrollend", settled, true)
      releaseOwner()
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
      data-playback={playback}
    >
      {children}
      <Container className="about-coverage-chapter-footer">
        <div>{footer}</div>
        {enabled ? (
          <div className="about-coverage-playback">
            <button
              type="button"
              className="about-motion-toggle"
              disabled={playback === "complete"}
              onClick={() => actions.current.pause()}
            >
              {playback === "paused" ? (
                <Play size={15} aria-hidden="true" />
              ) : (
                <Pause size={15} aria-hidden="true" />
              )}
              {t(playback === "paused" ? "resume" : "pause")}
            </button>
            <button
              type="button"
              className="about-motion-toggle"
              onClick={() => actions.current.replay()}
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t("replay")}
            </button>
          </div>
        ) : null}
      </Container>
    </div>
  )
}
