import { PanelCard } from "@/components/ds"
import type { ProviderStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

const PROVIDER_META: Record<
  string,
  { label: string; subtitle: string; color: string }
> = {
  eventbrite: {
    label: "Eventbrite",
    subtitle: "OAuth · v3 API",
    color: "#f05537",
  },
  ical: {
    label: "Direct ICS",
    subtitle: "Library-owned feeds",
    color: "#7fdfff",
  },
  custom_ical: {
    label: "Direct ICS",
    subtitle: "Library-owned feeds",
    color: "#7fdfff",
  },
  ticketsource: {
    label: "TicketSource",
    subtitle: "UK · IE · API v2",
    color: "#f6ad55",
  },
  wegottickets: {
    label: "WeGotTickets",
    subtitle: "UK · Partner feed",
    color: "#d97706",
  },
  spydus: {
    label: "Spydus",
    subtitle: "LMS direct",
    color: "#b45309",
  },
  solus: {
    label: "Solus",
    subtitle: "LMS direct",
    color: "#7e22ce",
  },
  aspen: {
    label: "Aspen",
    subtitle: "LMS direct",
    color: "#0c6fad",
  },
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

  const activeCount = providers.length

  return (
    <PanelCard
      index={4}
      eyebrow="Source mix"
      title="Where the"
      italic="events come from."
      action={
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.ghost,
            border: `1px solid ${T.border.line}`,
            borderRadius: "999px",
            padding: "4px 10px",
          }}
        >
          {activeCount} active
        </span>
      }
    >
      <div className="space-y-4">
        {providers.map((p) => {
          const pct = total > 0 ? (p.count / total) * 100 : 0
          const meta = PROVIDER_META[p.provider] ?? {
            label: p.provider,
            subtitle: "",
            color: T.accent.aurora,
          }

          return (
            <div key={p.provider}>
              {/* Name row */}
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-1 size-2 shrink-0 rounded-full"
                    style={{ background: meta.color }}
                  />
                  <div>
                    <p
                      style={{
                        fontFamily: T.font.sans,
                        fontSize: "13px",
                        color: T.ink.base,
                        lineHeight: 1.3,
                        margin: 0,
                      }}
                    >
                      {meta.label}
                    </p>
                    {meta.subtitle && (
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "8px",
                          letterSpacing: ".16em",
                          textTransform: "uppercase",
                          color: T.ink.ghost,
                          margin: "2px 0 0",
                        }}
                      >
                        {meta.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className="flex shrink-0 items-baseline gap-1.5"
                  style={{ paddingTop: "1px" }}
                >
                  <span
                    style={{
                      fontFamily: T.font.serif,
                      fontSize: "15px",
                      color: T.ink.base,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {formatCount(p.count)}
                  </span>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      color: T.ink.ghost,
                    }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div
                className="h-px w-full overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", height: "3px" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: meta.color,
                    opacity: 0.65,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </PanelCard>
  )
}
