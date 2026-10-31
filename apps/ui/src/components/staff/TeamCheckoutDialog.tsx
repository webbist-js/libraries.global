"use client"

import { ArrowLeft, ArrowRight, Check, Info, Minus, Plus } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react"

import {
  CheckoutHeader,
  CheckoutSteps,
} from "@/components/billing/CheckoutPresentation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { pushCheckoutEvent } from "@/lib/checkout-analytics"
import pricing from "@/lib/membership-pricing.json"
import { Link } from "@/lib/navigation"
import { MAX_TEAM_SEATS, MIN_TEAM_SEATS } from "@/lib/team-billing/types"

import { STAFF_FIELD, STAFF_LINK } from "./StaffPanel"
import { TeamPurchaseProgress } from "./TeamPurchaseJourney"

export type TeamCheckoutChoice = {
  name: string
  seats: number
  publicServiceRequested: boolean
  apiAddon?: boolean
}

function TeamOrderSummary({
  name,
  seats,
  unit,
  total,
  discounted,
  money,
  apiAddon,
}: {
  apiAddon: boolean
  name: string
  seats: number
  unit: number
  total: number
  discounted: boolean
  money: (amount: number) => string
}) {
  const t = useTranslations("teamPurchase")

  return (
    <aside
      aria-label="Order summary"
      className="flex min-w-0 flex-col gap-6 border-t border-(--t-border-line) bg-(--t-bg-void) p-5 sm:p-9 lg:border-t-0 lg:border-l lg:p-10 lg:pt-24"
    >
      <div>
        <p className="mt-0 mb-4 text-base font-semibold text-(--t-accent-primary)">
          Order summary
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="type-h3 m-0">Team</h3>
          <strong className="text-xl">{money(total)}</strong>
        </div>
        <p className="mt-2 mb-0 text-base [overflow-wrap:anywhere] text-(--t-ink-dim)">
          {name.trim() || "Your Team"} · {seats} seats · yearly
        </p>
      </div>
      <dl className="m-0 space-y-3 border-y border-(--t-border-line) py-5 text-sm">
        <div className="flex justify-between gap-4">
          <dt>First 5 seats</dt>
          <dd className="m-0">{money(unit * MIN_TEAM_SEATS)}</dd>
        </div>
        {seats > MIN_TEAM_SEATS ? (
          <div className="flex justify-between gap-4">
            <dt>{seats - MIN_TEAM_SEATS} extra seats</dt>
            <dd className="m-0">{money(unit * (seats - MIN_TEAM_SEATS))}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt>VAT</dt>
          <dd className="m-0 text-right">Calculated by Stripe</dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-base font-semibold">Annual subtotal</span>
        <strong className="font-sans text-4xl font-medium">
          {money(total)}
        </strong>
      </div>
      <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
        Then {money(total)} a year until you cancel. Prices exclude VAT. Your
        renewal date is confirmed after payment.
      </p>
      {discounted ? (
        <p className="m-0 text-base text-(--t-accent-ok)">
          Approved public-service discount included.
        </p>
      ) : null}
      <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-4 text-sm leading-relaxed">
        <strong className="block">
          {t(apiAddon ? "apiSelected" : "apiOptional")}
        </strong>
        <p className="mt-2 mb-0 text-(--t-ink-dim)">
          {money(pricing.teamApi.month)} / {t("month")}
        </p>
        <p className="mt-2 mb-0 text-(--t-ink-dim)">
          {t(apiAddon ? "afterTeamPayment" : "separateCharges")}
        </p>
      </div>
      {apiAddon ? <TeamPurchaseProgress stage="team" /> : null}
      <ul className="mt-auto mb-0 list-none space-y-3 border-t border-(--t-border-line) p-0 pt-5 text-base text-(--t-ink-dim)">
        {[
          "Cancel renewal any time",
          "Add seats when you need them",
          "Secure payment with Stripe",
        ].map((text) => (
          <li key={text} className="flex items-center gap-3">
            <Check
              className="size-4 shrink-0 text-(--t-accent-ok)"
              aria-hidden
            />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  )
}

function TeamSeatPicker({
  seats,
  setSeats,
  minimumSeats,
  busy,
  unit,
  money,
}: {
  seats: number
  setSeats: Dispatch<SetStateAction<number>>
  minimumSeats: number
  busy: boolean
  unit: number
  money: (amount: number) => string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-(--t-border-line) p-4">
      <div>
        <p className="m-0 text-base font-semibold">Seats</p>
        <p className="mt-1 mb-0 text-sm text-(--t-ink-dim)">
          5 included. Extra seats {money(unit)} a year each.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="surface"
          className="size-11 rounded-full"
          disabled={busy || seats <= minimumSeats}
          aria-label="Remove a seat"
          type="button"
          onClick={() => setSeats((value) => value - 1)}
        >
          <Minus aria-hidden />
        </Button>
        <label className="sr-only" htmlFor="checkout-team-seats">
          Number of seats
        </label>
        <input
          id="checkout-team-seats"
          type="number"
          min={minimumSeats}
          max={MAX_TEAM_SEATS}
          required
          step={1}
          className="min-h-11 w-16 rounded-lg text-center text-base font-semibold tabular-nums outline-offset-2"
          value={seats}
          disabled={busy}
          onChange={(event) => setSeats(Number(event.target.value))}
        />
        <Button
          variant="surface"
          className="size-11 rounded-full"
          disabled={busy || seats >= MAX_TEAM_SEATS}
          aria-label="Add a seat"
          type="button"
          onClick={() =>
            setSeats((value) => Math.min(MAX_TEAM_SEATS, value + 1))
          }
        >
          <Plus aria-hidden />
        </Button>
      </div>
    </div>
  )
}

function checkoutHeading(step: "plan" | "details", teamName?: string) {
  if (step !== "plan") return "Review your billing"

  return teamName ? "Your Team membership" : "Create your Team"
}

function checkoutLead(teamName?: string) {
  return teamName
    ? "Choose your seats and review annual billing."
    : "You’ll be its Organiser. Invite colleagues as soon as payment is confirmed."
}

/** The same accessible checkout shell as personal membership; Stripe takes payment. */
export function TeamCheckoutDialog({
  open,
  onOpenChange,
  initialSeats,
  initialName,
  initialApiAddon = false,
  initialPublicService = false,
  minimumSeats = MIN_TEAM_SEATS,
  teamName,
  discounted = false,
  sandbox,
  user,
  busy,
  error,
  onCheckout,
  onTeam,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly minimumSeats?: number
  readonly initialApiAddon?: boolean
  readonly initialPublicService?: boolean
  readonly initialName?: string
  readonly initialSeats: number
  readonly teamName?: string
  readonly discounted?: boolean
  readonly sandbox: boolean
  readonly user?: { name: string; email: string }
  readonly busy: boolean
  readonly error: string
  readonly onTeam?: (choice: TeamCheckoutChoice) => Promise<boolean>
  readonly onCheckout: (choice: TeamCheckoutChoice) => void
}) {
  const t = useTranslations("teamPurchase")
  const [apiAddon, setApiAddon] = useState(initialApiAddon)
  const [step, setStep] = useState<"plan" | "details">("plan")
  const [name, setName] = useState(teamName ?? initialName ?? "")
  const [seats, setSeats] = useState(Math.max(minimumSeats, initialSeats))
  const [service, setService] = useState<"standard" | "public">(
    discounted || initialPublicService ? "public" : "standard"
  )
  const [consent, setConsent] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const began = useRef(false)
  const locale = useLocale()
  const money = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
    }).format(amount / 100)
  // Eligibility is server approved. Selecting a service type never changes a charge.
  const unit =
    pricing.team.extraSeatYear *
    (discounted ? 1 - pricing.team.publicServiceDiscountPercent / 100 : 1)
  const total = unit * seats
  useEffect(() => {
    if (!open) {
      began.current = false

      return
    }
    if (began.current) return
    began.current = true
    pushCheckoutEvent("begin_checkout", {
      product: "team",
      billing_interval: "year",
      api_addon: apiAddon ? "selected" : "not_selected",
      billing_mode: sandbox ? "sandbox" : "live",
    })
  }, [open, apiAddon, sandbox])
  useEffect(() => {
    if (step !== previousStep.current) heading.current?.focus()
    previousStep.current = step
  }, [step])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto overscroll-contain rounded-3xl bg-(--t-bg-deep) p-0 sm:max-w-[calc(100%-3rem)] lg:max-w-6xl"
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) opacity-100 hover:bg-(--t-bg-surface)"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="type-h2 sr-only">
          {teamName ? "Set up Team billing" : "Create your Team"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review your Team and annual subscription before continuing to Stripe
          for secure payment.
        </DialogDescription>
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 p-5 sm:p-9 lg:p-10">
            <CheckoutHeader sandbox={sandbox} />
            <div className="mt-8 sm:mt-10">
              <CheckoutSteps
                step={step}
                labels={["Team", "Billing", "Payment"]}
              />
            </div>
            <h2
              ref={heading}
              tabIndex={-1}
              className="type-h2 mt-[28px] mb-[16px] outline-none"
            >
              {checkoutHeading(step, teamName)}
            </h2>
            <form
              className="space-y-6"
              aria-busy={busy}
              onSubmit={async (event) => {
                event.preventDefault()
                if (step === "plan") {
                  if (
                    !onTeam ||
                    (await onTeam({
                      name: name.trim(),
                      seats,
                      publicServiceRequested: service === "public",
                      apiAddon,
                    }))
                  )
                    setStep("details")

                  return
                }
                if (consent && !busy)
                  onCheckout({
                    name: name.trim(),
                    seats,
                    publicServiceRequested: service === "public",
                    apiAddon,
                  })
              }}
            >
              {step === "plan" ? (
                <>
                  <p className="mt-0 text-base leading-relaxed text-(--t-ink-dim)">
                    {checkoutLead(teamName)}
                  </p>
                  <label className="grid gap-2 text-base font-semibold">
                    Team name
                    <input
                      className={STAFF_FIELD}
                      autoComplete="organization"
                      placeholder="Bristol Libraries"
                      required
                      maxLength={120}
                      readOnly={Boolean(teamName)}
                      disabled={busy}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                    <span className="text-sm leading-relaxed font-normal text-(--t-ink-dim)">
                      Usually your library service or organisation. Members see
                      this name.
                    </span>
                  </label>
                  {!teamName ? (
                    <fieldset className="min-w-0">
                      <legend className="mb-3 text-base font-semibold">
                        Service type
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["standard", "public"] as const).map((value) => (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-(--t-accent-primary) ${service === value ? "border-(--t-accent-primary) bg-(--t-accent-chip)/30 ring-1 ring-(--t-accent-primary)" : "border-(--t-border-line)"}`}
                          >
                            <input
                              type="radio"
                              name="team-service"
                              className="mt-1 size-5 shrink-0 accent-(--t-accent-primary)"
                              checked={service === value}
                              disabled={busy}
                              onChange={() => setService(value)}
                            />
                            <span>
                              <strong className="text-base">
                                {value === "standard"
                                  ? "Standard"
                                  : "Public library service"}
                              </strong>
                              <span className="mt-1 block text-sm leading-relaxed text-(--t-ink-dim)">
                                {value === "standard"
                                  ? "For teams and organisations."
                                  : "20% off after eligibility is approved."}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                  {service === "public" && !discounted ? (
                    <p className="rounded-2xl bg-(--t-bg-surface) p-4 text-sm leading-relaxed text-(--t-ink-dim)">
                      We’ll record your request for an eligibility check.
                      Today’s checkout uses the standard price shown; the
                      discount only applies after approval. You can wait for
                      approval before paying.
                    </p>
                  ) : null}
                  <TeamSeatPicker
                    seats={seats}
                    setSeats={setSeats}
                    minimumSeats={minimumSeats}
                    busy={busy}
                    unit={unit}
                    money={money}
                  />
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      checked={apiAddon}
                      disabled={busy}
                      onChange={(event) => setApiAddon(event.target.checked)}
                      className="mt-0.5 size-5 shrink-0 accent-(--t-accent-primary)"
                    />
                    <span>
                      <strong className="block">{t("selectApi")}</strong>
                      <span className="mt-1 block text-(--t-ink-dim)">
                        {t("separateCharges")}
                      </span>
                    </span>
                  </label>
                  <Button
                    className="w-full"
                    variant="primary"
                    size="pill-lg"
                    type="submit"
                    disabled={busy || !name.trim()}
                  >
                    Continue to billing
                    <ArrowRight aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  {user ? (
                    <div className="flex items-center gap-3 rounded-2xl border border-(--t-border-line) p-4">
                      <span
                        aria-hidden
                        className="grid size-11 shrink-0 place-items-center rounded-full bg-(--t-accent-chip) font-semibold text-(--t-accent-primary)"
                      >
                        {user.name.trim().slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block text-base [overflow-wrap:anywhere]">
                          {user.name}
                        </strong>
                        <span className="text-sm [overflow-wrap:anywhere] text-(--t-ink-dim)">
                          {user.email}
                        </span>
                      </div>
                      <span className="rounded-full bg-(--t-bg-surface) px-3 py-1 text-xs font-semibold">
                        Organiser
                      </span>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-(--t-border-line) p-5">
                    <h3 className="type-small-heading mt-0 mb-2">
                      Billing details in Stripe
                    </h3>
                    <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                      Review your billing details and any applicable VAT in the
                      secure payment step. Stripe handles payment and invoices.
                      Your Team subscription renews every year until you cancel.
                    </p>
                  </div>
                  <p className="flex items-start gap-2 text-sm leading-relaxed text-(--t-ink-dim)">
                    <Info
                      className="mt-0.5 size-4 shrink-0 text-(--t-accent-primary)"
                      aria-hidden
                    />
                    Paying doesn’t verify staff authority. Each library your
                    Team looks after is checked separately.
                  </p>
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      required
                      className="mt-1 size-5 shrink-0 accent-(--t-accent-primary)"
                      checked={consent}
                      disabled={busy}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                    <span>
                      I accept the{" "}
                      <Link
                        className={STAFF_LINK}
                        href="/legal/membership"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        membership terms
                      </Link>{" "}
                      and{" "}
                      <Link
                        className={STAFF_LINK}
                        href="/legal/cancellation-refunds"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        cancellation and refund policy
                      </Link>
                      , and request Team access to start when payment is
                      confirmed.
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="surface"
                      size="pill-lg"
                      disabled={busy}
                      onClick={() => setStep("plan")}
                    >
                      <ArrowLeft aria-hidden />
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      variant="primary"
                      size="pill-lg"
                      type="submit"
                      disabled={busy || !consent}
                    >
                      {busy ? "Opening Stripe…" : "Continue to payment"}
                    </Button>
                  </div>
                </>
              )}
              {error ? (
                <p
                  role="alert"
                  className="rounded-2xl border border-(--t-edge-danger) bg-(--t-palette-coral-soft) p-4 text-sm text-(--t-palette-coral-fg)"
                >
                  {error}
                </p>
              ) : null}
            </form>
          </div>
          <TeamOrderSummary
            name={name}
            seats={seats}
            unit={unit}
            total={total}
            discounted={discounted}
            apiAddon={apiAddon}
            money={money}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
