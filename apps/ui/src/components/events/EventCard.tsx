import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import type { GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

const PROVIDER_LABEL: Record<string, string> = {
  eventbrite: "Eventbrite",
  ticketsource: "TicketSource",
  ical: "Library",
  custom_ical: "Library",
  aspen: "Library",
  solus: "Library",
  spydus: "Library",
}

const PROVIDER_COLOR: Record<string, string> = {
  eventbrite: "#f0593f",
  ticketsource: "#f5b94b",
  ical: "#7fdfff",
  custom_ical: "#7fdfff",
  aspen: "#7fdfff",
  solus: "#7fdfff",
  spydus: "#7fdfff",
  meetup: "#ff5757",
  eventfinda: "#7fb069",
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

interface EventCardProps {
  readonly event: GridEvent
}

export function EventCard({ event }: EventCardProps) {
  const start = new Date(event.startTime)
  const dayNum = start.getDate()
  const dayLabel = start
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toUpperCase()
  const monthLabel = start
    .toLocaleDateString("en-GB", { month: "short" })
    .toUpperCase()
  const startTime = event.allDay ? null : formatTime(event.startTime)
  const endTime = event.endTime ? formatTime(event.endTime) : null
  const providerLabel =
    PROVIDER_LABEL[event.sourceProvider] ?? event.sourceProvider
  const providerColor = PROVIDER_COLOR[event.sourceProvider] ?? T.accent.aurora

  const catMeta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other
  const catColor = catMeta.color
  const catLabel = catMeta.label

  const price = event.isFree
    ? null
    : event.priceMin != null
      ? `£${event.priceMin}`
      : null

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      className="ec"
    >
      {/* ── Media ── */}
      <div className="ec-media">
        {event.imageUrl ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${event.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(135deg, ${T.bg.surface} 0%, #0a1028 100%)`,
            }}
          />
        )}

        {/* Category badge — top left */}
        <span className="ec-cat-badge">
          <span className="pip" style={{ background: catColor }} />
          <span style={{ color: catColor }}>{catLabel}</span>
        </span>

        {/* Big date — top right */}
        <div className="ec-bigdate">
          <div className="m">
            {dayLabel} · {monthLabel}
          </div>
          <div className="d">{dayNum}</div>
          {startTime && <div className="t">{startTime}</div>}
          {event.allDay && <div className="t">All day</div>}
        </div>

        {/* Location flag — bottom left */}
        {event.libraryName && (
          <span className="ec-flag">{event.libraryName}</span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="ec-body">
        {/* Title */}
        <h3>{event.title}</h3>

        {/* Library */}
        {event.libraryName && (
          <div className="ec-where">
            <b>{event.libraryName}</b>
          </div>
        )}

        {/* When meta box */}
        {(startTime || event.allDay) && (
          <div className="ec-when">
            <div className="col">
              <div className="k">Doors</div>
              <div className="v t">
                {startTime ?? "Open"}
                {endTime ? ` — ${endTime}` : ""}
              </div>
            </div>
            <div className="col">
              <div className="k">Format</div>
              <div className="v">In-person</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="ec-foot">
          {price ? (
            <span className="ec-price">{price}</span>
          ) : (
            <span className="ec-price free">{event.isFree ? "Free" : ""}</span>
          )}
          <span className="ec-prov">
            <span className="pdot" style={{ background: providerColor }} />
            {providerLabel}
          </span>
          <span className="ec-arr">→</span>
        </div>
      </div>

      <style>{`
        .ec {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform 220ms, box-shadow 220ms, border-color 220ms, background 220ms;
          position: relative;
        }
        .ec:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 48px -22px rgba(127,223,255,.18);
          border-color: rgba(255,255,255,.16);
          background: rgba(255,255,255,.04);
        }
        .ec-media {
          height: 160px;
          position: relative;
          overflow: hidden;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .ec-media::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 30%, rgba(3,5,17,.78) 100%);
        }
        .ec-cat-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(3,5,17,.82);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,.16);
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          letter-spacing: .16em;
          text-transform: uppercase;
          z-index: 2;
        }
        .ec-cat-badge .pip {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .ec-bigdate {
          position: absolute;
          top: 14px;
          right: 16px;
          text-align: right;
          z-index: 2;
          font-family: 'Fraunces', serif;
        }
        .ec-bigdate .m {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          letter-spacing: .18em;
          color: rgba(244,247,255,.48);
          font-weight: 500;
        }
        .ec-bigdate .d {
          font-size: 42px;
          font-weight: 300;
          line-height: .9;
          color: #f4f7ff;
          letter-spacing: -.03em;
          margin-top: 1px;
        }
        .ec-bigdate .t {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          color: #7fdfff;
          letter-spacing: .14em;
          margin-top: 2px;
        }
        .ec-flag {
          position: absolute;
          bottom: 12px;
          left: 12px;
          right: 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(3,5,17,.82);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,.16);
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          letter-spacing: .16em;
          text-transform: uppercase;
          color: #f4f7ff;
          z-index: 2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: fit-content;
          max-width: calc(100% - 24px);
        }
        .ec-body {
          padding: 16px 20px 18px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .ec h3 {
          font-family: 'Fraunces', serif;
          font-weight: 400;
          font-size: 21px;
          letter-spacing: -.02em;
          line-height: 1.18;
          margin: 0 0 6px;
          color: #f4f7ff;
          text-wrap: balance;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ec h3 em {
          font-style: italic;
          color: rgba(244,247,255,.72);
          font-weight: 300;
        }
        .ec-where {
          font-size: 12.5px;
          color: rgba(244,247,255,.72);
          margin: 0 0 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .ec-where b {
          color: #f4f7ff;
          font-weight: 500;
        }
        .ec-when {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          background: rgba(255,255,255,.02);
          margin-bottom: 10px;
          font-size: 12px;
          flex-wrap: wrap;
        }
        .ec-when .k {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: rgba(244,247,255,.30);
          letter-spacing: .18em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .ec-when .v {
          color: #f4f7ff;
          font-weight: 500;
        }
        .ec-when .v.t {
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: .04em;
          color: #7fdfff;
        }
        .ec-when .col {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }
        .ec-when .col + .col {
          padding-left: 14px;
          border-left: 1px solid rgba(255,255,255,.08);
        }
        .ec-foot {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px dashed rgba(255,255,255,.08);
        }
        .ec-price {
          font-family: 'Fraunces', serif;
          font-size: 16px;
          font-weight: 400;
          color: #e8c98a;
          letter-spacing: -.01em;
        }
        .ec-price.free {
          color: #6ee7b7;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .ec-prov {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: rgba(244,247,255,.30);
          letter-spacing: .14em;
          text-transform: uppercase;
        }
        .ec-prov .pdot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .ec-arr {
          color: rgba(244,247,255,.48);
          font-size: 14px;
          transition: color 200ms, transform 200ms;
        }
        .ec:hover .ec-arr {
          color: #7fdfff;
          transform: translateX(3px);
        }
        .ecards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 760px) {
          .ecards { grid-template-columns: 1fr; }
        }
      `}</style>
    </a>
  )
}
