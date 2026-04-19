import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import ContinentTile from "@/components/home/ContinentTile"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"

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
    <section className="py-16 sm:py-20" id="continents">
      <Container className="mb-10">
        {/* Two-column editorial header */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[36rem]">
            <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-white/35 uppercase">
              § 02 — NAVIGATE BY CONTINENT
            </p>
            <h2 className="font-[family-name:var(--font-fraunces)] text-[2.4rem] leading-[1.08] font-semibold tracking-[-0.02em] text-white sm:text-[3rem]">
              Explore by
              <br />
              <em className="text-white/65 italic">region of the world.</em>
            </h2>
          </div>

          <div className="max-w-[28rem] sm:text-right">
            <p className="mb-4 text-sm leading-7 text-white/45">
              Every library in the index is anchored to a continent, country,
              and region. Start broad — narrow down to streets and shelves.
            </p>
            <GlobalLink
              href="/map"
              className="text-sm text-cyan-400/80 underline-offset-4 transition-colors hover:text-cyan-300 hover:underline"
            >
              Open the full map →
            </GlobalLink>
          </div>
        </div>
      </Container>

      {/* Cards — full-width scroll on mobile, grid on larger screens */}
      <Container>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
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
