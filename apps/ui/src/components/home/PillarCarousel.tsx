"use client"

import { Children, useEffect, useState, type ReactNode } from "react"

import {
  Carousel,
  CarouselContent,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"

/** Manual, keyboard-operable carousel; never advances while someone is reading. */
export function PillarCarousel({ children }: { readonly children: ReactNode }) {
  const count = Children.count(children)
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(1)
  useEffect(() => {
    if (!api) return
    const select = () => setCurrent(api.selectedScrollSnap() + 1)
    select()
    api.on("select", select)
    api.on("reInit", select)

    return () => {
      api.off("select", select)
      api.off("reInit", select)
    }
  }, [api])

  return (
    <Carousel
      setApi={setApi}
      opts={{
        // Centre the two-card window, leaving a neighbour visible at each edge.
        align: (viewSize, slideSize) => (viewSize - slideSize * 2 + 24) / 2,
        loop: true,
        slidesToScroll: 1,
        breakpoints: {
          "(max-width: 760px)": {
            align: (viewSize, slideSize) => (viewSize - slideSize + 12) / 2,
          },
          "(prefers-reduced-motion: reduce)": { duration: 0 },
        },
      }}
      aria-label="Pillar institutions"
      className="home-pillar-carousel"
    >
      <CarouselContent className="home-pillar-track">
        {children}
      </CarouselContent>
      {count > 1 ? (
        <div className="home-frame">
          <div className="home-carousel-controls">
            <span aria-live="polite" aria-atomic="true">
              {current} / {count}
            </span>
            <div>
              <CarouselPrevious className="static translate-y-0" />
              <CarouselNext className="static translate-y-0" />
            </div>
          </div>
        </div>
      ) : null}
    </Carousel>
  )
}
