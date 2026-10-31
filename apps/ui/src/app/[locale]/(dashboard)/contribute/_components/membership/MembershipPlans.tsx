"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { CheckoutButton } from "@/components/billing/CheckoutButton"
import GlobalLink from "@/components/global/GlobalLink"
import type { SessionTeam } from "@/lib/access-server"
import { pushCheckoutEvent } from "@/lib/checkout-analytics"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { useMembershipContent, useMembershipPlan } from "@/lib/localized-plans"
import { splitPrice, yearlySavingMonths } from "@/lib/plan-compare"
import type { PlanCard, PlanCardKey } from "@/lib/plans"

import { CurrentPlanBadge, PlanFeatures, PlanSectionHeader } from "./PlanBits"
import { PlanRoadmap } from "./PlanRoadmap"
import { PlanToggle } from "./PlanToggle"
import { TeamPlan } from "./TeamPlan"

import styles from "./membership-plans.module.css"

type Billing = "monthly" | "yearly"

const MEMBERSHIP: readonly PlanCardKey[] = ["supporter", "pro"]

const PILL =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-base font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-2"

function Price({
  plan,
  billing,
}: {
  readonly plan: PlanCard
  readonly billing: Billing
}) {
  const m = useMembershipContent()
  if (plan.price === "free") return null
  const { monthly, yearly, note } = plan.price
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
              style={{ fontFamily: T.font.sans, fontWeight: 500 }}
            >
              {parts.amount}
            </span>
            <span className="text-base" style={{ color: T.ink.dim }}>
              / {m(parts.period === "month" ? "copy.month" : "copy.year")}
              {parts.suffix}
            </span>
          </>
        ) : (
          <span
            className="text-[32px] leading-none"
            style={{ fontFamily: T.font.sans, fontWeight: 500 }}
          >
            {shown}
          </span>
        )}
      </p>
      {otherParts || note ? (
        <p className="m-0 mt-2 text-sm" style={{ color: T.ink.dim }}>
          {otherParts
            ? m("copy.otherPrice", {
                amount: otherParts.amount,
                period: m(
                  otherParts.period === "month" ? "copy.month" : "copy.year"
                ),
              })
            : null}
          {note ? ` ${note}` : null}
        </p>
      ) : null}
    </div>
  )
}

function Cta({
  plan,
  current,
  purchase,
}: {
  readonly plan: PlanCard
  readonly current: boolean
  readonly purchase?: React.ReactNode
}) {
  const m = useMembershipContent()
  if (!current && purchase) return purchase
  if (current)
    return (
      <GlobalLink
        className={`${PILL} bg-(--t-action-primary) text-white hover:bg-(--t-action-primary-hover)`}
        href="/map"
      >
        <Icon
          aria-hidden="true"
          height={17}
          icon="mdi:arrow-right"
          width={17}
        />
        {m("copy.openAtlas")}
      </GlobalLink>
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

function PlanColumn({
  plan,
  billing,
  current,
  purchase,
  covered,
}: {
  readonly plan: PlanCard
  readonly billing: Billing
  readonly covered: boolean
  readonly current: boolean
  readonly purchase?: React.ReactNode
}) {
  return (
    <li
      id={`plan-${plan.key}`}
      inert={covered}
      className={`${styles.personal} flex min-w-0 scroll-mt-28 flex-col gap-5 rounded-[26px] bg-(--t-bg-deep)`}
      style={{
        border: current
          ? `2px solid ${T.accent.primary}`
          : `1px solid ${T.border.line}`,
        padding: current ? 19 : 20,
        background:
          plan.key === "pro"
            ? "color-mix(in srgb, var(--t-accent-primary) 2%, white)"
            : T.bg.deep,
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="type-h3 m-0">{plan.name}</h3>
          {current ? <CurrentPlanBadge /> : null}
        </div>
        <Price billing={billing} plan={plan} />
      </div>
      <p className="m-0 text-sm leading-[1.5]" style={{ color: T.ink.base }}>
        {plan.who}
      </p>
      <Cta current={current} plan={plan} purchase={purchase} />
      <PlanFeatures plan={plan}>
        <div className="mt-auto pt-5 empty:hidden">
          <PlanRoadmap plan={plan} />
        </div>
      </PlanFeatures>
    </li>
  )
}

/** Personal memberships share a billing period; Team has separate annual billing. */
export function MembershipPlans({
  currentPlan,
  teams = [],
  billingAvailable = false,
  supporterApproved = false,
  checkoutUser = null,
}: {
  readonly teams?: SessionTeam[]
  readonly currentPlan: string
  readonly billingAvailable?: boolean
  readonly supporterApproved?: boolean
  readonly checkoutUser?: {
    email: string
    verified: boolean
    complimentaryPro: boolean
    hasPaidMembership?: boolean
  } | null
}) {
  const m = useMembershipContent()
  const planCard = useMembershipPlan()
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("membershipPlans")

  const [billing, setBilling] = useState<Billing>("monthly")
  const [teamExpanded, setTeamExpanded] = useState(false)
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
    <section aria-labelledby="membership-h" className={styles.region}>
      <PlanSectionHeader
        control={
          <PlanToggle
            label={tUi("billing_period")}
            value={billing}
            onChange={(value) => {
              setBilling(value)
              pushCheckoutEvent("pricing_action", {
                product: "personal",
                billing_interval: value === "yearly" ? "year" : "month",
                action_type: value,
              })
            }}
            options={[
              { value: "monthly", label: m("copy.monthly") },
              {
                value: "yearly",
                label: m("copy.yearly"),
                badge: savingMonths ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      background: TYPE_TINT.public.bg,
                      color: TYPE_TINT.public.fg,
                    }}
                  >
                    {m("copy.freeMonths", { count: savingMonths })}
                  </span>
                ) : undefined,
              },
            ]}
          />
        }
        id="membership-h"
        sub={t("lead")}
        title={tUi("choose_your_membership")}
      />
      <p className="m-0 mb-5 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("personalBilling")}
        {currentPlan !== "pro" && currentPlan !== "team" ? (
          <>
            {" "}
            <a
              href="#get-pro-free"
              className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              {t("checkEligibility")}
            </a>
            .
          </>
        ) : null}
      </p>
      <ul className={styles.plans} data-team-expanded={teamExpanded}>
        {plans.map((plan) => (
          <PlanColumn
            key={plan.key}
            billing={billing}
            covered={teamExpanded}
            current={plan.key === currentPlan}
            plan={plan}
            purchase={
              checkoutUser?.hasPaidMembership ? (
                <GlobalLink href="/profile/membership" className={PILL}>
                  {m("copy.manage")}
                </GlobalLink>
              ) : billingAvailable &&
                (plan.key === "pro" ||
                  (plan.key === "supporter" && supporterApproved)) ? (
                <CheckoutButton
                  plan={plan.key === "pro" ? "pro" : "supporter"}
                  interval={billing === "yearly" ? "year" : "month"}
                  user={checkoutUser}
                  variant={plan.key === "supporter" ? "surface" : "primary"}
                />
              ) : undefined
            }
          />
        ))}
        <TeamPlan
          current={currentPlan === "team"}
          teams={teams}
          expanded={teamExpanded}
          onExpandedChange={setTeamExpanded}
        />
      </ul>
      <p
        className="m-0 mt-4 flex items-start gap-2 text-sm leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          height={16}
          icon="mdi:lock-outline"
          style={{ color: T.accent.ok }}
          width={16}
        />
        <span>
          {m("copy.payment")}{" "}
          <GlobalLink
            className="underline underline-offset-2"
            href="/legal/cancellation-refunds"
          >
            {m("copy.refund")}
          </GlobalLink>
          .{" "}
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
