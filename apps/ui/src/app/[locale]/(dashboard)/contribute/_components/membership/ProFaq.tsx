"use client"

import { Icon } from "@iconify/react"

import { useContactModal } from "@/components/contact/ContactModalProvider"
import { T } from "@/lib/design-tokens"
import {
  MEMBERSHIP_FAQ_COUNT,
  useMembershipContent,
  useOfferValues,
} from "@/lib/localized-plans"

import { H2_STYLE } from "./PlanBits"

/** Plans questions (or any list passed in): a contact prompt beside an accordion. */
export function ProFaq({
  id = "pro-faq-h",
  title,
  items,
  showContact = true,
  firstOpen = true,
}: {
  readonly id?: string
  readonly title?: string
  readonly items?: readonly { q: string; a: string }[]
  readonly showContact?: boolean
  readonly firstOpen?: boolean
} = {}) {
  const m = useMembershipContent()
  const values = useOfferValues()
  const questions =
    items ??
    Array.from({ length: MEMBERSHIP_FAQ_COUNT }, (_, i) => ({
      q: m(`faq.${i}.q`, values),
      a: m(`faq.${i}.a`, values),
    }))
  const { openContact } = useContactModal()

  return (
    <section
      aria-labelledby={id}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]"
    >
      <div className="flex flex-col items-start gap-3">
        <h2 id={id} className="type-h2 m-0" style={H2_STYLE}>
          {title ?? m("copy.questions")}
        </h2>
        {showContact ? (
          <>
            <p
              className="m-0 text-base leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              {m("copy.contactLead")}
            </p>
            <button
              type="button"
              aria-haspopup="dialog"
              className="mt-1 inline-flex h-10 items-center rounded-full bg-(--t-action-primary) px-5 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover)"
              onClick={() => openContact("plans")}
            >
              {m("copy.ask")}
            </button>
          </>
        ) : null}
      </div>
      <div
        className="rounded-[22px] border bg-(--t-bg-deep)"
        style={{ borderColor: T.border.line }}
      >
        {questions.map((item, i) => (
          <details
            key={item.q}
            className="group"
            open={firstOpen && i === 0}
            style={
              i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : undefined
            }
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold sm:px-6 [&::-webkit-details-marker]:hidden">
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
              className="m-0 max-w-[72ch] px-5 pb-5 text-base leading-[1.6] sm:px-6"
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
