import type { ProviderStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

const PROVIDER_LABELS: Record<string, string> = {
  eventbrite: "Eventbrite",
  ical: "iCal Feeds",
  custom_ical: "iCal (Custom)",
  aspen: "Aspen",
  solus: "Solus",
  spydus: "Spydus",
  ticketsource: "TicketSource",
  wegottickets: "WeGotTickets",
}

const PROVIDER_COLORS: Record<string, string> = {
  eventbrite: "#f05537",
  ical: "#7fdfff",
  custom_ical: "#7fdfff",
  ticketsource: "#e53e3e",
  wegottickets: "#d97706",
  spydus: "#b45309",
  solus: "#7e22ce",
  aspen: "#0c6fad",
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

interface ProviderBreakdownBarProps {
  readonly providers: ProviderStat[]
}

export function ProviderBreakdownBar({ providers }: ProviderBreakdownBarProps) {
  const total = providers.reduce((s, p) => s + p.count, 0)
  if (!providers.length) return null

  return (
    <div>
      {/* Section header */}
      <div className="mb-5 flex items-center gap-2">
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          § 04 ·
        </span>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
          }}
        >
          Where the{" "}
          <em style={{ fontStyle: "italic", color: T.ink.dim }}>
            events come from.
          </em>
        </h2>
      </div>

      <div className="space-y-3">
        {providers.map((p) => {
          const pct = total > 0 ? (p.count / total) * 100 : 0
          const color = PROVIDER_COLORS[p.provider] ?? T.accent.aurora
          const label = PROVIDER_LABELS[p.provider] ?? p.provider

          return (
            <div key={p.provider} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".1em",
                    color: T.ink.dim,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    color: T.ink.faint,
                  }}
                >
                  {formatCount(p.count)}{" "}
                  <span style={{ color: T.ink.ghost }}>{pct.toFixed(1)}%</span>
                </span>
              </div>
              {/* Bar track */}
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
