"use client"

import { ArrowUpRight } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import type { AboutLibrary } from "@/components/about/about.types"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import SectionHeader from "@/components/home/sections/SectionHeader"

/** A full-width strip of CMS photographs. Vertical scrolling moves the strip;
 * mobile and reduced-motion visitors read the same records in a normal grid. */
export function AboutPhotoSequence({
  libraries,
}: {
  readonly libraries: readonly AboutLibrary[]
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const section = sectionRef.current
    const stage = stageRef.current
    const content = contentRef.current
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!section || !stage || !content || !viewport || !track) return

    const desktop = window.matchMedia("(min-width: 1024px)")
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const stickyTop = 57
    let travel = 0
    let scrollDistance = 1
    let frame = 0
    let visible = false
    let lastIndex = 0
    let centers: number[] = []
    let disposed = false

    const render = () => {
      frame = 0
      if (!travel) return
      const fraction = Math.min(
        1,
        Math.max(
          0,
          (stickyTop - section.getBoundingClientRect().top) / scrollDistance
        )
      )
      const offset = fraction * travel
      track.style.transform = `translate3d(${-offset}px, 0, 0)`
      const center = offset + track.clientWidth / 2
      const index = centers.reduce(
        (nearest, position, index) =>
          Math.abs(position - center) < Math.abs(centers[nearest]! - center)
            ? index
            : nearest,
        0
      )
      if (index !== lastIndex) {
        lastIndex = index
        setCurrent(index)
      }
    }
    const schedule = () => {
      if (visible && travel && !frame) frame = requestAnimationFrame(render)
    }
    const measure = () => {
      if (disposed) return
      cancelAnimationFrame(frame)
      frame = 0
      travel = 0
      const enabled = desktop.matches && !motion.matches && libraries.length > 1
      section.dataset.scrolling = String(enabled)
      if (!enabled) {
        section.style.removeProperty("height")
        track.style.removeProperty("transform")

        return
      }
      // Measure the content itself, rather than an already fixed-height stage.
      if (content.offsetHeight > window.innerHeight - stickyTop - 32) {
        section.dataset.scrolling = "false"
        section.style.removeProperty("height")
        track.style.removeProperty("transform")

        return
      }
      travel = Math.max(0, track.scrollWidth - track.clientWidth)
      centers = Array.from(track.children).map((card) => {
        const element = card as HTMLElement

        return element.offsetLeft + element.offsetWidth / 2
      })
      scrollDistance =
        (window.innerHeight - stickyTop) *
        Math.max(1, (libraries.length - 1) * 0.65)
      section.style.height = `${stage.offsetHeight + scrollDistance}px`
      render()
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible) schedule()
    })
    const resize = new ResizeObserver(measure)
    intersection.observe(section)
    resize.observe(viewport)
    desktop.addEventListener("change", measure)
    motion.addEventListener("change", measure)
    window.addEventListener("resize", measure)
    window.addEventListener("scroll", schedule, { passive: true })
    measure()
    document.fonts.ready.then(measure)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      intersection.disconnect()
      resize.disconnect()
      desktop.removeEventListener("change", measure)
      motion.removeEventListener("change", measure)
      window.removeEventListener("resize", measure)
      window.removeEventListener("scroll", schedule)
      delete section.dataset.scrolling
      section.style.removeProperty("height")
      track.style.removeProperty("transform")
    }
  }, [libraries.length])

  const library = libraries[current] ?? libraries[0]
  if (!library) return null

  return (
    <section
      ref={sectionRef}
      id="shared-purpose"
      className="about-photo-sequence"
      aria-labelledby="about-photos-title"
    >
      <div ref={stageRef} className="about-photo-stage">
        <div ref={contentRef} className="about-photo-content">
          <Container>
            <p className="about-eyebrow">National libraries in the index</p>
            <SectionHeader
              id="about-photos-title"
              textBeside
              intro={{
                title: "A shared *purpose.*",
                text: "National libraries preserve a country's published work and make it available for study. These are some of the institutions recorded in Libraries Global.",
              }}
            />
          </Container>
          <div ref={viewportRef} className="about-photo-viewport">
            <div ref={trackRef} className="about-photo-track">
              {libraries.map((record) => (
                <figure className="about-photo-card" key={record.documentId}>
                  <div className="about-photo-frame">
                    <Image
                      src={record.image}
                      alt={record.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 82vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <figcaption>
                    <p className="about-photo-place">{record.place}</p>
                    <h3>{record.name}</h3>
                    {record.summary ? <p>{record.summary}</p> : null}
                    {record.href ? (
                      <GlobalLink
                        href={record.href}
                        className="about-text-link"
                      >
                        Visit the record{" "}
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </GlobalLink>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
          <Container>
            <div className="about-photo-current">
              <div>
                <p className="about-eyebrow">{library.place}</p>
                <h3>{library.name}</h3>
              </div>
              {library.href ? (
                <GlobalLink href={library.href} className="about-text-link">
                  Visit the record{" "}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </GlobalLink>
              ) : null}
            </div>
            <p className="about-photo-scroll-hint">
              Scroll to see more national libraries{" "}
              <span aria-hidden="true">→</span>
            </p>
          </Container>
        </div>
      </div>
    </section>
  )
}
