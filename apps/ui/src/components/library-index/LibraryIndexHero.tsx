import {
  HeroEyebrow,
  HeroLead,
  HeroStat,
  HeroStatsGrid,
  HeroTitle,
  parseHeroText,
} from "@/components/ds"
import type { LibraryIndexStats } from "@/components/library-index/types"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return n.toLocaleString()
}

interface LibraryIndexHeroProps {
  readonly stats: LibraryIndexStats
}

export function LibraryIndexHero({ stats }: LibraryIndexHeroProps) {
  return (
    <section
      className="-mt-14"
      data-transparent-header=""
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Background canvas */}
      <DotHeroCanvas variant="aurora" />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "clamp(100px, 14vw, 160px) 24px clamp(60px, 8vw, 100px)",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "clamp(32px, 5vw, 80px)",
          alignItems: "center",
        }}
      >
        {/* Left: eyebrow + title + lead */}
        <div style={{ maxWidth: "600px" }}>
          <HeroEyebrow>The Index · Every Library on Earth</HeroEyebrow>
          <div style={{ marginTop: "20px" }}>
            <HeroTitle>{parseHeroText("Every library, *indexed.*")}</HeroTitle>
          </div>
          <HeroLead className="mt-5">
            A complete, sortable, filterable register of the world&rsquo;s
            libraries — public, academic, national, special. Cross-referenced by
            continent, country, region and area.
          </HeroLead>
        </div>

        {/* Right: stats grid */}
        <div style={{ paddingBottom: "10px" }}>
          <HeroStatsGrid cols={2}>
            <HeroStat
              label="Libraries"
              value={formatCount(stats.totalLibraries)}
            />
            <HeroStat
              label="Countries"
              value={formatCount(stats.totalCountries)}
            />
            <HeroStat label="Regions" value={formatCount(stats.totalRegions)} />
            <HeroStat label="Open now" value={`${stats.percentOpen}%`} />
          </HeroStatsGrid>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .lib-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
