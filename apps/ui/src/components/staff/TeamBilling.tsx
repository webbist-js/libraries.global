"use client"

import { Icon } from "@iconify/react"
import { useLocale } from "next-intl"
import { useEffect, useRef, useState, useTransition } from "react"

import { useMembershipRefresh } from "@/components/billing/useMembershipRefresh"
import { Badge } from "@/components/ds"
import { Button } from "@/components/ui/button"
import pricing from "@/lib/membership-pricing.json"
import { Link, useRouter } from "@/lib/navigation"
import {
  TEAM_TERMS_VERSION,
  type TeamBillingDashboard,
} from "@/lib/team-billing/types"

import { StaffPanel, STAFF_LINK } from "./StaffPanel"
import { TeamCheckoutDialog } from "./TeamCheckoutDialog"

const errors: Record<string, string> = {
  team_terms_required:
    "Reload this page and review the current terms before subscribing.",
  team_subscription_already_exists:
    "A Team subscription already exists. Open Manage Team billing to change it.",
  team_payment_confirmation_pending:
    "Payment confirmation is pending. Refresh shortly; do not start another payment.",
  team_purchases_unavailable:
    "New Team subscriptions are temporarily unavailable.",
  team_seats_occupied:
    "There are more members or invitations than paid seats. Remove unused members or invitations, or increase your seats in billing, then refresh payment status.",
  team_checkout_needs_reconciliation:
    "An earlier checkout is still being recovered. Retry the same seat selection before starting another purchase.",
  team_has_members: "Remove other members before discarding this Team.",
  team_still_paid:
    "This Team still has paid access. You can discard it after the paid period ends.",
  cancel_team_before_discard:
    "Cancel Team renewal in Manage Team billing before discarding it.",
  cancel_api_before_discard:
    "Cancel the separate API subscription before discarding this Team.",
  too_many_requests: "Please wait a minute before trying again.",
}

type BillingFormat = {
  amount: number
  money: (amount: number) => string
  date: (value: string) => string
}
function PaidTeamDetails({
  membership,
  amount,
  money,
  date,
}: BillingFormat & {
  membership: NonNullable<TeamBillingDashboard["membership"]>
}) {
  return (
    <>
      <div className="mt-7 rounded-2xl bg-(--t-bg-surface) p-5">
        <p className="mb-3 text-xs font-semibold tracking-wide text-(--t-ink-dim) uppercase">
          Annual Team membership
        </p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-serif text-[clamp(36px,4vw,48px)] leading-tight tracking-tight">
            {money(amount * membership.seats)}
          </span>
          <span className="text-[15px] text-(--t-ink-dim)">
            per year, excluding VAT
          </span>
        </div>
      </div>
      <dl className="mt-6 mb-0 grid gap-4 border-y border-(--t-border-line) py-5 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-(--t-ink-dim)">Paid seats</dt>
          <dd className="m-0 mt-1 text-[17px] font-semibold">
            {membership.paidSeats}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-(--t-ink-dim)">
            {membership.cancelAtPeriodEnd ? "Paid access ends" : "Paid through"}
          </dt>
          <dd className="m-0 mt-1 text-[17px] font-semibold">
            {membership.paidThrough
              ? date(membership.paidThrough)
              : "Awaiting payment"}
          </dd>
        </div>
      </dl>
      {membership.cancelAtPeriodEnd ? (
        <p className="mt-4 rounded-2xl bg-(--t-bg-surface) p-4 text-[14px] leading-relaxed">
          Renewal is cancelled. Paid access continues to its paid-through date.
        </p>
      ) : null}
      {membership.pendingSeats ? (
        <p className="mt-4 text-[14px] leading-relaxed">
          {membership.pendingSeats} seats are scheduled
          {membership.pendingAt
            ? ` from ${date(membership.pendingAt)}`
            : " at renewal"}
          . Remove excess members and invitations before that date.
        </p>
      ) : null}
      {membership.revoked ? (
        <p role="alert" className="mt-4 text-[14px] text-red-800">
          Access is suspended following a payment reversal.
        </p>
      ) : null}
    </>
  )
}

function TeamPaymentActions({
  data,
  membership,
  canSubscribe,
  pending,
  checking,
  request,
  locale,
  setCheckoutOpen,
}: {
  data: TeamBillingDashboard
  membership: TeamBillingDashboard["membership"]
  canSubscribe: boolean
  pending: boolean
  checking: boolean
  request: (action: unknown) => void
  locale: string
  setCheckoutOpen: (value: boolean) => void
}) {
  return (
    <>
      {" "}
      {data.organiser ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {membership ? (
            <Button
              variant="primary"
              size="pill"
              disabled={pending}
              onClick={() => request({ action: "portal", locale })}
            >
              Manage Team billing and seats
            </Button>
          ) : null}
          {canSubscribe ? (
            <Button
              variant="primary"
              size="pill"
              disabled={pending || !data.purchasing}
              onClick={() => setCheckoutOpen(true)}
            >
              {data.pending ? "Resume checkout" : "Set up annual billing"}
            </Button>
          ) : null}
          <Button
            variant="surface"
            size="pill"
            disabled={pending || checking}
            onClick={() => request({ action: "refresh" })}
          >
            {checking ? "Checking payment…" : "Refresh payment status"}
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-[14px] text-(--t-ink-dim)">
          A Team Organiser manages payment and seats.
        </p>
      )}
      {canSubscribe && !data.purchasing ? (
        <p className="mt-4 text-[14px]">
          New subscriptions are temporarily unavailable.
        </p>
      ) : null}
    </>
  )
}

function UnusedTeam({
  pending,
  request,
}: {
  pending: boolean
  request: (action: unknown) => void
}) {
  const [discarding, setDiscarding] = useState(false)

  return (
    <StaffPanel id="unused-team" title="Unused Team" compact>
      <p className="mt-0 text-[14px] leading-relaxed text-(--t-ink-dim)">
        You can discard a Team you no longer need once it has no paid membership
        or other members. Its separate API subscription must also be cancelled.
      </p>
      {discarding ? (
        <div className="space-y-4">
          <p className="text-[14px]">
            Discard this unused Team? Any open checkout will be closed.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="destructive"
              size="pill"
              disabled={pending}
              onClick={() => request({ action: "discard" })}
            >
              Confirm discard
            </Button>
            <Button
              variant="surface"
              size="pill"
              disabled={pending}
              onClick={() => setDiscarding(false)}
            >
              Keep Team
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="surface"
          size="pill"
          disabled={pending}
          onClick={() => setDiscarding(true)}
        >
          Discard unused Team
        </Button>
      )}
    </StaffPanel>
  )
}

function billingSummary(data: TeamBillingDashboard, checking: boolean) {
  const membership = data.membership
  const amount =
    membership?.unitAmount ??
    pricing.team.extraSeatYear *
      (data.discounted
        ? (100 - pricing.team.publicServiceDiscountPercent) / 100
        : 1)
  const subscriptionExists =
    membership &&
    !["canceled", "incomplete_expired"].includes(membership.status)
  const covered = Boolean(
    membership?.accessUntil && Date.parse(membership.accessUntil) > Date.now()
  )
  const canSubscribe =
    data.source === "checkout" &&
    data.organiser &&
    !subscriptionExists &&
    !covered
  const waiting = checking || data.pending || !data.synced

  return { amount, canSubscribe, waiting }
}

function billingStatus(active: boolean, waiting: boolean) {
  if (active)
    return {
      color: "ok" as const,
      label: "Active Team",
      description:
        "Your Team is active. Manage your membership, invoices and renewal here.",
    }
  if (waiting)
    return {
      color: "warn" as const,
      label: "Confirming payment",
      description:
        "Payment confirmation is pending. Team access starts after payment and activation are confirmed.",
    }

  return {
    color: "warn" as const,
    label: "Not active",
    description:
      "Set up annual billing to activate Pro for your Team’s members.",
  }
}

export function TeamBilling({
  initial,
  initialSeats,
  confirming,
  refreshRequired = false,
}: {
  readonly initial: TeamBillingDashboard
  readonly initialSeats: number
  readonly confirming: boolean
  readonly refreshRequired?: boolean
}) {
  const [data, setData] = useState(initial)
  const [seats, setSeats] = useState(initialSeats)
  const [error, setError] = useState("")
  const [checking, setChecking] = useState(
    confirming && (!initial.active || !initial.synced || initial.pending)
  )
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const checked = useRef(false)
  const [pending, startTransition] = useTransition()
  const locale = useLocale()
  const refreshMembership = useMembershipRefresh()
  const router = useRouter()
  const endpoint = `/api/staff/team/${data.teamId}/billing`
  const membership = data.membership
  const money = (pence: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "GBP",
    }).format(pence / 100)

  useEffect(() => {
    if (!confirming || !data.organiser || checked.current) return
    // A return URL is only a hint. The authoritative dashboard may already be settled.
    if (
      !refreshRequired &&
      initial.active &&
      initial.synced &&
      !initial.pending
    ) {
      checked.current = true
      void refreshMembership()

      return
    }
    checked.current = true
    const controller = new AbortController()
    let completed = false
    void (async () => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refresh" }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        })
        const result = await response.json()
        completed = true
        if (!controller.signal.aborted) {
          if (response.ok) {
            setData(result)
            setError("")
            await refreshMembership()
          } else
            setError(
              errors[result.error] ??
                "Payment confirmation is still being checked. Refresh shortly."
            )
        }
      } catch {
        /* The worker can still recover a delayed confirmation. */
      } finally {
        if (!controller.signal.aborted) setChecking(false)
      }
    })()

    return () => {
      controller.abort()
      if (!completed) checked.current = false
    }
  }, [
    confirming,
    data.organiser,
    endpoint,
    initial.active,
    initial.synced,
    initial.pending,
    refreshRequired,
    refreshMembership,
  ])

  useEffect(() => {
    if (!checking && !data.pending && data.synced) return
    const controller = new AbortController()
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      let settled = false
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        })
        if (!response.ok || stopped) return
        const result = (await response.json()) as TeamBillingDashboard
        if (stopped) return
        setData(result)
        settled = result.active && result.synced && !result.pending
        if (settled) {
          setError("")
          setChecking(false)
          await refreshMembership()
        }
      } catch {
        /* A transient network failure must not erase pending payment. */
      } finally {
        if (!stopped && !settled) timer = setTimeout(poll, 10_000)
      }
    }
    timer = setTimeout(poll, 10_000)

    return () => {
      stopped = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [
    checking,
    data.active,
    data.pending,
    data.synced,
    endpoint,
    refreshMembership,
  ])

  const request = (action: unknown) =>
    startTransition(async () => {
      setError("")
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        })
        const result = await response.json()
        if (!response.ok)
          throw new Error(
            errors[result.error] ??
              "Team billing is temporarily unavailable. Please try again."
          )
        if (result.url) {
          window.location.assign(result.url)

          return
        }
        await refreshMembership()
        if (result.discarded) {
          router.push("/contribute/membership")

          return
        }
        setData(result as TeamBillingDashboard)
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })

  const date = (value: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(value))
  const { amount, canSubscribe, waiting } = billingSummary(data, checking)
  const status = billingStatus(data.active, waiting)

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
      <div className="min-w-0 space-y-6">
        <StaffPanel
          id="team-subscription"
          title={data.name}
          aside={<Badge color={status.color} label={status.label} />}
        >
          <p
            className="m-0 text-[15px] leading-relaxed text-(--t-ink-dim)"
            role="status"
          >
            {status.description}
          </p>
          {data.source !== "checkout" ? (
            <p className="mt-5 text-[15px] leading-relaxed">
              This Team has an existing agreement. Its agreed terms are
              preserved; contact us to arrange a switch to self-service billing.
            </p>
          ) : (
            <>
              {data.mode === "sandbox" ? (
                <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
                  <strong>Test mode.</strong> No real payment is taken. Use
                  Stripe test payment details only.
                </p>
              ) : null}
              {membership ? (
                <PaidTeamDetails
                  membership={membership}
                  amount={amount}
                  money={money}
                  date={date}
                />
              ) : null}
              <TeamPaymentActions
                data={data}
                membership={membership}
                canSubscribe={canSubscribe}
                pending={pending}
                checking={checking}
                request={request}
                locale={locale}
                setCheckoutOpen={setCheckoutOpen}
              />
              <p className="mt-5 mb-0 text-[13px] leading-relaxed text-(--t-ink-dim)">
                Stripe lets you update payment details, view invoices and cancel
                renewal. Add seats when you need them; increases require
                payment. Seat reductions start at renewal.
              </p>
            </>
          )}
          {error ? (
            <p
              role="alert"
              className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-[14px] text-red-900"
            >
              {error}
            </p>
          ) : null}
        </StaffPanel>
        {canSubscribe ? (
          <UnusedTeam pending={pending} request={request} />
        ) : null}
      </div>
      <aside className="min-w-0 space-y-6">
        <StaffPanel
          id="team-seat-allowance"
          title="Your seats"
          compact
          aside={
            <Icon
              aria-hidden
              icon="mdi:account-group-outline"
              width={22}
              className="text-(--t-accent-primary)"
            />
          }
        >
          <p className="mt-0 mb-3 flex items-baseline gap-2">
            <strong className="font-serif text-4xl font-medium">
              {data.used}
              <span className="text-2xl text-(--t-ink-dim)">
                {" "}
                / {data.seats}
              </span>
            </strong>
            <span className="text-[14px] text-(--t-ink-dim)">occupied</span>
          </p>
          <div
            role="progressbar"
            aria-label="Team seats occupied"
            aria-valuenow={data.used}
            aria-valuemin={0}
            aria-valuemax={Math.max(data.used, data.seats)}
            className="my-5 h-2 overflow-hidden rounded-full bg-(--t-bg-muted)"
          >
            <div
              className="h-full rounded-full bg-(--t-accent-primary)"
              style={{
                width: `${Math.min(100, (data.used / Math.max(1, data.seats)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[14px] leading-relaxed text-(--t-ink-dim)">
            Members and pending invitations each use one seat, including your
            Organiser seat.
          </p>
          <Link className={STAFF_LINK} href="/staff/teams">
            Manage members and libraries
          </Link>
        </StaffPanel>
        <StaffPanel
          id="team-library-access"
          title="Library access"
          compact
          aside={
            <Icon
              aria-hidden
              icon="mdi:shield-check-outline"
              width={22}
              className="text-(--t-accent-primary)"
            />
          }
        >
          <p className="mt-0 text-[14px] leading-relaxed text-(--t-ink-dim)">
            Payment activates your membership. Library staff authority is
            checked separately before your Team can manage a library.
          </p>
          <Link className={STAFF_LINK} href="/staff/claim">
            Request library access
          </Link>
        </StaffPanel>
        <StaffPanel
          id="team-api-billing"
          title="API add-on"
          compact
          aside={
            <Icon
              aria-hidden
              icon="mdi:code-tags"
              width={22}
              className="text-(--t-accent-primary)"
            />
          }
        >
          <p className="mt-0 text-[14px] leading-relaxed text-(--t-ink-dim)">
            Optional API access is billed separately at{" "}
            {money(pricing.teamApi.month)} a month. Manage its subscription
            separately if your Team ends.
          </p>
          <Link className={STAFF_LINK} href="/staff/teams/api">
            API access and usage
          </Link>
        </StaffPanel>
      </aside>
      {canSubscribe ? (
        <TeamCheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          initialSeats={seats}
          minimumSeats={Math.max(5, data.used)}
          teamName={data.name}
          discounted={data.discounted}
          sandbox={data.mode === "sandbox"}
          busy={pending}
          error={error}
          onCheckout={(choice) => {
            setSeats(choice.seats)
            request({
              action: "checkout",
              seats: choice.seats,
              locale,
              termsVersion: TEAM_TERMS_VERSION,
            })
          }}
        />
      ) : null}
    </div>
  )
}
