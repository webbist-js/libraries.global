import { Breadcrumb, HeroTitle, parseHeroText } from "@/components/ds"
import type { EventsStats } from "@/components/events/types"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"

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
  const statCells = [
    {
      value: formatCount(stats.totalThisWeek),
      label: "Events this week",
    },
    {
      value: formatCount(stats.totalThisMonth),
      label: "This month",
    },
    {
      value: formatCount(stats.totalEvents),
      label: topCountryName ? `In ${topCountryName}` : "Total upcoming",
    },
    {
      value: `${stats.percentFree}%`,
      label: "Free or donation",
    },
  ]

  return (
    <section
      className="-mt-14"
      data-transparent-header=""
      style={{ position: "relative", overflow: "hidden" }}
    >
      <DotHeroCanvas variant="events" />

      {/* Radial vignette — events canvas specific */}
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
        className="events-hero-inner"
      >
        {/* Left: breadcrumb + eyebrow + title + lead */}
        <div style={{ maxWidth: "640px" }}>
          {/* Breadcrumb */}
          <Breadcrumb labels={{ events: "Events" }} />

          {/* Eyebrow pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 12px",
              borderRadius: "6px",
              fontSize: "10px",
              border: `1px solid ${T.border.hi}`,
              background: "rgba(255,255,255,.04)",
              backdropFilter: "blur(6px)",
              fontFamily: T.font.mono,
              letterSpacing: ".2em",
              color: T.ink.dim,
              textTransform: "uppercase",
              marginTop: "18px",
            }}
          >
            <span style={{ color: T.accent.ok, fontSize: "8px" }}>●</span>
            <span>§ The Programme · Live</span>
          </div>

          {/* Title */}
          <div style={{ marginTop: "20px" }}>
            <HeroTitle>
              {parseHeroText("Tonight, and the next two thousand *nights.*")}
            </HeroTitle>
          </div>

          {/* Lead */}
          <p
            style={{
              marginTop: "20px",
              marginBottom: 0,
              fontSize: "21px",
              lineHeight: 1.5,
              color: T.ink.dim,
              fontWeight: 300,
              fontFamily: T.font.serif,
              letterSpacing: "-.005em",
              maxWidth: "62ch",
            }}
          >
            {DESCRIPTOR}
          </p>
        </div>

        {/* Right: flat 2×2 stats box */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              overflow: "hidden",
              borderRadius: "14px",
              border: `1px solid ${T.border.line}`,
              background: "rgba(255,255,255,.025)",
              backdropFilter: "blur(10px)",
              minWidth: "320px",
            }}
          >
            {statCells.map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  padding: "16px 18px",
                  borderRight:
                    i % 2 === 0 ? `1px solid ${T.border.line}` : undefined,
                  borderBottom:
                    i < 2 ? `1px solid ${T.border.line}` : undefined,
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 400,
                    fontSize: "32px",
                    letterSpacing: "-.03em",
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
              </div>
            ))}
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
