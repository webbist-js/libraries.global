"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { splitPrice, yearlySavingMonths } from "@/lib/plan-compare"
import {
  planCard,
  type PlanCard,
  type PlanCardKey,
  PRICES_ARE_PLACEHOLDERS,
  PRO_STANDARD_PRICE_NOTE,
} from "@/lib/plans"

import { IncludeItem, includeLabel, PlanSectionHeader } from "./PlanBits"

type Billing = "monthly" | "yearly"

const MEMBERSHIP: readonly PlanCardKey[] = ["supporter", "pro", "team"]

/** One line on what the unbuilt features add up to, per plan. */
const ROADMAP_SUMMARY: Partial<Record<PlanCardKey, string>> = {
  pro: "Analysis layers, reach tools, library watching and side-by-side comparison.",
  team: "Traffic reports, a shared workspace, bulk updates, an embeddable finder and higher API quotas.",
}

const PILL =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[15px] font-semibold no-underline"

function BillingToggle({
  billing,
  onChange,
  savingMonths,
}: {
  readonly billing: Billing
  readonly onChange: (b: Billing) => void
  readonly savingMonths: number | null
}) {
  const tUi = useUiTranslations("ui")

  const options: [Billing, string][] = [
    ["monthly", "Monthly"],
    ["yearly", "Yearly"],
  ]

  return (
    <div
      aria-label={tUi("billing_period")}
      className="inline-flex rounded-full border p-1"
      role="radiogroup"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      {options.map(([value, label]) => {
        const on = billing === value

        return (
          <button
            key={value}
            aria-checked={on}
            className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors"
            onClick={() => onChange(value)}
            onKeyDown={(e) => {
              if (
                ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key
                )
              ) {
                e.preventDefault()
                onChange(value === "monthly" ? "yearly" : "monthly")
              }
            }}
            role="radio"
            style={
              on
                ? { background: T.ink.base, color: "#fff" }
                : { color: T.ink.base }
            }
            tabIndex={on ? 0 : -1}
            type="button"
          >
            {label}
            {value === "yearly" && savingMonths ? (
              <span
                className="rounded-full px-2 py-0.5 text-[12px] font-semibold"
                style={{
                  background: TYPE_TINT.public.bg,
                  color: TYPE_TINT.public.fg,
                }}
              >
                {savingMonths} months free
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function Price({
  plan,
  billing,
}: {
  readonly plan: PlanCard
  readonly billing: Billing
}) {
  if (plan.price === "free") return null
  const { monthly, yearly } = plan.price
  // Team is yearly only, so it shows its yearly price in both modes.
  const shown = billing === "yearly" ? (yearly ?? monthly) : (monthly ?? yearly)
  const other = shown === monthly ? yearly : monthly
  const parts = splitPrice(shown)
  const otherParts = splitPrice(other)

  return (
    <div>
      <p className="m-0 flex flex-wrap items-baseline gap-x-1.5">
        {parts ? (
          <>
            <span
              className="text-[48px] leading-none"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              {parts.amount}
            </span>
            <span className="text-[15px]" style={{ color: T.ink.dim }}>
              / {parts.period}
              {parts.suffix}
            </span>
          </>
        ) : (
          <span
            className="text-[32px] leading-none"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {shown}
          </span>
        )}
      </p>
      {otherParts ? (
        <p className="m-0 mt-2 text-[14px]" style={{ color: T.ink.dim }}>
          Or {otherParts.amount} a {otherParts.period}.
        </p>
      ) : null}
    </div>
  )
}

function Cta({
  plan,
  current,
}: {
  readonly plan: PlanCard
  readonly current: boolean
}) {
  if (current)
    return (
      <GlobalLink
        className={`${PILL} bg-(--t-accent-primary) text-white hover:bg-(--t-accent-primary-hover)`}
        href="/map"
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon="mdi:arrow-right"
          width={17}
        />
        Open the Atlas
      </GlobalLink>
    )

  if (plan.cta.kind === "contact" && plan.cta.href)
    return (
      <a
        className={`${PILL} border bg-white transition-colors hover:bg-(--t-bg-surface)`}
        href={plan.cta.href}
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon="mdi:email-outline"
          width={17}
        />
        {plan.cta.label}
      </a>
    )

  return (
    <button
      className={`${PILL} cursor-not-allowed`}
      disabled
      style={{ background: T.bg.muted, color: T.ink.dim }}
      type="button"
    >
      <Icon
        aria-hidden="true"
        height={17}
        icon="mdi:clock-outline"
        width={17}
      />
      {plan.cta.label}
    </button>
  )
}

function Roadmap({ plan }: { readonly plan: PlanCard }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const soon = plan.includes.filter((i) => i.kind === "soon")
  if (soon.length === 0) return null

  return (
    <div
      className="rounded-[14px] border p-4"
      style={{ background: T.bg.surface, borderColor: T.border.line }}
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          height={16}
          icon="mdi:clock-outline"
          style={{ color: T.accent.primary }}
          width={16}
        />
        <p className="m-0 flex-1 text-[14px] font-semibold">
          On the roadmap{" "}
          <span className="font-medium" style={{ color: T.ink.dim }}>
            {soon.length}
          </span>
        </p>
        <button
          aria-controls={listId}
          aria-expanded={open}
          className="text-[13.5px] font-semibold underline underline-offset-[3px]"
          onClick={() => setOpen((o) => !o)}
          style={{ color: T.accent.primary }}
          type="button"
        >
          {open ? "Show less" : "Show all"}
        </button>
      </div>
      {ROADMAP_SUMMARY[plan.key] ? (
        <p
          className="m-0 mt-1.5 text-[13.5px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          {ROADMAP_SUMMARY[plan.key]}
        </p>
      ) : null}
      <ul
        className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[13.5px]"
        hidden={!open}
        id={listId}
        style={{ color: T.ink.dim }}
      >
        {soon.map((item) => (
          <li key={item.text} className="flex gap-2">
            <span aria-hidden="true">·</span>
            {includeLabel(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlanColumn({
  plan,
  billing,
  current,
}: {
  readonly plan: PlanCard
  readonly billing: Billing
  readonly current: boolean
}) {
  const live = plan.includes.filter((i) => i.kind === "feature")
  const notes = plan.includes.filter((i) => i.kind === "note")
  const note = plan.price === "free" ? undefined : plan.price.note

  return (
    <li
      id={`plan-${plan.key}`}
      // From md up the cards share row tracks (subgrid), so each price,
      // blurb, button and list starts at the same height in all three.
      className="flex min-w-0 scroll-mt-28 flex-col gap-5 rounded-[22px] bg-white md:row-span-4 md:grid md:grid-rows-subgrid"
      style={{
        border: current
          ? `2px solid ${T.accent.primary}`
          : `1px solid ${T.border.line}`,
        // Keep content aligned whichever border width applies.
        padding: current ? 23 : 24,
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="m-0 text-[26px] leading-tight"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {plan.name}
          </h3>
          {current ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold text-white"
              style={{ background: T.accent.primary }}
            >
              <Icon
                aria-hidden="true"
                height={14}
                icon="mdi:check"
                width={14}
              />
              Your plan
            </span>
          ) : null}
        </div>
        <Price billing={billing} plan={plan} />
        {note ? (
          <p
            className="m-0 text-[13.5px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            {note}
          </p>
        ) : null}
      </div>
      <p
        className="m-0 text-[14.5px] leading-[1.5]"
        style={{ color: T.ink.base }}
      >
        For {plan.who.charAt(0).toLowerCase() + plan.who.slice(1)}.
      </p>

      <Cta current={current} plan={plan} />

      <div
        className="flex flex-col gap-3 border-t pt-5"
        style={{ borderColor: T.border.divider }}
      >
        <p className="m-0 text-[13.5px] font-bold">Included now</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {live.map((item) => (
            <IncludeItem key={item.text} item={item} />
          ))}
        </ul>
        {notes.map((item) => (
          <p
            key={item.text}
            className="m-0 rounded-[12px] px-3.5 py-2.5 text-[13.5px] leading-[1.5]"
            style={{ background: T.bg.muted, color: T.ink.dim }}
          >
            {item.text}
          </p>
        ))}
        <div className="mt-auto pt-2 empty:hidden">
          <Roadmap plan={plan} />
        </div>
      </div>
    </li>
  )
}

/** Supporter, Pro and Team, with a monthly / yearly switch. */
export function MembershipPlans({
  currentPlan,
}: {
  readonly currentPlan: string
}) {
  const tUi = useUiTranslations("ui")

  const [billing, setBilling] = useState<Billing>("monthly")
  const plans = MEMBERSHIP.map(planCard)
  // The toggle's chip claims a saving only if every monthly plan has it.
  const savings = plans
    .filter((p) => p.price !== "free" && p.price.monthly)
    .map((p) => yearlySavingMonths(p.price))
  const savingMonths =
    savings.length > 0 && savings.every((m) => m === savings[0])
      ? savings[0]!
      : null

  return (
    <section aria-labelledby="membership-h">
      <PlanSectionHeader
        control={
          <BillingToggle
            billing={billing}
            onChange={setBilling}
            savingMonths={savingMonths}
          />
        }
        id="membership-h"
        sub="Support the project, or add analysis and export on top of the free index."
        title={tUi("membership")}
      />
      <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanColumn
            key={plan.key}
            billing={billing}
            current={plan.key === currentPlan}
            plan={plan}
          />
        ))}
      </ul>
      {PRICES_ARE_PLACEHOLDERS ? (
        <p
          className="m-0 mt-4 flex items-start gap-2 text-[14px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          <Icon
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            height={16}
            icon="mdi:information-outline"
            style={{ color: TYPE_TINT.national.fg }}
            width={16}
          />
          <span>
            <strong style={{ color: T.ink.base }}>
              Prices are placeholders.
            </strong>{" "}
            They may change before checkout opens, and nobody is charged until
            then. {PRO_STANDARD_PRICE_NOTE}
          </span>
        </p>
      ) : null}
    </section>
  )
}
