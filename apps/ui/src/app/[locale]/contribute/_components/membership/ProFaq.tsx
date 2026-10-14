"use client"

import { Icon } from "@iconify/react"

import { useContactModal } from "@/components/contact/ContactModalProvider"
import { T } from "@/lib/design-tokens"

import { H2_STYLE } from "./PlanBits"

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is VAT added at checkout?",
    a: "Supporter and Pro use tax-inclusive GBP base prices. Stripe confirms the applicable tax, local currency and final recurring total before you pay; your invoice shows the actual charge. Team is quoted and invoiced separately, excluding VAT where stated.",
  },
  {
    q: "Can I cancel?",
    a: "Cancel renewal at any time through Membership & billing in Settings. Your settled membership remains available until the paid period ends. Refund requests are handled under the cancellation and refund policy and Stripe’s order terms; your statutory rights remain unchanged.",
  },
  {
    q: "How does Team work?",
    a: "Team is bought per library service, not per person. It comes with a number of seats, the libraries it covers and a Team organiser, who invites colleagues by email and assigns them to those libraries as owners or editors. Each seat gives its holder Pro. On a team we have verified, an assignment gives staff access at once; otherwise a moderator checks it first. Ask about Team for your service from the Team card.",
  },
  {
    q: "What does Supporter include?",
    a: "Detailed library change history and Atlas CSV/GeoJSON exports of up to 500 libraries per download. Pro includes those tools, raises the export cap to 10,000 and adds population comparisons. Unfinished analysis tools are marked Coming soon.",
  },
  {
    q: "Can I use Apple Pay or Google Pay?",
    a: "Stripe’s secure checkout shows supported payment methods for your device and location, including Apple Pay and Google Pay when available. Card payment remains available. Libraries Global does not receive your full card details.",
  },
  {
    q: "Does membership change my role or how my edits are reviewed?",
    a: "No. Money never buys trust. Supporter and Pro do not award points, raise your tier, change your contributor role or skip review.",
  },
  {
    q: "What stays free?",
    a: "Everything factual. Every library record, with its hours and services, search, the map and lists stay free for everyone, signed in or not. Contributing is free too.",
  },
]

/** Questions: a contact prompt on the left, an accordion on the right. */
export function ProFaq({
  id = "pro-faq-h",
  title = "Questions",
  items = FAQ,
  showContact = true,
  firstOpen = true,
}: {
  readonly id?: string
  readonly title?: string
  readonly items?: readonly { q: string; a: string }[]
  readonly showContact?: boolean
  readonly firstOpen?: boolean
} = {}) {
  const { openContact } = useContactModal()

  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]"
    >
      <div className="flex flex-col items-start gap-3">
        <h2 id={id} className="m-0" style={H2_STYLE}>
          {title}
        </h2>
        {showContact ? (
          <>
            <p
              className="m-0 text-[16px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              Something else? The maintainers reply within 5 working days.
            </p>
            <button
              type="button"
              aria-haspopup="dialog"
              className="mt-1 inline-flex h-10 items-center rounded-full bg-(--t-accent-primary) px-5 text-[14.5px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              onClick={() => openContact("plans")}
            >
              Ask a question
            </button>
          </>
        ) : null}
      </div>
      <div
        className="rounded-[22px] border bg-white"
        style={{ borderColor: T.border.line }}
      >
        {items.map((item, i) => (
          <details
            key={item.q}
            className="group"
            open={firstOpen && i === 0}
            style={
              i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : undefined
            }
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15.5px] font-semibold sm:px-6 [&::-webkit-details-marker]:hidden">
              {item.q}
              <Icon
                aria-hidden="true"
                className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                height={20}
                icon="mdi:chevron-down"
                style={{ color: T.ink.dim }}
                width={20}
              />
            </summary>
            <p
              className="m-0 max-w-[72ch] px-5 pb-5 text-[15px] leading-[1.6] sm:px-6"
              style={{ color: T.ink.dim }}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
