import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import FeaturedLibraryCards from "@/components/home/FeaturedLibraryCards"
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
    <section className="py-16 sm:py-20" id="featured">
      {/* Section header */}
      <Container className="mb-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[36rem]">
            <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-white/35 uppercase">
              § 01 — FEATURED THIS WEEK
            </p>
            <h2 className="font-[family-name:var(--font-fraunces)] text-[2.4rem] leading-[1.08] font-semibold tracking-[-0.02em] text-white sm:text-[3rem]">
              Libraries chosen
              <br />
              <em className="text-white/65 italic">for the week.</em>
            </h2>
          </div>

          <div className="max-w-[28rem] sm:text-right">
            <p className="mb-4 text-sm leading-7 text-white/45">
              Each week our curators surface libraries that typify the
              project&rsquo;s soul &mdash; institutional, wild, forgotten, or
              reborn.
            </p>
            <GlobalLink
              href="/map"
              className="text-sm text-cyan-400/80 underline-offset-4 transition-colors hover:text-cyan-300 hover:underline"
            >
              See all entries →
            </GlobalLink>
          </div>
        </div>
      </Container>

      {/* Full viewport-width carousel — no container, bleeds edge to edge */}
      <FeaturedLibraryCards libraries={libraries} />
    </section>
  )
}

FeaturedLibrariesSection.displayName = "FeaturedLibrariesSection"

export default FeaturedLibrariesSection
