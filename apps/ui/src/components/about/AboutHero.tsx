"use client"

import {
  ArrowDown,
  ArrowUpRight,
  Globe2,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { globeInteractionReady } from "@/components/about/about-globe-geography"
import type { AboutGlobeCountry } from "@/components/about/about-globe.types"
import { AboutGlobeExplorer } from "@/components/about/AboutGlobeExplorer"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import { displayStyle } from "@/components/home/homepage.constants"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import { HOMEPAGE_GLOBE_APPEARANCE } from "@/components/home/knowledge-globe-settings"
import type { GlobeOverrides } from "@/components/home/KnowledgeGlobeCanvas"
import { T } from "@/lib/design-tokens"

function GlobePlaceholder() {
  return (
    <div className="about-globe-placeholder">
      <Globe2 className="size-12" strokeWidth={1} aria-hidden="true" />
    </div>
  )
}

const GlobeCanvas = dynamic(
  () => import("@/components/home/KnowledgeGlobeCanvas"),
  { ssr: false, loading: () => <GlobePlaceholder /> }
)

const ABOUT_GLOBE: GlobeOverrides = {
  ...HOMEPAGE_GLOBE_APPEARANCE,
  fitRadius: 0.49,
  globeY: 0,
  autoRotate: true,
  autoRotateSpeed: 0.12,
  minPolarAngle: Math.PI * 0.08,
  maxPolarAngle: Math.PI * 0.92,
}

const REVEAL_SCROLL = 0.8
const PINNED_SCROLL = 0.9

/** One mounted, rotatable globe. Only its hero frame moves on scroll; the
 * shared renderer and the rest of the document have no narrative timeline. */
export function AboutHero({
  markers,
  countries,
}: {
  readonly markers: readonly LibraryMarker[]
  readonly countries: readonly AboutGlobeCountry[]
}) {
  const heroRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [coarsePointer, setCoarsePointer] = useState(false)
  const [touchRotation, setTouchRotation] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [interactionReady, setInteractionReady] = useState(false)
  const [scrollStory, setScrollStory] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const settings = useMemo(
    () => ({
      ...ABOUT_GLOBE,
      interactive: !coarsePointer || touchRotation,
    }),
    [coarsePointer, touchRotation]
  )

  useEffect(() => {
    const hero = heroRef.current
    const stage = stageRef.current
    const copy = copyRef.current
    if (!hero || !stage || !copy) return
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const desktop = window.matchMedia(
      "(min-width: 1024px) and (min-height: 700px)"
    )
    const pointer = window.matchMedia("(pointer: coarse)")
    let visible = true
    let frame = 0
    let story = false
    let lastExpanded = false
    let lastReady = false
    let openingOffset = 0

    const syncActivity = () => setActive(visible && !document.hidden)
    const render = () => {
      frame = 0
      const progress = story
        ? Math.min(
            1,
            Math.max(
              0,
              (57 - hero.getBoundingClientRect().top) /
                (stage.offsetHeight * REVEAL_SCROLL)
            )
          )
        : 1
      const eased = progress * progress * (3 - 2 * progress)
      stage.style.setProperty(
        "--about-globe-y",
        `${(1 - eased) * openingOffset}px`
      )
      stage.style.setProperty(
        "--about-copy-opacity",
        String(Math.max(0, 1 - progress * 2))
      )
      stage.style.setProperty("--about-copy-y", `${-progress * 64}px`)
      stage.style.setProperty(
        "--about-guide-opacity",
        String(Math.min(1, Math.max(0, (progress - 0.55) / 0.3)))
      )
      const globeFrame = hero
        .querySelector(".about-hero-globe")
        ?.getBoundingClientRect()
      const ready = Boolean(
        globeFrame &&
        globeInteractionReady(
          progress,
          story,
          globeFrame.top,
          globeFrame.bottom,
          window.innerHeight
        )
      )
      if (ready !== lastReady) {
        lastReady = ready
        setInteractionReady(ready)
      }
      const nextExpanded = !story || progress > 0.62
      if (lastExpanded !== nextExpanded) {
        lastExpanded = nextExpanded
        setExpanded(nextExpanded)
      }
    }
    const schedule = () => {
      if (visible && !frame) frame = requestAnimationFrame(render)
    }
    const measure = () => {
      story = desktop.matches && !motion.matches
      setScrollStory(story)
      hero.dataset.story = String(story)
      const stageHeight = stage.offsetHeight
      const radius =
        Math.min(stage.clientWidth, stageHeight) * ABOUT_GLOBE.fitRadius!
      openingOffset = Math.max(
        0,
        copy.offsetTop + copy.offsetHeight + 32 - stageHeight / 2 + radius
      )
      hero.style.height = story ? `${stageHeight * (1 + PINNED_SCROLL)}px` : ""
      setReducedMotion(motion.matches)
      setCoarsePointer(pointer.matches)
      render()
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      syncActivity()
      if (visible) schedule()
    })
    const resize = new ResizeObserver(measure)
    intersection.observe(hero)
    resize.observe(stage)
    resize.observe(copy)
    motion.addEventListener("change", measure)
    desktop.addEventListener("change", measure)
    pointer.addEventListener("change", measure)
    document.addEventListener("visibilitychange", syncActivity)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", schedule, { passive: true })
    measure()
    syncActivity()

    return () => {
      cancelAnimationFrame(frame)
      intersection.disconnect()
      resize.disconnect()
      motion.removeEventListener("change", measure)
      desktop.removeEventListener("change", measure)
      pointer.removeEventListener("change", measure)
      document.removeEventListener("visibilitychange", syncActivity)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", schedule)
    }
  }, [])

  const exploreGlobe = () => {
    const hero = heroRef.current
    const stage = stageRef.current
    if (!hero || !stage) return
    if (hero.dataset.story === "true") {
      window.scrollTo({
        top:
          hero.getBoundingClientRect().top +
          window.scrollY +
          stage.offsetHeight * REVEAL_SCROLL -
          57,
        behavior: reducedMotion ? "instant" : "smooth",
      })
    } else {
      hero.querySelector(".about-hero-globe")?.scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "center",
      })
    }
  }

  return (
    <section ref={heroRef} className="about-hero" aria-labelledby="about-title">
      <div ref={stageRef} className="about-hero-stage" data-expanded={expanded}>
        <Container>
          <div
            ref={copyRef}
            className="about-hero-copy"
            inert={scrollStory && expanded ? true : undefined}
          >
            <p className="about-eyebrow about-hero-eyebrow">
              About Libraries Global
            </p>
            <h1
              id="about-title"
              className="m-0 text-balance"
              style={{
                ...displayStyle("hero"),
              }}
            >
              <Emphasis
                text="An open record of *the world's libraries.*"
                emStyle={{ color: T.accent.primary }}
              />
            </h1>
            <p className="about-hero-intro">
              Find a library, see what it offers and plan a visit. Libraries
              Global brings together public sources and contributions from the
              people who know each place.
            </p>
            <div className="about-hero-actions">
              <GlobalLink href="/libraries" className="about-button">
                Explore the index{" "}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </GlobalLink>
              <button
                type="button"
                onClick={exploreGlobe}
                className="about-button about-button-secondary"
              >
                Explore the globe{" "}
                <ArrowDown className="size-4" aria-hidden="true" />
              </button>
            </div>
            <GlobalLink
              href="#our-purpose"
              className="about-text-link about-hero-skip"
            >
              Read about the project{" "}
              <ArrowDown className="size-4" aria-hidden="true" />
            </GlobalLink>
          </div>
        </Container>
        <div className="about-hero-globe">
          <div className="about-hero-globe-canvas">
            <ErrorBoundary fallback={<GlobePlaceholder />}>
              <AboutGlobeExplorer
                enabled={interactionReady && active}
                allowRotation={!coarsePointer || touchRotation}
                countries={countries}
                markers={markers}
              >
                {({ layer, rotationScale, view }) => (
                  <GlobeCanvas
                    markers={markers}
                    overrides={{
                      ...settings,
                      autoRotateSpeed:
                        ABOUT_GLOBE.autoRotateSpeed! * rotationScale,
                    }}
                    active={active}
                    motionPaused={paused || reducedMotion}
                    resetKey={resetKey}
                    view={view}
                    interactionLayer={layer}
                  />
                )}
              </AboutGlobeExplorer>
            </ErrorBoundary>
          </div>
        </div>
        <div
          className="about-globe-guide"
          id="about-globe-guide"
          inert={!expanded ? true : undefined}
        >
          <p className="about-eyebrow">Reading the globe</p>
          <h2 className="type-h2">Where the record reaches.</h2>
          {markers.length > 0 ? (
            <>
              <p>
                Warm lights show published library locations, grouped at world
                scale. Brighter points mark featured libraries.
              </p>
              <p>
                The arcs are illustrative links between nearby featured
                libraries.
              </p>
              <p>
                An unlit area is a gap in the index. There may be libraries
                there that we haven&apos;t recorded yet.
              </p>
            </>
          ) : (
            <p>
              Location data is unavailable at the moment. You can still browse
              library records in the index.
            </p>
          )}
          <GlobalLink href="/map" className="about-text-link">
            Open the atlas{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </GlobalLink>
        </div>
        <div className="about-globe-controls">
          <p>
            {coarsePointer
              ? touchRotation
                ? "Drag to rotate · Tap Done to continue scrolling"
                : "Scroll to continue · Tap Rotate to explore"
              : interactionReady
                ? "Hover a country or connection · Click to pin · Esc to close"
                : "Drag to rotate · Arrow keys when focused"}
          </p>
          <div>
            {coarsePointer ? (
              <button
                type="button"
                className="about-motion-toggle"
                onClick={() => setTouchRotation((value) => !value)}
                aria-pressed={touchRotation}
              >
                {touchRotation ? "Done" : "Rotate"}
              </button>
            ) : null}
            <button
              type="button"
              className="about-motion-toggle"
              onClick={() => setPaused((value) => !value)}
              disabled={reducedMotion}
              aria-label={
                reducedMotion
                  ? "Globe motion disabled by your reduced-motion preference"
                  : paused
                    ? "Play globe motion"
                    : "Pause globe motion"
              }
              aria-pressed={!paused && !reducedMotion}
            >
              {paused || reducedMotion ? (
                <Play className="size-3.5" aria-hidden="true" />
              ) : (
                <Pause className="size-3.5" aria-hidden="true" />
              )}
              <span>
                {paused || reducedMotion ? "Motion paused" : "Pause motion"}
              </span>
            </button>
            <button
              type="button"
              className="about-motion-toggle"
              onClick={() => setResetKey((value) => value + 1)}
              aria-label="Reset globe rotation"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
