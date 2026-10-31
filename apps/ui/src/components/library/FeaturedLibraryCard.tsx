import { Clock, ImageOff } from "lucide-react"
import Image from "next/image"
import type { ComponentProps } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { summariseWeek } from "@/components/location/location-page.helpers"
import { T, tintForLibraryType, TYPE_TINT } from "@/lib/design-tokens"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

import styles from "./FeaturedLibraryCard.module.css"

const CARD_TINTS = [TYPE_TINT.public, TYPE_TINT.academic, TYPE_TINT.special]

/** The same featured library card on the homepage and place pages. */
export function FeaturedLibraryCard({
  name,
  libraryType,
  city,
  countryName,
  imageUrl,
  imageAlt,
  openingTimes,
  href,
  index = 0,
  summary,
  revealDetails = false,
  imageSizes,
  linkProps,
}: {
  readonly name?: string | null
  readonly libraryType?: string | null
  readonly city?: string | null
  readonly countryName?: string | null
  readonly imageUrl?: string | null
  readonly imageAlt?: string | null
  readonly openingTimes?: OpeningTimesValue | null
  readonly href: string | null
  readonly index?: number
  readonly summary?: string | null
  readonly revealDetails?: boolean
  readonly imageSizes?: string
  readonly linkProps?: Omit<
    ComponentProps<typeof GlobalLink>,
    "href" | "children" | "className" | "style"
  >
}) {
  const ground = CARD_TINTS[index % CARD_TINTS.length]!
  const typeTint = tintForLibraryType(libraryType)
  const imgUrl = formatStrapiMediaUrl(imageUrl)
  const location = [city, countryName].filter(Boolean).join(", ")

  return (
    <GlobalLink
      {...linkProps}
      href={href}
      className={`group relative flex h-[clamp(420px,36vw,520px)] flex-col overflow-hidden rounded-[24px] border no-underline transition-colors hover:border-(--t-accent-primary) ${revealDetails ? styles.revealDetails : ""}`}
      style={{ background: ground.bg, borderColor: T.border.line }}
    >
      {imgUrl ? (
        <Image
          src={imgUrl}
          alt={imageAlt ?? name ?? ""}
          fill
          sizes={imageSizes ?? "(min-width: 1024px) 440px, 100vw"}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          className="flex flex-1 flex-col items-center justify-center gap-1.5 pb-28 text-sm font-medium"
          style={{ color: ground.fg }}
        >
          <ImageOff aria-hidden="true" className="size-5" strokeWidth={1.6} />
          No photo yet
        </span>
      )}

      <div className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-2 rounded-[18px] bg-(--t-bg-deep) p-5">
        <span className="flex flex-wrap gap-1.5">
          {libraryType ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-sm font-semibold"
              style={{ background: typeTint.bg, color: typeTint.fg }}
            >
              {libraryType} library
            </span>
          ) : null}
          {location ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-sm font-semibold"
              style={{ background: T.bg.space, color: T.ink.base }}
            >
              {location}
            </span>
          ) : null}
        </span>
        <h3
          className="type-h3 m-0 transition-colors group-hover:text-(--t-accent-primary)"
          style={{
            color: T.ink.base,
          }}
        >
          {name}
        </h3>
        <div className={revealDetails ? styles.details : undefined}>
          <div className={revealDetails ? styles.detailsInner : undefined}>
            {summary ? (
              <p className="m-0 mb-3 line-clamp-3 text-base leading-relaxed text-(--t-ink-dim)">
                {summary}
              </p>
            ) : null}
            <span
              className="flex items-center gap-1.5 text-sm"
              style={{ color: T.ink.dim }}
            >
              <Clock
                aria-hidden="true"
                className="size-3.5 shrink-0"
                strokeWidth={1.7}
              />
              {summariseWeek(openingTimes) ?? "Hours not added yet"}
            </span>
          </div>
        </div>
      </div>
    </GlobalLink>
  )
}
