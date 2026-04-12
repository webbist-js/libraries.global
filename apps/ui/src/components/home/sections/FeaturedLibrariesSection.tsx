import { Container } from "@/components/elementary/Container"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
import SectionHeader from "@/components/home/sections/SectionHeader"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

export function FeaturedLibrariesSection({
  libraries,
}: {
  readonly libraries?: PopulatedFeaturedLibraryData[] | null
}) {
  if (!Array.isArray(libraries) || libraries.length === 0) {
    return null
  }

  return (
    <section className="py-8 sm:py-10">
      <Container>
        <SectionHeader title="Featured Libraries" />
        <FeaturedLibraryCards libraries={libraries} />
      </Container>
    </section>
  )
}

FeaturedLibrariesSection.displayName = "FeaturedLibrariesSection"

export default FeaturedLibrariesSection
