import {
  HeroEyebrow,
  HeroLead,
  HeroStat,
  HeroStatsGrid,
  HeroTitle,
  parseHeroText,
} from "@/components/ds"
import type { EventsStats } from "@/components/events/types"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"

const DESCRIPTOR =
  "Author talks, exhibitions, classes, storytime, archive tours. Ingested live from Eventbrite, TicketSource, library calendars and direct partners. Filterable by anywhere, when, format and language."

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  }

  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

interface EventsHeroProps {
  readonly stats: EventsStats
  readonly topCountryName?: string | null
}

// TODO: The design shows provider pill chips (Eventbrite, TicketSource…) and
// scope-filter pills (GLOBAL / CONTINENT / NEAR ME, ALL / FREE / PAID, date range
// shortcuts) below the hero descriptor. These were not in the implementation plan.
// Stats will show 0 in dev until the sync-worker has seeded events into Strapi.
export function EventsHero({ stats, topCountryName }: EventsHeroProps) {
  return (
    <section
      className="-mt-14"
      data-transparent-header=""
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "130px 0 60px",
      }}
    >
      <DotHeroCanvas variant="events" />

      {/* Radial vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 90% at 50% 50%, transparent 25%, var(--t-bg-space) 80%)",
          pointerEvents: "none",
        }}
      />

      {/* Bottom fade — hides the canvas edge */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "80px",
          background:
            "linear-gradient(to bottom, transparent, var(--t-bg-space))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1296px",
          margin: "0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 0.9fr",
            gap: "56px",
            alignItems: "end",
          }}
          className="events-hero-inner"
        >
          {/* Left */}
          <div>
            <HeroEyebrow>The Programme</HeroEyebrow>

            <HeroTitle>
              {parseHeroText("Tonight, and the next two thousand *nights.*")}
            </HeroTitle>

            <HeroLead className="mt-5">{DESCRIPTOR}</HeroLead>
          </div>

          {/* Right: stats grid */}
          <div style={{ paddingBottom: "10px" }}>
            <HeroStatsGrid cols={2}>
              <HeroStat
                label="Events this week"
                value={formatCount(stats.totalThisWeek)}
              />
              <HeroStat
                label="This month"
                value={formatCount(stats.totalThisMonth)}
              />
              {topCountryName ? (
                <HeroStat
                  label={`In ${topCountryName}`}
                  value={formatCount(stats.totalEvents)}
                />
              ) : (
                <HeroStat
                  label="Total upcoming"
                  value={formatCount(stats.totalEvents)}
                />
              )}
              <HeroStat
                label="Free or donation"
                value={`${stats.percentFree}%`}
              />
            </HeroStatsGrid>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .events-hero-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
