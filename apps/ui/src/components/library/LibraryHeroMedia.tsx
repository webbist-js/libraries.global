"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

type Photo = { url: string; alt?: string | null; caption?: string | null }

export function LibraryHeroMedia({
  photo,
  name,
  caption,
  gallery = [],
  tourUrl,
  map,
  mapLabel = "Map",
  atlasHref,
  photoAction,
}: {
  readonly atlasHref?: string | null
  readonly photoAction?: ReactNode
  readonly photo: string | null
  readonly name: string
  readonly caption?: string | null
  readonly gallery?: readonly Photo[]
  readonly tourUrl?: string | null
  readonly map: ReactNode
  readonly mapLabel?: string
}) {
  const t = useTranslations("libraryPage")
  const photos = [
    ...(photo ? [{ url: photo, alt: name, caption }] : []),
    ...gallery.filter((item) => item.url !== photo),
  ]
  const [view, setView] = useState<"photo" | "map">(
    photos.length ? "photo" : "map"
  )
  const [selected, setSelected] = useState(0)
  const current = photos[selected % Math.max(1, photos.length)]

  return (
    <div className="library-hero-media">
      {photos.length || tourUrl ? (
        <div
          className="library-media-switch flex flex-wrap gap-1"
          role="group"
          aria-label="Library media"
        >
          {photos.length ? (
            <button
              type="button"
              aria-pressed={view === "photo"}
              onClick={() => setView("photo")}
              className="min-h-11 rounded-full border px-4 text-sm"
              style={{
                background: view === "photo" ? T.accent.chip : T.bg.deep,
                borderColor: T.border.line,
              }}
            >
              {photos.length > 1 ? `Photos (${photos.length})` : "Photo"}
            </button>
          ) : null}
          {map ? (
            <button
              type="button"
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
              className="min-h-11 rounded-full border px-4 text-sm"
              style={{
                background: view === "map" ? T.accent.chip : T.bg.deep,
                borderColor: T.border.line,
              }}
            >
              {mapLabel}
            </button>
          ) : null}
          {tourUrl && /^https?:\/\//.test(tourUrl) ? (
            <a
              href={tourUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm"
              style={{ borderColor: T.border.line }}
            >
              Virtual tour ↗
            </a>
          ) : null}
        </div>
      ) : null}
      {current && view === "photo" ? (
        <figure className="m-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={current.url}
              alt={current.alt || name}
              fill
              loading="eager"
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover"
            />
            {atlasHref ? (
              <GlobalLink
                href={atlasHref}
                className="absolute bottom-4 left-4 inline-flex min-h-11 items-center rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold shadow-sm"
                style={{ borderColor: T.border.line }}
              >
                {t("openAtlas")} ↗
              </GlobalLink>
            ) : null}
          </div>
          {current.caption ? (
            <figcaption className="mt-2 text-xs" style={{ color: T.ink.dim }}>
              {current.caption}
            </figcaption>
          ) : null}
          {photos.length > 1 ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() =>
                  setSelected(
                    (index) => (index + photos.length - 1) % photos.length
                  )
                }
                className="min-h-11 rounded-full border px-4"
              >
                ←
              </button>
              <span className="text-sm" aria-live="polite">
                Photo {selected + 1} of {photos.length}
              </span>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() =>
                  setSelected((index) => (index + 1) % photos.length)
                }
                className="min-h-11 rounded-full border px-4"
              >
                →
              </button>
            </div>
          ) : null}
        </figure>
      ) : (
        <div className="relative">
          {map}
          {photoAction ? (
            <div className="absolute top-4 right-4 z-1">{photoAction}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
