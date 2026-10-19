import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

const ASIDE_STEPS = [
  {
    icon: "mdi:calendar-sync-outline",
    title: "Pick a platform",
    body: "Eventbrite, iCal, TicketSource, WeGotTickets, Spydus, Solus or Aspen Discovery.",
  },
  {
    icon: "mdi:check-decagram-outline",
    title: "Test the connection",
    body: "We check the details work before anything is saved.",
  },
  {
    icon: "mdi:account-check-outline",
    title: "A moderator reviews it",
    body: "They see whether the test passed, never the details themselves.",
  },
  {
    icon: "mdi:calendar-check-outline",
    title: "Events appear on your library's page",
    body: "Once approved, the feed starts syncing automatically.",
  },
]

/** How feed connections work, for the dashboard's sidebar. */
export function FeedsAside() {
  return (
    <aside aria-labelledby="event-feed-aside-heading" className="min-w-0">
      <div
        className="flex flex-col gap-5 p-6 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "20px",
          background: T.bg.deep,
        }}
      >
        <h2
          id="event-feed-aside-heading"
          style={{
            fontFamily: T.font.serif,
            fontSize: "22px",
            fontWeight: 500,
            lineHeight: 1.25,
            color: T.ink.base,
            margin: 0,
          }}
        >
          How feed connections work
        </h2>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {ASIDE_STEPS.map((step) => (
            <li key={step.title} className="flex gap-3">
              <Icon
                icon={step.icon}
                className="mt-0.5 size-5 shrink-0"
                style={{ color: T.accent.primary }}
                aria-hidden="true"
              />
              <div>
                <p
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "15px",
                    fontWeight: 600,
                    color: T.ink.base,
                    margin: "0 0 2px",
                  }}
                >
                  {step.title}
                </p>
                <p
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "14px",
                    lineHeight: 1.55,
                    color: T.ink.dim,
                    margin: 0,
                  }}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            lineHeight: 1.55,
            color: T.ink.dim,
            margin: 0,
            borderTop: `1px solid ${T.border.divider}`,
            paddingTop: "16px",
          }}
        >
          Only Libraries Global staff can read stored details. Every access is
          logged.
        </p>
      </div>
    </aside>
  )
}
