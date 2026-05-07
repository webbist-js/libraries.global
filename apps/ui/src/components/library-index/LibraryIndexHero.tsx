import { Breadcrumb, HeroTitle, parseHeroText } from "@/components/ds"
import type { LibraryIndexStats } from "@/components/library-index/types"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"

interface LibraryIndexHeroProps {
  readonly stats: LibraryIndexStats
}

const STATS = (stats: LibraryIndexStats) => [
  {
    value: stats.totalLibraries.toLocaleString(),
    label: "Libraries",
    note: "Indexed worldwide",
  },
  {
    value: stats.totalCountries.toLocaleString(),
    label: "Countries",
    note: "Across 6 continents",
  },
  {
    value: stats.totalRegions.toLocaleString(),
    label: "Regions",
    note: "Provinces · states · counties",
  },
  {
    value: `${stats.percentOpen}%`,
    label: "Open now",
    note: "Currently operational",
  },
]

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
        {/* Left: breadcrumb + eyebrow + title + lead */}
        <div style={{ maxWidth: "640px" }}>
          {/* Breadcrumb */}
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Atlas", href: "/" },
              { label: "Library Index" },
            ]}
          />

          {/* Eyebrow pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 12px",
              borderRadius: "999px",
              fontSize: "10px",
              border: `1px solid ${T.border.line}`,
              background: T.bg.surface,
              fontFamily: T.font.mono,
              letterSpacing: ".2em",
              color: T.ink.dim,
              textTransform: "uppercase",
              marginTop: "18px",
            }}
          >
            <span style={{ color: T.accent.ok, fontSize: "8px" }}>●</span>
            <span>§ The Index · Live</span>
            {stats.totalLibraries > 0 && (
              <>
                <span style={{ color: T.ink.ghost }}>·</span>
                <span style={{ color: T.accent.aurora }}>
                  {stats.totalLibraries.toLocaleString()} Entries
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <div style={{ marginTop: "20px" }}>
            <HeroTitle>{parseHeroText("Every library, *indexed.*")}</HeroTitle>
          </div>

          {/* Lead */}
          <p
            style={{
              marginTop: "20px",
              marginBottom: 0,
              fontSize: "16px",
              lineHeight: 1.7,
              color: T.ink.dim,
              fontWeight: 400,
              fontFamily: T.font.sans,
              maxWidth: "52ch",
            }}
          >
            A complete, sortable, filterable register of the world&rsquo;s
            libraries — public, academic, national, special. Cross-referenced by
            continent, country, region and area.
          </p>
        </div>

        {/* Right: flat 4-column stats bar */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              overflow: "hidden",
              borderRadius: "12px",
              border: `1px solid ${T.border.line}`,
              background: T.bg.deep,
              minWidth: "520px",
            }}
          >
            {STATS(stats).map((stat, i, arr) => (
              <div
                key={stat.label}
                style={{
                  padding: "20px 24px",
                  borderRight:
                    i < arr.length - 1
                      ? `1px solid ${T.border.line}`
                      : undefined,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 400,
                    fontSize: "clamp(28px, 2.4vw, 36px)",
                    letterSpacing: "-.02em",
                    lineHeight: 1,
                    color: T.ink.base,
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: T.ink.low,
                    marginTop: "6px",
                  }}
                >
                  {stat.label}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: T.ink.faint,
                    fontFamily: T.font.sans,
                    marginTop: "1px",
                  }}
                >
                  {stat.note}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
