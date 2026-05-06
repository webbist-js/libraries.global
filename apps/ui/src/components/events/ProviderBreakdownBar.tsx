import type { ProviderStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  eventbrite: { label: "Eventbrite", color: "#f05537" },
  ical: { label: "Library direct", color: "#7fdfff" },
  custom_ical: { label: "Library direct", color: "#7fdfff" },
  ticketsource: { label: "TicketSource", color: "#f6ad55" },
  wegottickets: { label: "WeGotTickets", color: "#d97706" },
  spydus: { label: "Spydus", color: "#7fdfff" },
  solus: { label: "Solus", color: "#7fdfff" },
  aspen: { label: "Aspen", color: "#7fdfff" },
  meetup: { label: "Meetup", color: "#ff5757" },
  eventfinda: { label: "Eventfinda", color: "#7fb069" },
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`

  return String(n)
}

interface ProviderBreakdownBarProps {
  readonly providers: ProviderStat[]
}

export function ProviderBreakdownBar({ providers }: ProviderBreakdownBarProps) {
  if (!providers.length) return null

  return (
    <div
      style={{
        background: "rgba(255,255,255,.025)",
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        padding: "20px 22px",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Panel header */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9.5px",
            letterSpacing: ".24em",
            textTransform: "uppercase",
            color: T.ink.faint,
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: T.accent.aurora }}>§ B.04</span>
          <span>Sources</span>
        </div>
        <h4
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "22px",
            letterSpacing: "-.02em",
            margin: 0,
            lineHeight: 1.1,
            color: T.ink.base,
          }}
        >
          Where this{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            comes from.
          </em>
        </h4>
      </div>

      {/* Provider rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {providers.map((p, i) => {
          const meta = PROVIDER_META[p.provider] ?? {
            label: p.provider,
            color: T.accent.aurora,
          }
          const isLast = i === providers.length - 1

          return (
            <div
              key={p.provider}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 0",
                borderBottom: isLast ? "none" : `1px dashed ${T.border.line}`,
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: meta.color,
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: T.ink.base,
                  letterSpacing: ".04em",
                  minWidth: "100px",
                }}
              >
                {meta.label}
              </span>
              <span
                style={{
                  flex: 1,
                  fontFamily: T.font.mono,
                  fontSize: "10.5px",
                  color: T.ink.low,
                }}
              >
                {formatCount(p.count)} events
              </span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".18em",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  color: T.accent.ok,
                  background: "rgba(110,231,183,.10)",
                  border: "1px solid rgba(110,231,183,.32)",
                  flexShrink: 0,
                }}
              >
                OK
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
