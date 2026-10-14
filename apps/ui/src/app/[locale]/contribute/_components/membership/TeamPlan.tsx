"use client"

import { Icon } from "@iconify/react"
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

/** The annual enquiry offer stays alongside the two personal memberships. */
export function TeamPlan({ current }: { readonly current: boolean }) {
  const headingId = useId()
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
      className="flex min-w-0 scroll-mt-28 flex-col gap-5 rounded-[26px] border bg-white p-5 md:col-span-2 md:row-span-4 md:grid md:grid-rows-subgrid lg:col-span-1"
      style={{
        borderColor: current ? T.accent.primary : T.border.line,
        borderWidth: current ? 2 : 1,
        padding: current ? 19 : 20,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id={headingId}
            className="m-0 text-[30px] leading-tight"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {team.name}
          </h3>
          {current ? (
            <CurrentPlanBadge />
          ) : (
            <span className="rounded-full bg-(--t-bg-muted) px-2.5 py-1 text-[12px] font-semibold text-(--t-ink-dim)">
              Invoiced yearly
            </span>
          )}
        </div>
        <div>
          <p
            aria-live="polite"
            aria-atomic="true"
            className="m-0 flex flex-wrap items-baseline gap-x-2"
          >
            <span
              className="text-[48px] leading-none"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              {pounds(totalYear)}
            </span>
            <span className="text-[14px] text-(--t-ink-dim)">
              / year ex VAT
            </span>
          </p>
          <p className="m-0 mt-2 text-[14px] leading-[1.5] text-(--t-ink-dim)">
            Includes {seats} seats. Bought per library service.
          </p>
        </div>
      </div>
      <p className="m-0 text-[14.5px] leading-[1.5]">
        For {team.who.charAt(0).toLowerCase() + team.who.slice(1)} managing
        their staff.
      </p>
      <a
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-4 text-[15px] font-semibold no-underline hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2"
        href={TEAM_CONTACT_HREF}
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon="mdi:email-outline"
          width={17}
        />
        {team.cta.label}
      </a>
      <PlanFeatures plan={team}>
        <div className="rounded-[18px] border border-(--t-border-line) bg-(--t-bg-surface) p-3.5">
          <PlanToggle
            className="flex w-full flex-col rounded-[20px] md:flex-row lg:flex-col xl:flex-row [&_button]:px-3 [&_button]:text-[12.5px]"
            label="Team pricing"
            onChange={setService}
            options={[
              { value: "standard", label: "Standard" },
              {
                value: "public",
                label: "Public library service",
                badge: (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: TYPE_TINT.public.bg,
                      color: TYPE_TINT.public.fg,
                    }}
                  >
                    {pricing.team.publicServiceDiscountPercent}% off
                  </span>
                ),
              },
            ]}
            value={service}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">Seats</span>
            <div className="flex items-center gap-2">
              <button
                aria-label="Remove a Team seat"
                className="grid size-11 place-items-center rounded-full border border-(--t-border-hi) bg-white text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={seats <= pricing.team.includedSeats}
                onClick={() => setSeats((value) => value - 1)}
                type="button"
              >
                <Icon
                  aria-hidden="true"
                  height={18}
                  icon="mdi:minus"
                  width={18}
                />
              </button>
              <span className="text-[13px] font-bold tabular-nums">
                {seats} seats
              </span>
              <button
                aria-label="Add a Team seat"
                className="grid size-11 place-items-center rounded-full border border-(--t-border-hi) bg-white text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => setSeats((value) => value + 1)}
                type="button"
              >
                <Icon
                  aria-hidden="true"
                  height={18}
                  icon="mdi:plus"
                  width={18}
                />
              </button>
            </div>
          </div>
          <dl className="m-0 mt-3 space-y-1 text-[12.5px] text-(--t-ink-dim)">
            <div className="flex flex-wrap justify-between gap-2">
              <dt>First {pricing.team.includedSeats} seats</dt>
              <dd className="m-0 font-semibold">{pounds(baseYear)} / year</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Each extra seat</dt>
              <dd className="m-0 font-semibold">
                {pounds(extraSeatYear)} / year
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt>Optional API add-on</dt>
              <dd className="m-0 font-semibold">
                {pounds(pricing.teamApi.month)} / month
              </dd>
            </div>
          </dl>
          <p className="m-0 mt-3 text-[12px] leading-[1.5] text-(--t-ink-dim)">
            API billed separately
            {publicService
              ? "; the Team discount is subject to eligibility and does not apply to the API add-on"
              : ""}
            .
          </p>
        </div>
        <p className="m-0 text-[13px] leading-[1.5] text-(--t-ink-dim)">
          We’ll confirm your quote and invoice. No card needed.
        </p>
        <div className="mt-1">
          <PlanRoadmap plan={team} />
        </div>
      </PlanFeatures>
    </li>
  )
}
