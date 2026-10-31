"use client"

import { ArrowUpRight, Globe } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"

import GlobalLink from "@/components/global/GlobalLink"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import { HOMEPAGE_GLOBE_APPEARANCE } from "@/components/home/knowledge-globe-settings"
import type { GlobeOverrides } from "@/components/home/KnowledgeGlobeCanvas"

function GlobePlaceholder({
  unavailable = false,
}: {
  readonly unavailable?: boolean
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-[#C9C7D8]"
    >
      <Globe aria-hidden="true" className="size-10 text-[#B9B4F5]" />
      <p className="m-0 text-sm">
        {unavailable
          ? "Explore library locations in the atlas"
          : "Loading globe…"}
      </p>
    </div>
  )
}

const GlobeCanvas = dynamic(
  () => import("@/components/home/KnowledgeGlobeCanvas"),
  { ssr: false, loading: () => <GlobePlaceholder /> }
)

const PREVIEW_SETTINGS: GlobeOverrides = {
  ...HOMEPAGE_GLOBE_APPEARANCE,
  autoRotate: true,
  autoRotateSpeed: 0.17,
  globePitch: 20,
  globeYaw: 25,
  fitRadius: 0.42,
  globeY: 0,
  interactive: true,
  minPolarAngle: Math.PI * 0.08,
  maxPolarAngle: Math.PI * 0.92,
}

/** The hero's canvas globe, centered and rotatable, with an Atlas CTA.
 * Mount near the viewport and pause rendering while the preview is offscreen. */
export default function AtlasGlobePreview({
  markers,
  href,
}: {
  readonly markers: readonly LibraryMarker[]
  readonly href: string
}) {
  const t = useTranslations("ui")
  const containerRef = useRef<HTMLElement>(null)
  const [hasEntered, setHasEntered] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting)
        setActive(visible)
        if (visible) setHasEntered(true)
      },
      { rootMargin: "240px" }
    )
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  return (
    <figure
      ref={containerRef}
      className="m-0 flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-[#4A4866] bg-[#1D1C33]"
    >
      <div className="[container-type:size] relative aspect-square w-full shrink-0 lg:aspect-auto lg:min-h-[500px] lg:flex-1">
        <div className="absolute inset-0 cursor-grab active:cursor-grabbing">
          {hasEntered ? (
            <ErrorBoundary fallback={<GlobePlaceholder unavailable />}>
              <GlobeCanvas
                markers={markers}
                overrides={PREVIEW_SETTINGS}
                active={active}
              />
            </ErrorBoundary>
          ) : (
            <GlobePlaceholder />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-5 top-[calc(50%_+_min(28cqw,28cqh))] flex -translate-y-1/2 justify-center">
          <GlobalLink
            href={href}
            {...homepageLinkAttributes(href)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-(--t-bg-deep) px-6 py-3.5 text-sm font-semibold text-(--t-ink-base) no-underline shadow-[0_4px_24px_#17162B80] transition-colors hover:bg-(--t-accent-chip) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#B9B4F5]"
          >
            {t("about_the_project")}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </GlobalLink>
        </div>
        <p className="pointer-events-none absolute inset-x-5 bottom-5 m-0 text-center text-xs text-[#C9C7D8]">
          Drag to rotate · Arrow keys when focused
        </p>
      </div>
      <figcaption className="border-t border-[#4A4866] px-6 py-6 sm:px-8 sm:py-7">
        <h3 className="type-h3 m-0 text-white">How the globe lights up</h3>
        <p className="mt-3 mb-0 text-base leading-[1.65] text-[#C9C7D8]">
          Warm lights show where published library records are located. Brighter
          hubs mark featured principal libraries. Arcs join these hubs to nearby
          featured libraries, illustrating a shared world of knowledge.
        </p>
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs text-[#C9C7D8]">
          <li className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[#F2C879]"
            />
            Published locations
          </li>
          <li className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full bg-[#FFE2A8] shadow-[0_0_8px_#F2C879]"
            />
            Principal libraries
          </li>
          <li className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-4 rounded-t-full border-t border-[#F2C879]"
            />
            Illustrative links
          </li>
        </ul>
      </figcaption>
    </figure>
  )
}
