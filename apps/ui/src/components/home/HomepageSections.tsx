import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget"
import ContributeCTA from "@/components/home/ContributeCTA"
import type {
  HomepageData,
  HomepageContinentSummary,
} from "@/components/home/homepage.types"
import BlogSection from "@/components/home/sections/BlogSection"
import ContentSection from "@/components/home/sections/ContentSection"
import ContinentTilesSection from "@/components/home/sections/ContinentTilesSection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import ServicesSection from "@/components/home/sections/ServicesSection"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

export function HomepageSections({
  continents,
  homepage,
  locale,
  blogArticles,
}: {
  readonly continents: HomepageContinentSummary[]
  readonly homepage: HomepageData
  readonly locale: Locale
  readonly blogArticles: BlogArticleSummary[]
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hp = homepage as any

  return (
    <div id="homepage-content">
      <ContentSection
        eyebrow={hp?.contentEyebrow}
        title={hp?.contentTitle}
        text={hp?.contentText}
        ctaLabel={hp?.contentCtaLabel}
        ctaHref={hp?.contentCtaHref}
      />
      <FeaturedLibrariesSection libraries={homepage?.featuredLibraries} />
      <ContinentTilesSection continents={continents} locale={locale} />
      <BlogSection articles={blogArticles} locale={locale} />
      <div
        className="border-t py-10 sm:py-14"
        style={{ borderColor: T.border.line }}
      >
        <Container>
          <UpcomingEventsWidget />
        </Container>
      </div>
      <ContributeCTA />
      <ServicesSection homepage={homepage} />
    </div>
  )
}

HomepageSections.displayName = "HomepageSections"

export default HomepageSections
