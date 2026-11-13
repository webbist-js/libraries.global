import { Globe } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import { homepageLinkAttributes } from "@/components/home/homepage.analytics"
import type { CtaBand } from "@/components/home/homepage.types"
import { ReachTownIllustration } from "@/components/home/ReachTownIllustration"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export function AtlasSection({
  band,
  image,
}: {
  readonly band: CtaBand
  readonly image?: {
    url?: string | null
    alternativeText?: string | null
  } | null
}) {
  const tStatic = useTranslations("staticUi")

  const imageUrl = formatStrapiMediaUrl(image?.url)

  return (
    <section
      className="home-frame home-atlas-wrap"
      aria-labelledby="atlas-title"
    >
      <div className="home-atlas-panel">
        <div>
          <p className="home-kicker home-atlas-eyebrow">
            <Globe size={14} strokeWidth={1.8} aria-hidden="true" />
            {tStatic("home.atlas")}
          </p>
          <h2 id="atlas-title" className="type-display-band">
            <Emphasis text={band.title ?? ""} />
          </h2>
          <p className="home-section-copy">{band.text}</p>
          <ul className="home-atlas-labels">
            <li>{tStatic("home.travelAnalysis")}</li>
            <li>{tStatic("home.reachFree")}</li>
            <li>{tStatic("home.mapFree")}</li>
          </ul>
          <div className="home-inline-links">
            <GlobalLink
              href={band.primaryHref}
              {...homepageLinkAttributes(band.primaryHref)}
              className="home-button home-button-light"
            >
              {band.primaryLabel}
            </GlobalLink>
            <GlobalLink
              href={band.secondaryHref}
              {...homepageLinkAttributes(band.secondaryHref)}
              className="home-text-link"
            >
              {band.secondaryLabel}
            </GlobalLink>
          </div>
        </div>
        <figure className="home-atlas-preview">
          <div className="home-atlas-image">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={image?.alternativeText ?? tStatic("home.atlasAlt")}
                fill
                sizes="(min-width: 1100px) 600px, 90vw"
              />
            ) : (
              <ReachTownIllustration />
            )}
          </div>
          <figcaption>
            <GlobalLink
              href="/map"
              {...homepageLinkAttributes("/map")}
              className="text-inherit no-underline after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
            >
              {imageUrl
                ? tStatic("home.exploreAccess")
                : tStatic("home.illustrativeTown")}
              <span className="sr-only"> · {band.primaryLabel}</span>
            </GlobalLink>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

export default AtlasSection
