"use client"

import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  type LocalizedOffer,
  useMembershipContent,
  useOffer,
} from "@/lib/localized-plans"
import { heldOffers, type OfferKey, type OfferViewer } from "@/lib/plans"

import { CurrentPlanBadge, IncludeItem, PlanSectionHeader } from "./PlanBits"

const PILL =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-base font-semibold no-underline transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) motion-reduce:transition-none"

function ctaFor(
  offer: LocalizedOffer,
  viewer: OfferViewer,
  held: boolean,
  m: ReturnType<typeof useMembershipContent>
): { href: string; label: string } | null {
  switch (offer.key) {
    case "explorer":
      return viewer.signedIn ? null : offer.cta
    case "staff":
      return viewer.isStaff
        ? { href: "/staff", label: m("copy.openStaff") }
        : offer.cta
    case "api":
      return held
        ? { href: "/developers", label: m("copy.manageApi") }
        : offer.cta

    default:
      return offer.cta
  }
}

/** Most highlights a card lists; the comparison table has the rest. */
const HIGHLIGHTS = 5

function OfferCard({
  offer,
  viewer,
  held,
}: {
  readonly offer: LocalizedOffer
  readonly viewer: OfferViewer
  readonly held: boolean
}) {
  const m = useMembershipContent()
  const cta = ctaFor(offer, viewer, held, m)
  const primary = offer.key === "contributor" || offer.key === "api"
  const included = offer.items.filter((item) => item.status !== "note")
  const notes = offer.items.filter((item) => item.status === "note")
  const shown = included.slice(0, HIGHLIGHTS)
  const more = included.length - shown.length

  return (
    <li
      id={`offer-${offer.key}`}
      className="flex h-full min-w-0 scroll-mt-28 flex-col rounded-[26px] bg-(--t-bg-deep)"
      style={{
        border: held
          ? `2px solid ${T.accent.primary}`
          : `1px solid ${T.border.line}`,
        padding: held ? 23 : 24,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)"
          >
            <Icon height={20} icon={offer.icon} width={20} />
          </span>
          <h4 className="type-h3 m-0">{offer.name}</h4>
        </div>
        {held ? <CurrentPlanBadge /> : null}
      </div>

      <p
        className="m-0 mt-5 text-[28px] leading-tight"
        style={{ fontFamily: T.font.sans, fontWeight: 500 }}
      >
        {offer.priceLabel}
      </p>
      <p className="m-0 mt-1 text-sm leading-[1.5] text-(--t-ink-dim)">
        {offer.priceNote}
      </p>
      <p className="m-0 mt-4 text-base leading-[1.5]">{offer.who}</p>

      <ul
        className="m-0 mt-5 flex list-none flex-col gap-2.5 border-t p-0 pt-5"
        style={{ borderColor: T.border.divider }}
      >
        {shown.map((item) => (
          <IncludeItem key={item.text} item={item} />
        ))}
      </ul>
      {more > 0 ? (
        <a
          href="#plan-comparison"
          className="mt-3 inline-flex min-h-11 w-fit items-center text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
        >
          {m("copy.moreInComparison", { count: more })}
        </a>
      ) : null}
      {notes.map((item) => (
        <p
          key={item.text}
          className="m-0 mt-4 flex gap-2 text-sm leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            height={16}
            icon="mdi:information-outline"
            width={16}
          />
          <span>{item.text}</span>
        </p>
      ))}

      <div className="mt-auto pt-6">
        {cta ? (
          <GlobalLink
            className={`${PILL} ${
              primary
                ? "bg-(--t-action-primary) text-white hover:bg-(--t-action-primary-hover)"
                : "border border-(--t-border-hi) bg-(--t-bg-deep) text-(--t-ink-base) hover:bg-(--t-bg-surface)"
            }`}
            href={cta.href}
          >
            {cta.label}
            <Icon
              aria-hidden="true"
              height={17}
              icon="mdi:arrow-right"
              width={17}
            />
          </GlobalLink>
        ) : (
          <p
            className="m-0 flex min-h-12 items-center justify-center gap-2 text-sm font-medium"
            style={{ color: T.ink.dim }}
          >
            <Icon
              aria-hidden="true"
              height={16}
              icon="mdi:check"
              style={{ color: T.accent.ok }}
              width={16}
            />
            {m("copy.signedIn")}
          </p>
        )}
        {offer.key === "contributor" ? (
          <GlobalLink
            href="/community/supporters"
            className="mt-2 flex min-h-11 items-center justify-center text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {m("copy.meetSupporters")}
          </GlobalLink>
        ) : null}
      </div>
    </li>
  )
}

const FREE_KEYS: readonly OfferKey[] = ["explorer", "contributor", "staff"]
const PAID_KEYS: readonly OfferKey[] = ["api", "sponsor"]

function OfferGroup({
  id,
  title,
  lead,
  keys,
  viewer,
}: {
  readonly id: string
  readonly title: string
  readonly lead: string
  readonly keys: readonly OfferKey[]
  readonly viewer: OfferViewer
}) {
  const offerOf = useOffer()
  const held = heldOffers(viewer)

  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={id} className="type-h3 m-0">
          {title}
        </h3>
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          {lead}
        </p>
      </div>
      <ul
        className={`m-0 grid list-none grid-cols-1 gap-4 p-0 ${
          keys.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {keys.map((key) => (
          <OfferCard
            key={key}
            offer={offerOf(key)}
            viewer={viewer}
            held={held.has(key)}
          />
        ))}
      </ul>
    </section>
  )
}

/**
 * The five ways to take part, in two groups: Explorer, Contributor and
 * Verified Staff are free; API Access and sponsorship are for organisations
 * that pay. None of them buys trust, ranking or editorial treatment.
 */
export function OfferCards({ viewer }: { readonly viewer: OfferViewer }) {
  const m = useMembershipContent()

  return (
    <section aria-labelledby="offers-h">
      <PlanSectionHeader
        id="offers-h"
        title={m("copy.offersTitle")}
        sub={m("copy.offersLead")}
      />
      <div className="flex flex-col gap-10">
        <OfferGroup
          id="offers-free-h"
          title={m("copy.freeGroupTitle")}
          lead={m("copy.freeGroupLead")}
          keys={FREE_KEYS}
          viewer={viewer}
        />
        <OfferGroup
          id="offers-paid-h"
          title={m("copy.paidGroupTitle")}
          lead={m("copy.paidGroupLead")}
          keys={PAID_KEYS}
          viewer={viewer}
        />
      </div>
      <p
        className="m-0 mt-6 flex items-start gap-2 text-sm leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          height={16}
          icon="mdi:shield-check-outline"
          style={{ color: T.accent.ok }}
          width={16}
        />
        <span>
          {m("copy.independence")}{" "}
          <a
            href="#plan-comparison"
            className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {m("copy.compare")}
          </a>
        </span>
      </p>
    </section>
  )
}
