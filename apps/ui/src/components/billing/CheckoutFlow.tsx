"use client"

import { ArrowLeft, ArrowRight, Check, Info, LockKeyhole } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { MEMBERSHIP_TERMS_VERSION } from "@/lib/billing/constants"
import { T } from "@/lib/design-tokens"

import {
  CheckoutHeader,
  CheckoutPlanPicker,
  CheckoutSteps,
  CheckoutSummary,
  checkoutButton,
  checkoutPrimary,
} from "./CheckoutPresentation"
import type { PriceCatalogue } from "./types"
import { useMembershipRefresh } from "./useMembershipRefresh"

export function CheckoutFlow({
  user,
  initialPlan = "pro",
  initialInterval = "month",
  attempt,
  cancelled = false,
}: {
  readonly user: {
    email: string
    verified: boolean
    complimentaryPro: boolean
  } | null
  readonly initialPlan?: "pro" | "supporter"
  readonly initialInterval?: "month" | "year"
  readonly attempt?: string
  readonly cancelled?: boolean
}) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const refreshMembership = useMembershipRefresh()
  const [catalogue, setCatalogue] = useState<PriceCatalogue | null>(null)
  const [plan, setPlan] = useState(initialPlan)
  const [interval, setInterval] = useState(initialInterval)
  const [step, setStep] = useState<"plan" | "details">("plan")
  const heading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const [terms, setTerms] = useState(false)
  const [listed, setListed] = useState(false)
  const [badge, setBadge] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [state, setState] = useState<string | null>(
    attempt && !cancelled ? "processing" : null
  )
  const price = catalogue?.prices.find(
    (p) => p.plan === plan && p.interval === interval
  )

  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus()
    previousStep.current = step
  }, [step])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/billing/prices", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("prices")
        setCatalogue((await res.json()) as PriceCatalogue)
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!attempt || cancelled || !user?.verified) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let count = 0
    const poll = async () => {
      let finished = false
      let delay = ++count < 15 ? 2000 : 5000
      try {
        const res = await fetch(
          `/api/billing/status?attempt=${encodeURIComponent(attempt)}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15_000),
            ]),
            cache: "no-store",
          }
        )
        if (res.status === 429) {
          const retry = Number(res.headers.get("retry-after"))
          delay = Math.max(
            10_000,
            Math.min(60_000, Number.isFinite(retry) ? retry * 1000 : 10_000)
          )
        }
        if (!res.ok) throw new Error("status")
        const status = (await res.json()) as { state: string }
        if (controller.signal.aborted) return
        if (
          !["ready", "expired", "processing", "sync_pending"].includes(
            status.state
          )
        )
          throw new Error("status")
        if (status.state === "ready") {
          await refreshMembership()
          if (controller.signal.aborted) return
        }
        setState(status.state)
        finished = ["ready", "expired"].includes(status.state)
      } catch {
        if (!controller.signal.aborted) setState("unavailable")
        delay = Math.max(delay, 5000)
      } finally {
        if (!finished && !controller.signal.aborted)
          timer = setTimeout(poll, delay)
      }
    }
    poll()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [attempt, cancelled, user?.verified, refreshMembership])

  const checkout = async () => {
    setBusy(true)
    setError(false)
    try {
      const prefs = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supporterListed: listed,
          supporterBadgeVisible: badge,
        }),
      })
      if (!prefs.ok) throw new Error("preferences")
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          interval,
          locale,
          termsVersion: MEMBERSHIP_TERMS_VERSION,
        }),
      })
      if (!res.ok) throw new Error("checkout")
      const result = (await res.json()) as { url: string }
      const url = new URL(result.url)
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("provider")
      window.location.assign(result.url)
    } catch {
      setError(true)
      setBusy(false)
    }
  }
  const callback = `/contribute/membership/checkout?plan=${plan}&interval=${interval}${attempt ? `&attempt=${encodeURIComponent(attempt)}` : ""}`

  if (state)
    return (
      <div
        className="flex flex-col gap-8 p-6 sm:p-12"
        style={{ color: T.ink.base }}
        aria-live="polite"
      >
        <CheckoutHeader sandbox={catalogue?.sandbox} />
        {state === "ready" && user?.verified ? (
          <span className="grid size-16 place-items-center rounded-full bg-green-50 text-(--t-accent-ok)">
            <Check className="size-8" aria-hidden="true" />
          </span>
        ) : null}
        <h2
          className="m-0 text-4xl leading-tight text-balance sm:text-5xl"
          style={{ fontFamily: T.font.serif }}
        >
          {state === "ready" && user?.verified
            ? t("thankYou")
            : t("confirming")}
        </h2>
        <p className="m-0 max-w-xl text-base leading-relaxed text-(--t-ink-dim)">
          {!user?.verified
            ? user
              ? t("verify")
              : t("signInExplanation")
            : state === "ready"
              ? t("ready")
              : state === "expired"
                ? t("expired")
                : state === "unavailable"
                  ? t("confirmationUnavailable")
                  : t("pending")}
        </p>
        <GlobalLink
          className={`${checkoutPrimary} self-start`}
          href={
            user?.verified
              ? "/profile/settings#membership"
              : `/auth/signin?callbackUrl=${encodeURIComponent(callback)}`
          }
        >
          {user?.verified ? t("manage") : t("signIn")}
        </GlobalLink>
      </div>
    )

  return (
    <div
      className="grid min-w-0 lg:grid-cols-[3fr_2fr]"
      style={{ color: T.ink.base }}
    >
      <div className="flex min-w-0 flex-col gap-7 p-6 sm:gap-8 sm:p-10 lg:p-12">
        <CheckoutHeader sandbox={catalogue?.sandbox} />
        <div className="flex flex-col gap-7 sm:gap-8">
          <CheckoutSteps step={step} />
          <h2
            ref={heading}
            tabIndex={-1}
            className="m-0 text-4xl leading-[1.08] text-balance focus-visible:outline-2 focus-visible:outline-offset-4 sm:text-[46px]"
            style={{ fontFamily: T.font.serif }}
          >
            {step === "plan" ? t("choose") : t("yourDetails")}
          </h2>
        </div>
        {!catalogue ? (
          <p className="m-0" role="status">
            {t("loading")}
          </p>
        ) : !catalogue.available ? (
          <p className="m-0">{t("unavailable")}</p>
        ) : step === "plan" ? (
          <>
            <CheckoutPlanPicker
              catalogue={catalogue}
              plan={plan}
              interval={interval}
              complimentaryPro={user?.complimentaryPro}
              onPlan={setPlan}
              onInterval={setInterval}
            />
            {user?.complimentaryPro ? (
              <p className="m-0 text-sm leading-relaxed">
                {t("complimentary")}
              </p>
            ) : null}
            <button
              type="button"
              className={`${checkoutPrimary} mt-auto w-full`}
              disabled={
                !price || (plan === "pro" && Boolean(user?.complimentaryPro))
              }
              onClick={() => setStep("details")}
            >
              {t("join", { plan: t(plan) })}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            {user?.verified ? (
              <>
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm font-semibold">
                    {t("accountEmail")}
                  </p>
                  <p className="m-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) px-5 py-4 break-words">
                    {user.email}
                  </p>
                </div>
                <fieldset className="m-0 flex flex-col gap-4 p-0">
                  <legend className="mb-4 text-lg font-semibold">
                    {t("recognitionTitle")}
                  </legend>
                  <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-(--t-border-line) p-5 hover:bg-(--t-bg-surface) has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-(--t-accent-primary)">
                    <input
                      className="mt-1 size-5 shrink-0"
                      name="supporterBadgeVisible"
                      style={{ accentColor: T.accent.primary }}
                      type="checkbox"
                      checked={badge}
                      onChange={(e) => setBadge(e.target.checked)}
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-semibold">{t("badge")}</span>
                      <span className="text-sm leading-relaxed text-(--t-ink-dim)">
                        {t("badgeHelp")}
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-(--t-border-line) p-5 hover:bg-(--t-bg-surface) has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-(--t-accent-primary)">
                    <input
                      className="mt-1 size-5 shrink-0"
                      name="supporterListed"
                      style={{ accentColor: T.accent.primary }}
                      type="checkbox"
                      checked={listed}
                      onChange={(e) => setListed(e.target.checked)}
                    />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-semibold">{t("credit")}</span>
                      <span className="text-sm leading-relaxed text-(--t-ink-dim)">
                        {t("creditHelp")}
                      </span>
                    </span>
                  </label>
                </fieldset>
                <p className="m-0 flex items-start gap-3 text-sm leading-relaxed text-(--t-ink-dim)">
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-(--t-accent-primary)"
                    aria-hidden="true"
                  />
                  <span>{t("creditExplanation")}</span>
                </p>
                <div className="flex flex-col gap-4 border-t border-(--t-border-line) pt-6">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-(--t-accent-primary)">
                    <input
                      className="mt-1 size-5 shrink-0"
                      name="membershipTerms"
                      style={{ accentColor: T.accent.primary }}
                      type="checkbox"
                      checked={terms}
                      onChange={(e) => setTerms(e.target.checked)}
                    />
                    <span className="text-sm leading-relaxed">
                      {t("termsConsent")}{" "}
                      <GlobalLink
                        className="text-(--t-accent-primary) underline underline-offset-4"
                        href="/legal/membership"
                      >
                        {t("terms")}
                      </GlobalLink>
                    </span>
                  </label>
                  <p className="m-0 text-xs leading-relaxed text-(--t-ink-dim)">
                    {t("termsLanguageNote")}{" "}
                    <GlobalLink
                      className="underline underline-offset-4"
                      href="/legal/cancellation-refunds"
                    >
                      {t("cancellationPolicy")}
                    </GlobalLink>
                  </p>
                </div>
                <div className="mt-auto flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className={checkoutButton}
                      disabled={busy}
                      onClick={() => setStep("plan")}
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                      {t("back")}
                    </button>
                    <button
                      type="button"
                      className={`${checkoutPrimary} flex-1`}
                      disabled={busy || !terms || !price}
                      onClick={checkout}
                    >
                      <LockKeyhole
                        className="size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {busy ? t("opening") : t("continueStripe")}
                    </button>
                  </div>
                  <p className="m-0 text-center text-xs leading-relaxed text-(--t-ink-dim)">
                    {t("providerExplanation")}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="m-0 leading-relaxed text-(--t-ink-dim)">
                  {user ? t("verify") : t("signInExplanation")}
                </p>
                <div className="flex flex-wrap gap-3">
                  <GlobalLink
                    className={checkoutPrimary}
                    href={`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`}
                  >
                    {t("signIn")}
                  </GlobalLink>
                  {!user ? (
                    <GlobalLink
                      className={checkoutButton}
                      href={`/auth/register?callbackUrl=${encodeURIComponent(callback)}`}
                    >
                      {t("createAccount")}
                    </GlobalLink>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={`${checkoutButton} self-start`}
                  onClick={() => setStep("plan")}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  {t("back")}
                </button>
              </>
            )}
          </>
        )}
        {error ? (
          <p
            className="m-0 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800"
            role="alert"
          >
            {t("error")}
          </p>
        ) : null}
      </div>
      <CheckoutSummary
        catalogue={catalogue}
        plan={plan}
        interval={interval}
        onInterval={setInterval}
        disabled={busy}
      />
    </div>
  )
}
