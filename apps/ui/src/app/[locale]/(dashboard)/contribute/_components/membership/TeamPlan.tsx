"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"
import { useId, useLayoutEffect, useRef, useState } from "react"

import { preferredTeams, type SessionTeam } from "@/lib/access-server"
import { pushCheckoutEvent } from "@/lib/checkout-analytics"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { useMembershipPlan } from "@/lib/localized-plans"
import pricing from "@/lib/membership-pricing.json"
import { Link } from "@/lib/navigation"

import { CurrentPlanBadge, PlanFeatures } from "./PlanBits"
import { PlanRoadmap } from "./PlanRoadmap"
import { PlanToggle } from "./PlanToggle"

import styles from "./membership-plans.module.css"

/** Explain the separate API subscription without implying it is in the Team total. */
function TeamApiOffer({
  existing,
  monthlyPrice,
  selected,
  onSelectedChange,
}: {
  readonly selected?: boolean
  readonly onSelectedChange?: (selected: boolean) => void
  readonly existing: boolean
  readonly monthlyPrice: string
}) {
  const t = useTranslations("membershipPlans")
  const purchase = useTranslations("teamPurchase")

  return (
    <div className={styles.apiOffer}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon aria-hidden icon="mdi:code-tags" width={21} />
          <h5 className="type-small-heading m-0">{t("apiLabel")}</h5>
        </div>
        <span className="text-sm font-semibold text-(--t-accent-primary)">
          {t("monthlyAmount", { amount: monthlyPrice })}
        </span>
      </div>
      <p className="m-0 mt-3 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("apiLead")}
      </p>
      {onSelectedChange ? (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-(--t-accent-primary)"
          />
          <span>
            <strong className="block">{purchase("selectApi")}</strong>
            <span className="mt-1 block text-xs text-(--t-ink-dim)">
              {purchase("separateCharges")}
            </span>
          </span>
        </label>
      ) : null}
      <ul className="m-0 mt-4 grid list-none gap-3 p-0 text-sm leading-relaxed">
        {(
          [
            ["mdi:database-search-outline", "apiSearch"],
            ["mdi:key-outline", "apiKeys"],
            ["mdi:chart-box-outline", "apiUsage"],
          ] as const
        ).map(([icon, key]) => (
          <li key={key} className="flex items-start gap-2.5">
            <Icon
              aria-hidden
              icon={icon}
              width={18}
              className="mt-0.5 shrink-0 text-(--t-accent-primary)"
            />
            {t(key)}
          </li>
        ))}
      </ul>
      <p className="m-0 mt-4 text-xs leading-relaxed text-(--t-ink-dim)">
        {t("apiSeparate")}
      </p>
      {existing ? (
        <Link
          className={`${styles.actionLink} mt-4 inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-full border border-(--t-accent-primary) bg-(--t-bg-deep) px-4 text-sm font-semibold text-(--t-accent-primary) no-underline focus-visible:outline-2 focus-visible:outline-offset-2`}
          href="/developers"
        >
          {t("apiExplore")}
          <Icon aria-hidden icon="mdi:arrow-right" width={18} />
        </Link>
      ) : (
        <p className="m-0 mt-4 rounded-xl bg-(--t-bg-deep) p-3 text-xs leading-relaxed text-(--t-ink-dim)">
          {selected ? purchase("afterTeamPayment") : t("apiAfterActivation")}
        </p>
      )}
    </div>
  )
}

/** The right-hand plan opens across the personal plans without moving its summary. */
export function TeamPlan({
  current,
  teams = [],
  expanded,
  onExpandedChange,
}: {
  readonly expanded: boolean
  readonly onExpandedChange: (expanded: boolean) => void
  readonly current: boolean
  readonly teams?: SessionTeam[]
}) {
  const existing = preferredTeams(teams)[0]
  const getPlan = useMembershipPlan()
  const team = getPlan("team")
  const locale = useLocale()
  const pounds = (pence: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: pricing.currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(pence / 100)
  const t = useTranslations("membershipPlans")
  const headingId = useId()
  const quoteId = useId()
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const quoteHeadingRef = useRef<HTMLHeadingElement>(null)
  const [apiAddon, setApiAddon] = useState(false)
  const [service, setService] = useState<"standard" | "public">("standard")
  const [seats, setSeats] = useState(pricing.team.includedSeats)
  const publicService = service === "public"
  const rate = publicService
    ? 1 - pricing.team.publicServiceDiscountPercent / 100
    : 1
  const baseYear = Math.round(pricing.team.year * rate)
  const extraSeatYear = Math.round(pricing.team.extraSeatYear * rate)
  const totalYear =
    baseYear + (seats - pricing.team.includedSeats) * extraSeatYear

  useLayoutEffect(() => {
    if (expanded) quoteHeadingRef.current?.focus()
  }, [expanded])

  function closeEstimator() {
    pushCheckoutEvent("pricing_action", {
      product: "team",
      billing_interval: "year",
      action_type: "close_team",
    })
    onExpandedChange(false)
    triggerRef.current?.focus()
  }

  return (
    <li
      aria-labelledby={headingId}
      id="plan-team"
      className={styles.team}
      data-expanded={expanded}
      data-current={current}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded && !event.defaultPrevented) {
          event.preventDefault()
          closeEstimator()
        }
      }}
    >
      <div className={styles.summary}>
        <header className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <h3 id={headingId} className="type-h3 m-0">
              {team.name}
            </h3>
            {current ? <CurrentPlanBadge /> : null}
          </div>
          <div>
            <p className="m-0 flex flex-wrap items-baseline gap-x-1.5">
              <span
                className="text-[48px] leading-none"
                style={{ fontFamily: T.font.sans, fontWeight: 500 }}
              >
                {pounds(pricing.team.year)}
              </span>
              <span className="text-sm text-(--t-ink-dim)">
                {t("annualUnit")}
              </span>
            </p>
            <p className="m-0 mt-2 text-sm text-(--t-ink-dim)">
              {t("includedSeats", { count: pricing.team.includedSeats })}{" "}
              {t("invoicedYearly")}.
            </p>
          </div>
        </header>
        <p className="m-0 text-sm leading-[1.5] text-(--t-ink-base)">
          {t("teamLead")}
        </p>
        <button
          ref={triggerRef}
          aria-controls={panelId}
          aria-expanded={expanded}
          className={`${styles.continueButton} inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-(--t-accent-primary) bg-(--t-accent-chip) px-4 text-base font-semibold text-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)`}
          onClick={() => {
            if (expanded) closeEstimator()
            else {
              pushCheckoutEvent("pricing_action", {
                product: "team",
                billing_interval: "year",
                action_type: "open_team",
              })
              onExpandedChange(true)
            }
          }}
          type="button"
        >
          <span>{expanded ? t("backToPlans") : t("continueTeam")}</span>
          <Icon
            aria-hidden
            className={styles.continueIcon}
            icon={expanded ? "mdi:arrow-right" : "mdi:arrow-left"}
            width={18}
          />
        </button>
        <div className={styles.features}>
          <PlanFeatures plan={team}>
            <div className="mt-auto pt-5">
              <PlanRoadmap plan={team} />
            </div>
          </PlanFeatures>
        </div>
      </div>
      <section
        aria-labelledby={quoteId}
        id={panelId}
        hidden={!expanded}
        inert={!expanded}
        className={styles.estimator}
      >
        {existing ? (
          <div className={styles.workspace}>
            <div>
              <h4
                ref={quoteHeadingRef}
                tabIndex={-1}
                id={quoteId}
                className="type-h3 m-0 [overflow-wrap:anywhere]"
              >
                {existing.name}
              </h4>
              <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {t("existingTeamLead")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-(--t-accent-chip) px-3 py-1.5 text-(--t-accent-primary)">
                  {t("yourTeam")}
                </span>
                <span className="rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-1.5">
                  {t("teamLibraryCount", { count: existing.libraryCount })}
                </span>
                <span className="rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-1.5">
                  {t(
                    existing.role === "organiser"
                      ? "teamOrganiser"
                      : "teamMember"
                  )}
                </span>
              </div>
            </div>
            <div className="grid gap-3">
              <Link
                className={`${styles.workspaceAction} ${styles.primaryAction}`}
                aria-label={t("manageTeam")}
                aria-describedby={`${panelId}-manage`}
                href="/staff/teams"
              >
                <Icon aria-hidden icon="mdi:account-group-outline" width={24} />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{t("manageTeam")}</strong>
                  <span
                    id={`${panelId}-manage`}
                    className="mt-1 block text-xs leading-relaxed opacity-85"
                  >
                    {t("manageTeamDetail")}
                  </span>
                </span>
                <Icon aria-hidden icon="mdi:arrow-right" width={18} />
              </Link>
              <Link
                className={styles.workspaceAction}
                href="/staff/teams/billing"
              >
                <Icon aria-hidden icon="mdi:credit-card-outline" width={24} />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{t("teamBilling")}</strong>
                  <span className="mt-1 block text-xs leading-relaxed text-(--t-ink-dim)">
                    {t("teamBillingDetail")}
                  </span>
                </span>
                <Icon aria-hidden icon="mdi:arrow-right" width={18} />
              </Link>
            </div>
            <TeamApiOffer
              existing
              monthlyPrice={pounds(pricing.teamApi.month)}
            />
          </div>
        ) : (
          <>
            <h4
              ref={quoteHeadingRef}
              tabIndex={-1}
              id={quoteId}
              className="type-h3 m-0"
            >
              {t("estimateTeam")}
            </h4>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("estimateLead")}
            </p>
            <div className="mt-5">
              <p className="m-0 mb-2 text-sm font-semibold">
                {t("serviceType")}
              </p>
              <PlanToggle
                variant="cards"
                label={t("teamPricing")}
                onChange={(value) => {
                  setService(value)
                  pushCheckoutEvent("pricing_action", {
                    product: "team",
                    billing_interval: "year",
                    action_type:
                      value === "public" ? "public_service" : "standard",
                  })
                }}
                options={[
                  {
                    value: "standard",
                    label: t("standard"),
                    description: t("standardDescription"),
                  },
                  {
                    value: "public",
                    label: t("publicService"),
                    description: t("publicDescription"),
                    badge: (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: TYPE_TINT.public.bg,
                          color: TYPE_TINT.public.fg,
                        }}
                      >
                        {t("discount", {
                          percent: pricing.team.publicServiceDiscountPercent,
                        })}
                      </span>
                    ),
                  },
                ]}
                value={service}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-(--t-border-line) bg-(--t-bg-deep) p-3.5">
              <div className="min-w-0 flex-1 basis-40">
                <p className="m-0 text-sm font-semibold">{t("seats")}</p>
                <p className="m-0 mt-1 text-xs leading-relaxed text-(--t-ink-dim)">
                  {t("includedSeats", { count: pricing.team.includedSeats })}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  aria-label={t("removeSeat")}
                  className="grid size-11 place-items-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={seats <= pricing.team.includedSeats}
                  onClick={() => setSeats((value) => value - 1)}
                  type="button"
                >
                  <Icon aria-hidden height={18} icon="mdi:minus" width={18} />
                </button>
                <span className="min-w-12 text-center text-sm font-bold tabular-nums">
                  {t("seatCount", { count: seats })}
                </span>
                <button
                  aria-label={t("addSeat")}
                  className="grid size-11 place-items-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) active:scale-[0.97]"
                  disabled={seats >= 500}
                  onClick={() => setSeats((value) => Math.min(500, value + 1))}
                  type="button"
                >
                  <Icon aria-hidden height={18} icon="mdi:plus" width={18} />
                </button>
              </div>
            </div>
            <TeamApiOffer
              existing={false}
              selected={apiAddon}
              onSelectedChange={(selected) => {
                setApiAddon(selected)
                pushCheckoutEvent("pricing_action", {
                  product: "team",
                  billing_interval: "year",
                  api_addon: selected ? "selected" : "not_selected",
                  action_type: selected ? "select_api" : "remove_api",
                })
              }}
              monthlyPrice={pounds(pricing.teamApi.month)}
            />
            <div className={styles.quoteTotal}>
              <p className="m-0 text-xs font-semibold text-(--t-ink-dim)">
                {t("annualEstimate")}
              </p>
              <p
                aria-live="polite"
                aria-atomic="true"
                className="m-0 mt-2 flex flex-wrap items-baseline gap-x-2"
              >
                <span className="font-sans text-[44px] leading-none tracking-[-0.025em]">
                  {pounds(totalYear)}
                </span>
                <span className="text-sm text-(--t-ink-dim)">
                  {t("annualUnit")}
                </span>
              </p>
              <dl className="m-0 mt-4 grid gap-2 text-sm text-(--t-ink-dim)">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>
                    {t("firstSeats", { count: pricing.team.includedSeats })}
                  </dt>
                  <dd className="m-0 font-semibold">
                    {t("annualAmount", { amount: pounds(baseYear) })}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt>{t("eachExtra")}</dt>
                  <dd className="m-0 font-semibold">
                    {t("annualAmount", { amount: pounds(extraSeatYear) })}
                  </dd>
                </div>
              </dl>
              {publicService ? (
                <p className="m-0 mt-3 rounded-[12px] bg-(--t-accent-chip)/50 px-3 py-2.5 text-xs leading-relaxed text-(--t-ink-dim)">
                  {t("discountNote")}
                </p>
              ) : null}
              <Link
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-(--t-action-primary) px-4 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) active:scale-[0.97]"
                onClick={() =>
                  pushCheckoutEvent("pricing_action", {
                    product: "team",
                    billing_interval: "year",
                    api_addon: apiAddon ? "selected" : "not_selected",
                    action_type: "continue",
                  })
                }
                href={`/staff/teams/new?seats=${seats}${apiAddon ? "&api=1" : ""}${publicService ? "&service=public" : ""}`}
              >
                <Icon
                  aria-hidden
                  height={17}
                  icon="mdi:account-group-outline"
                  width={17}
                />
                {team.cta.label}
              </Link>
              <p className="m-0 mt-2.5 text-xs leading-relaxed text-(--t-ink-dim)">
                {t("confirmQuote")}
              </p>
            </div>
          </>
        )}
      </section>
    </li>
  )
}
