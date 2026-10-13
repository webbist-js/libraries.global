import type { AboutLibrary } from "@/components/about/about.types"
import { AboutHero } from "@/components/about/AboutHero"
import { AboutStory } from "@/components/about/AboutStory"
import type {
  HomepageContinentSummary,
  HomepageStats,
} from "@/components/home/homepage.types"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"

import "@/components/about/about.css"

/** An ordinary document, with the shared globe confined to its opening hero. */
export function AboutExperience({
  markers,
  stats,
  continents,
  libraries,
}: {
  readonly markers: readonly LibraryMarker[]
  readonly stats: HomepageStats | null
  readonly continents: HomepageContinentSummary[]
  readonly libraries: readonly AboutLibrary[]
}) {
  return (
    <main className="about-page">
      <AboutHero markers={markers} />
      <AboutStory stats={stats} continents={continents} libraries={libraries} />
    </main>
  )
}
