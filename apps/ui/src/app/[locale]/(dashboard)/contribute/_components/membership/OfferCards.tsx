"use client"

import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  type LocalizedOffer,
  useMembershipContent,
  useOffer,
} from "@/lib/localized-plans"
import { heldOffers, OFFER_KEYS, type OfferViewer } from "@/lib/plans"

import { CurrentPlanBadge, PlanFeatures, PlanSectionHeader } from "./PlanBits"

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

  return (
    <li
      id={`offer-${offer.key}`}
      className="flex min-w-0 scroll-mt-28 flex-col gap-5 rounded-[26px] bg-(--t-bg-deep)"
      style={{
        border: held
          ? `2px solid ${T.accent.primary}`
          : `1px solid ${T.border.line}`,
        padding: held ? 19 : 20,
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)"
            >
              <Icon height={20} icon={offer.icon} width={20} />
            </span>
            <h3 className="type-h3 m-0">{offer.name}</h3>
          </div>
          {held ? <CurrentPlanBadge /> : null}
        </div>
        <div>
          <p
            className="m-0 text-[28px] leading-tight"
            style={{ fontFamily: T.font.sans, fontWeight: 500 }}
          >
            {offer.priceLabel}
          </p>
          <p className="m-0 mt-1.5 text-sm leading-[1.5] text-(--t-ink-dim)">
            {offer.priceNote}
          </p>
        </div>
      </div>
      <p className="m-0 text-sm leading-[1.5]" style={{ color: T.ink.base }}>
        {offer.who}
      </p>
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
          className="m-0 flex min-h-12 items-center gap-2 text-sm font-medium"
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
      <PlanFeatures items={offer.items} />
    </li>
  )
}

/**
 * The five ways to take part. Explorer, Contributor and Verified Staff are
 * free; API Access is the only purchase; Sponsor is an agreement with an
 * organisation. None of them buys trust, ranking or editorial treatment.
 */
export function OfferCards({ viewer }: { readonly viewer: OfferViewer }) {
  const m = useMembershipContent()
  const offerOf = useOffer()
  const held = heldOffers(viewer)

  return (
    <section aria-labelledby="offers-h">
      <PlanSectionHeader
        id="offers-h"
        title={m("copy.offersTitle")}
        sub={m("copy.offersLead")}
      />
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {OFFER_KEYS.map((key) => (
          <OfferCard
            key={key}
            offer={offerOf(key)}
            viewer={viewer}
            held={held.has(key)}
          />
        ))}
      </ul>
      <p
        className="m-0 mt-4 flex items-start gap-2 text-sm leading-[1.6]"
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
            href="#compare-plans"
            className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {m("copy.compare")}
          </a>
        </span>
      </p>
    </section>
  )
}
