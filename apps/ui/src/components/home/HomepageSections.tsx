import type { Locale } from "next-intl"

import type {
  HomepageData,
  HomepageContinentSummary,
} from "@/components/home/homepage.types"
import ContinentTilesSection from "@/components/home/sections/ContinentTilesSection"
import FeaturedLibrariesSection from "@/components/home/sections/FeaturedLibrariesSection"
import ServicesSection from "@/components/home/sections/ServicesSection"

export function HomepageSections({
  continents,
  homepage,
  locale,
}: {
  readonly continents: HomepageContinentSummary[]
  readonly homepage: HomepageData
  readonly locale: Locale
}) {
  return (
    <div id="homepage-content">
      <FeaturedLibrariesSection libraries={homepage?.featuredLibraries} />
      <ContinentTilesSection continents={continents} locale={locale} />
      <ServicesSection homepage={homepage} />
    </div>
  )
}

HomepageSections.displayName = "HomepageSections"

export default HomepageSections
