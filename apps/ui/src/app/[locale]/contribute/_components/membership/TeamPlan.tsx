"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"
import pricing from "@/lib/membership-pricing.json"
import { planCard, TEAM_CONTACT_HREF } from "@/lib/plans"

import { CurrentPlanBadge, PlanFeatures } from "./PlanBits"
import { PlanRoadmap } from "./PlanRoadmap"
import { PlanToggle } from "./PlanToggle"

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: pricing.currency,
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})
const pounds = (pence: number) => gbp.format(pence / 100)
const team = planCard("team")

/** Team has its own space: service benefits beside an annual quote builder. */
export function TeamPlan({ current }: { readonly current: boolean }) {
  const t = useTranslations("membershipPlans")
  const headingId = useId()
  const quoteId = useId()
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

  return (
    <li
      aria-labelledby={headingId}
      id="plan-team"
      className="col-span-full grid min-w-0 scroll-mt-28 gap-6 rounded-[26px] border bg-white p-5 sm:gap-8 sm:p-6 lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:gap-y-5"
      style={{
        borderColor: current ? T.accent.primary : T.border.line,
        borderWidth: current ? 2 : 1,
      }}
    >
      <header className="min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--t-accent-chip) px-2.5 py-1 text-[12px] font-semibold text-(--t-accent-primary)">
            <Icon
              aria-hidden
              icon="mdi:account-group-outline"
              width={15}
              height={15}
            />
            {t("organisations")}
          </span>
          <span className="rounded-full bg-(--t-bg-muted) px-2.5 py-1 text-[12px] font-semibold text-(--t-ink-dim)">
            {t("invoicedYearly")}
          </span>
          {current ? <CurrentPlanBadge /> : null}
        </div>
        <h3
          id={headingId}
          className="m-0 font-serif text-[36px] leading-tight tracking-[-0.02em]"
        >
          {team.name}
        </h3>
        <p className="m-0 mt-2 max-w-[48ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
          {t("teamLead")}
        </p>
      </header>

      <section
        aria-labelledby={quoteId}
        className="min-w-0 rounded-[22px] border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5 lg:col-start-2 lg:row-span-3 lg:row-start-1"
      >
        <h4
          id={quoteId}
          className="m-0 font-serif text-[26px] leading-tight tracking-[-0.02em]"
        >
          {t("estimateTeam")}
        </h4>
        <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-(--t-ink-dim)">
          {t("estimateLead")}
        </p>
        <div className="mt-5">
          <p className="m-0 mb-2 text-[13px] font-semibold">
            {t("serviceType")}
          </p>
          <PlanToggle
            variant="cards"
            label={t("teamPricing")}
            onChange={setService}
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
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-(--t-border-line) bg-white p-3.5">
          <div className="min-w-0 flex-1 basis-40">
            <p className="m-0 text-[14px] font-semibold">{t("seats")}</p>
            <p className="m-0 mt-1 text-[12px] leading-relaxed text-(--t-ink-dim)">
              {t("includedSeats", { count: pricing.team.includedSeats })}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              aria-label={t("removeSeat")}
              className="grid size-11 place-items-center rounded-full border border-(--t-border-hi) bg-white text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) disabled:cursor-not-allowed disabled:opacity-40"
              disabled={seats <= pricing.team.includedSeats}
              onClick={() => setSeats((value) => value - 1)}
              type="button"
            >
              <Icon aria-hidden height={18} icon="mdi:minus" width={18} />
            </button>
            <span className="min-w-12 text-center text-[13px] font-bold tabular-nums">
              {t("seatCount", { count: seats })}
            </span>
            <button
              aria-label={t("addSeat")}
              className="grid size-11 place-items-center rounded-full border border-(--t-border-hi) bg-white text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
              onClick={() => setSeats((value) => value + 1)}
              type="button"
            >
              <Icon aria-hidden height={18} icon="mdi:plus" width={18} />
            </button>
          </div>
        </div>
        <div className="mt-5 border-t border-(--t-border-line) pt-4">
          <p className="m-0 text-[12px] font-semibold text-(--t-ink-dim)">
            {t("annualEstimate")}
          </p>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="m-0 mt-2 flex flex-wrap items-baseline gap-x-2"
          >
            <span className="font-serif text-[44px] leading-none tracking-[-0.025em]">
              {pounds(totalYear)}
            </span>
            <span className="text-[13px] text-(--t-ink-dim)">
              {t("annualUnit")}
            </span>
          </p>
          <dl className="m-0 mt-4 grid gap-2 text-[12.5px] text-(--t-ink-dim)">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>{t("firstSeats", { count: pricing.team.includedSeats })}</dt>
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
            <p className="m-0 mt-3 rounded-[12px] bg-(--t-accent-chip)/50 px-3 py-2.5 text-[12px] leading-relaxed text-(--t-ink-dim)">
              {t("discountNote")}
            </p>
          ) : null}
          <a
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            href={TEAM_CONTACT_HREF}
          >
            <Icon aria-hidden height={17} icon="mdi:email-outline" width={17} />
            {team.cta.label}
          </a>
          <p className="m-0 mt-2.5 text-[12px] leading-relaxed text-(--t-ink-dim)">
            {t("confirmQuote")}
          </p>
        </div>
        <div className="mt-4 border-t border-(--t-border-line) pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
            <span className="font-semibold">{t("apiLabel")}</span>
            <span className="font-semibold text-(--t-ink-dim)">
              {t("monthlyAmount", { amount: pounds(pricing.teamApi.month) })}
            </span>
          </div>
          <p className="m-0 mt-1 text-[12px] leading-relaxed text-(--t-ink-dim)">
            {t("apiSeparate")}
          </p>
        </div>
      </section>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">
        <PlanFeatures plan={team} />
      </div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-3 lg:self-end">
        <PlanRoadmap plan={team} />
      </div>
    </li>
  )
}
