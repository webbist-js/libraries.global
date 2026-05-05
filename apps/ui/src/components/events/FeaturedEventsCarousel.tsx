"use client"

import { useRef, useState } from "react"

import { SectionHeader } from "@/components/ds"
import { FeaturedEventCard } from "@/components/events/FeaturedEventCard"
import type { FeaturedEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

interface FeaturedEventsCarouselProps {
  readonly events: FeaturedEvent[]
}

export function FeaturedEventsCarousel({
  events,
}: FeaturedEventsCarouselProps) {
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  if (events.length === 0) return null

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(events.length - 1, index))
    setCurrent(clamped)
    trackRef.current?.children[clamped]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    })
  }

  return (
    <section style={{ padding: "40px 0", overflow: "hidden" }}>
      <div style={{ maxWidth: "1296px", margin: "0 auto", padding: "0 24px" }}>
        {/* Heading + controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <SectionHeader italic="this week.">Featured</SectionHeader>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Counter */}
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.ghost,
              }}
            >
              {current + 1} of {events.length} · Carousel
            </span>

            {/* Arrows */}
            <div style={{ display: "flex", gap: "6px" }}>
              {(["prev", "next"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() =>
                    goTo(dir === "prev" ? current - 1 : current + 1)
                  }
                  disabled={
                    dir === "prev"
                      ? current === 0
                      : current === events.length - 1
                  }
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: `1px solid ${T.border.line}`,
                    background: "transparent",
                    color:
                      (dir === "prev" && current === 0) ||
                      (dir === "next" && current === events.length - 1)
                        ? T.ink.ghost
                        : T.ink.dim,
                    cursor:
                      (dir === "prev" && current === 0) ||
                      (dir === "next" && current === events.length - 1)
                        ? "default"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    transition: "all 150ms",
                  }}
                >
                  {dir === "prev" ? "‹" : "›"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
          }}
          className="carousel-track"
        >
          {events.map((event) => (
            <div
              key={event.documentId}
              style={{
                width: "100%",
                flexShrink: 0,
                scrollSnapAlign: "start",
              }}
            >
              <FeaturedEventCard event={event} />
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            marginTop: "16px",
          }}
        >
          {events.map((event, i) => (
            <button
              key={event.documentId}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === current ? "20px" : "6px",
                height: "6px",
                borderRadius: "3px",
                border: "none",
                background: i === current ? T.accent.aurora : T.border.hi,
                cursor: "pointer",
                transition: "all 200ms",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`.carousel-track::-webkit-scrollbar { display: none; }`}</style>
    </section>
  )
}
