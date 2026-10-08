import { Icon } from "@iconify/react"

import { CONTACT_EMAIL } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

import { H2_STYLE } from "./PlanBits"

const FAQ: { q: string; a: string }[] = [
  {
    q: "What stays free?",
    a: "Everything factual. Every library record, with its hours and services, search, the map and lists stay free for everyone, signed in or not. Contributing is free too.",
  },
  {
    q: "Does Pro change my role or how my edits are reviewed?",
    a: "No. Money never buys trust. Pro doesn’t award points, raise your tier, change your contributor role or skip review.",
  },
  {
    q: "How does Team work?",
    a: "Team is bought per library service, not per person. It comes with a number of seats, the libraries it covers and a Team organiser, who invites colleagues by email and assigns them to those libraries as owners or editors. Each seat gives its holder Pro. On a team we have verified, an assignment gives staff access at once; otherwise a moderator checks it first. Ask about Team for your service from the Team card.",
  },
  {
    q: "Is VAT added at checkout?",
    a: "No. The Supporter and Pro prices shown are what you pay. Team is invoiced, and its price is quoted ex VAT.",
  },
  {
    q: "Can I cancel?",
    a: "Nobody can be charged yet. Once checkout exists, you’ll be able to cancel at any time, with a no-questions refund within 14 days of paying.",
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
            <a
              className="mt-1 inline-flex h-10 items-center rounded-full bg-(--t-accent-primary) px-5 text-[14.5px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Question about plans")}`}
            >
              Ask a question
            </a>
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
