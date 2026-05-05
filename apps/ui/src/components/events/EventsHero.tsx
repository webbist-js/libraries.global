import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"

interface ProviderCount {
  provider: string
  count: number
}

interface EventsHeroProps {
  readonly totalThisWeek: number
  readonly providers: ProviderCount[]
}

const PROVIDER_LABELS: Record<string, string> = {
  eventbrite: "Eventbrite",
  ical: "iCal",
  custom_ical: "iCal",
  aspen: "Aspen",
  solus: "Solus",
  spydus: "Spydus",
  ticketsource: "TicketSource",
  wegottickets: "WeGotTickets",
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

export function EventsHero({ totalThisWeek, providers }: EventsHeroProps) {
  const now = new Date()
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const weekRange = `${now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: T.bg.space }}
    >
      {/* Dot pulse canvas */}
      <DotHeroCanvas variant="events" />

      {/* Subtle aurora gradient over canvas */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(800px 500px at 15% 50%, rgba(127,223,255,0.06), transparent 55%),
            radial-gradient(500px 350px at 85% 20%, rgba(163,144,255,0.04), transparent 50%)
          `,
        }}
      />

      {/* Content — contained */}
      <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-10 sm:px-10 sm:pt-28">
        {/* Breadcrumb */}
        <div
          className="mb-6 flex items-center gap-2"
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          <span>Directory</span>
          <span style={{ color: T.ink.ghost }}>/</span>
          <span>Global</span>
          <span style={{ color: T.ink.ghost }}>/</span>
          <span style={{ color: T.ink.low }}>Programme</span>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          {/* Left: headline + descriptor */}
          <div className="max-w-2xl">
            {/* Live pill */}
            <div className="mb-5 inline-flex items-center gap-2">
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: T.accent.ok }}
              />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.accent.ok,
                }}
              >
                {formatCount(totalThisWeek)} events this week
              </span>
            </div>

            {/* Main headline */}
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(3rem, 8vw, 5.5rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.02em",
                color: T.ink.base,
                fontWeight: 400,
                margin: 0,
              }}
            >
              The week&rsquo;s{" "}
              <em style={{ fontStyle: "italic", color: T.ink.dim }}>
                readings.
              </em>
            </h1>

            <p
              className="mt-5 max-w-xl text-sm leading-relaxed"
              style={{ color: T.ink.low }}
            >
              Talks, exhibitions, storytimes, classes, archive open days, and
              book clubs — running this week at libraries worldwide. Aggregated
              from Eventbrite, TicketSource, WeGotTickets, and direct library
              iCal feeds.
            </p>

            {/* Provider pill row */}
            {providers.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {providers.map((p) => (
                  <span
                    key={p.provider}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1"
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "10px",
                      letterSpacing: ".12em",
                      color: T.ink.dim,
                      borderColor: T.border.line,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    {PROVIDER_LABELS[p.provider] ?? p.provider}
                    <span style={{ color: T.accent.aurora, fontWeight: 600 }}>
                      {formatCount(p.count)}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: date range + timezone note */}
          <div
            className="shrink-0 space-y-1 text-right"
            style={{ fontFamily: T.font.mono }}
          >
            <p
              style={{
                fontSize: "11px",
                color: T.ink.faint,
                letterSpacing: ".12em",
              }}
            >
              {weekRange}
            </p>
            <p
              style={{
                fontSize: "10px",
                color: T.ink.ghost,
                letterSpacing: ".1em",
              }}
            >
              All times local to each library
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
