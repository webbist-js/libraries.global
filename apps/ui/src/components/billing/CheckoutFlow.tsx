"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { MEMBERSHIP_TERMS_VERSION } from "@/lib/billing/constants"
import { T } from "@/lib/design-tokens"

import { formatBillingMoney, type PriceCatalogue } from "./types"

const pill =
  "inline-flex min-h-12 items-center justify-center rounded-full border px-6 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-4"

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
  const [catalogue, setCatalogue] = useState<PriceCatalogue | null>(null)
  const [plan, setPlan] = useState(initialPlan)
  const [interval, setInterval] = useState(initialInterval)
  const [step, setStep] = useState<"plan" | "details">("plan")
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
      try {
        const res = await fetch(
          `/api/billing/status?attempt=${encodeURIComponent(attempt)}`,
          { signal: controller.signal }
        )
        if (!res.ok) throw new Error("status")
        const status = (await res.json()) as { state: string }
        setState(status.state)
        if (!["ready", "expired"].includes(status.state) && ++count < 15)
          timer = setTimeout(poll, 2000)
      } catch {
        if (!controller.signal.aborted) setState("unavailable")
      }
    }
    poll()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [attempt, cancelled, user?.verified])

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

  if (state && !user?.verified)
    return (
      <div className="space-y-6 p-6 sm:p-10">
        <h2 className="text-4xl" style={{ fontFamily: T.font.serif }}>
          {t("confirming")}
        </h2>
        <p>{user ? t("verify") : t("signInExplanation")}</p>
        <GlobalLink
          className={pill}
          href={`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`}
        >
          {t("signIn")}
        </GlobalLink>
      </div>
    )

  if (state)
    return (
      <div className="space-y-6 p-6 sm:p-10" aria-live="polite">
        <h2 className="text-4xl" style={{ fontFamily: T.font.serif }}>
          {state === "ready" ? t("thankYou") : t("confirming")}
        </h2>
        <p>
          {state === "ready"
            ? t("ready")
            : state === "expired"
              ? t("expired")
              : t("pending")}
        </p>
        <GlobalLink className={pill} href="/profile/settings#membership">
          {t("manage")}
        </GlobalLink>
      </div>
    )

  return (
    <div
      className="grid min-w-0 md:grid-cols-[1.4fr_1fr]"
      style={{ color: T.ink.base }}
    >
      <div className="space-y-6 p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="text-2xl" style={{ fontFamily: T.font.serif }}>
            Libraries <i>Global</i>
          </span>
          <span className="text-sm font-semibold">{t("secureCheckout")}</span>
          {catalogue?.sandbox ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
              {t("sandbox")}
            </span>
          ) : null}
        </div>
        <ol
          className="m-0 flex list-none items-center gap-3 p-0 text-sm sm:gap-5"
          aria-label={t("steps")}
        >
          {(["plan", "details", "payment"] as const).map((value, index) => {
            const current = step === value
            const complete = step === "details" && value === "plan"

            return (
              <li
                key={value}
                aria-current={current ? "step" : undefined}
                className="flex flex-1 items-center gap-2 font-semibold"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    background: complete
                      ? T.accent.ok
                      : current
                        ? T.accent.primary
                        : "white",
                    color: complete || current ? "white" : T.ink.dim,
                  }}
                >
                  {complete ? "✓" : index + 1}
                </span>
                {t(value)}
              </li>
            )
          })}
        </ol>
        <h2
          className="m-0 text-3xl sm:text-4xl"
          style={{ fontFamily: T.font.serif }}
        >
          {step === "plan" ? t("choose") : t("yourDetails")}
        </h2>
        {!catalogue ? (
          <p role="status">{t("loading")}</p>
        ) : !catalogue.available ? (
          <p>{t("unavailable")}</p>
        ) : step === "plan" ? (
          <>
            <fieldset className="inline-flex flex-wrap gap-1 rounded-full border p-1">
              <legend className="sr-only">{t("interval")}</legend>
              {(["month", "year"] as const).map((value) => (
                <label
                  key={value}
                  className={`${pill} cursor-pointer border-0 focus-within:outline-2 focus-within:outline-offset-2`}
                  style={{
                    background: interval === value ? T.ink.base : "transparent",
                    color: interval === value ? "white" : T.ink.base,
                  }}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="interval"
                    checked={interval === value}
                    onChange={() => setInterval(value)}
                  />{" "}
                  <span className="ml-2">{t(value)}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">{t("plan")}</legend>
              {(["supporter", "pro"] as const).map((value) => {
                const selected = catalogue.prices.find(
                  (p) => p.plan === value && p.interval === interval
                )
                const unavailable =
                  !selected || (value === "pro" && user?.complimentaryPro)

                return (
                  <label
                    key={value}
                    className="rounded-2xl border-2 p-5 focus-within:outline-2 focus-within:outline-offset-4"
                    style={{
                      borderColor:
                        plan === value ? T.accent.primary : T.border.line,
                      background: plan === value ? "#faf9ff" : "white",
                    }}
                  >
                    <input
                      style={{ accentColor: T.accent.primary }}
                      type="radio"
                      name="plan"
                      checked={plan === value}
                      disabled={Boolean(unavailable)}
                      onChange={() => setPlan(value)}
                    />{" "}
                    <span
                      className="ml-2 text-2xl"
                      style={{ fontFamily: T.font.serif }}
                    >
                      {t(value)}
                    </span>
                    <p
                      className="my-5 text-3xl"
                      style={{ fontFamily: T.font.serif }}
                    >
                      {selected
                        ? formatBillingMoney(
                            selected.unitAmount,
                            selected.currency,
                            locale
                          )
                        : t("comingSoon")}{" "}
                      {selected ? `/ ${t(interval)}` : ""}
                    </p>
                    <p className="text-sm">{t(`${value}Description`)}</p>
                  </label>
                )
              })}
            </fieldset>
            {user?.complimentaryPro ? <p>{t("complimentary")}</p> : null}
            <button
              type="button"
              className={`${pill} w-full disabled:opacity-50`}
              style={{ background: T.accent.primary, color: "white" }}
              disabled={
                !price || (plan === "pro" && Boolean(user?.complimentaryPro))
              }
              onClick={() => setStep("details")}
            >
              {t("continue")}
            </button>
          </>
        ) : (
          <>
            {user?.verified ? (
              <>
                <p>
                  {t("accountEmail")} <strong>{user.email}</strong>
                </p>
                <label className="flex gap-3 rounded-xl border p-4">
                  <input
                    style={{ accentColor: T.accent.primary }}
                    type="checkbox"
                    checked={badge}
                    onChange={(e) => setBadge(e.target.checked)}
                  />
                  {t("badge")}
                </label>
                <label className="flex gap-3 rounded-xl border p-4">
                  <input
                    style={{ accentColor: T.accent.primary }}
                    type="checkbox"
                    checked={listed}
                    onChange={(e) => setListed(e.target.checked)}
                  />
                  {t("credit")}
                </label>
                <label className="flex gap-3">
                  <input
                    style={{ accentColor: T.accent.primary }}
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                  <span>
                    {t("termsConsent")}{" "}
                    <GlobalLink className="underline" href="/legal/terms">
                      {t("terms")}
                    </GlobalLink>
                  </span>
                </label>
                <p className="text-sm">{t("providerExplanation")}</p>
                <button
                  type="button"
                  className={`${pill} w-full disabled:opacity-50`}
                  disabled={busy || !terms || !price}
                  style={{ background: T.accent.primary, color: "white" }}
                  onClick={checkout}
                >
                  {busy ? t("opening") : t("continueStripe")}
                </button>
              </>
            ) : (
              <>
                <p>{user ? t("verify") : t("signInExplanation")}</p>
                <GlobalLink
                  className={pill}
                  href={`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`}
                >
                  {t("signIn")}
                </GlobalLink>
                {!user ? (
                  <GlobalLink
                    className={pill}
                    href={`/auth/register?callbackUrl=${encodeURIComponent(callback)}`}
                  >
                    {t("createAccount")}
                  </GlobalLink>
                ) : null}
              </>
            )}
            <button
              type="button"
              className="block underline"
              onClick={() => setStep("plan")}
            >
              {t("back")}
            </button>
          </>
        )}
        {error ? <p role="alert">{t("error")}</p> : null}
      </div>
      <aside
        className="space-y-5 border-t p-6 sm:p-10 md:border-t-0 md:border-l"
        style={{ background: T.bg.void, borderColor: T.border.line }}
      >
        <h3 className="font-semibold">{t("summary")}</h3>
        <p className="text-3xl" style={{ fontFamily: T.font.serif }}>
          {t(plan)}
        </p>
        <p>
          {price
            ? `${formatBillingMoney(price.unitAmount, price.currency, locale)} / ${t(interval)}`
            : t("comingSoon")}
        </p>
        <p className="text-sm">{t("taxAndCurrency")}</p>
        <hr style={{ borderColor: T.border.line }} />
        <p>{t("cancel")}</p>
        <p>{t("trust")}</p>
        <GlobalLink className="underline" href="/profile/settings#membership">
          {t("manage")}
        </GlobalLink>
      </aside>
    </div>
  )
}
