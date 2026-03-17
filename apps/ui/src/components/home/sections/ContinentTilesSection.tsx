import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import ContinentTile from "@/components/home/ContinentTile"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"

export function ContinentTilesSection({
  continents,
  locale,
}: {
  readonly continents: HomepageContinentSummary[]
  readonly locale: Locale
}) {
  if (continents.length === 0) {
    return null
  }

  return (
    <section className="py-8 sm:py-10">
      <Container>
        <SectionHeader title="Browse by Continent" />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {continents.map((continent, index) => (
            <ContinentTile
              key={continent.documentId ?? continent.slug ?? index}
              continent={continent}
              locale={locale}
            />
          ))}
        </div>
      </Container>
    </section>
  )
}

ContinentTilesSection.displayName = "ContinentTilesSection"

export default ContinentTilesSection
