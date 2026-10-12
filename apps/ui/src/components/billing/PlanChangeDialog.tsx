"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { T } from "@/lib/design-tokens"

import {
  formatBillingMoney,
  formatBillingDate,
  type PriceCatalogue,
} from "./types"

export function PlanChangeDialog({
  plan,
  interval,
  onComplete,
  complimentaryPro = false,
}: {
  readonly plan: "pro" | "supporter"
  readonly interval: "month" | "year"
  readonly onComplete?: () => void
  readonly complimentaryPro?: boolean
}) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(plan)
  const [selectedInterval, setSelectedInterval] = useState(interval)
  const [catalogue, setCatalogue] = useState<PriceCatalogue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [quote, setQuote] = useState<{
    kind: "schedule"
    effectiveAt: number
    unitAmount: number
    currency: string
    scheduled: boolean
  } | null>(null)
  useEffect(() => {
    if (!open) return
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
  }, [open])
  const selected = catalogue?.prices.find(
    (p) => p.plan === selectedPlan && p.interval === selectedInterval
  )
  const current = selectedPlan === plan && selectedInterval === interval
  const review = async () => {
    setBusy(true)
    setError(false)
    try {
      const response = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          interval: selectedInterval,
          locale,
          ...(quote
            ? { action: "confirm", effectiveAt: quote.effectiveAt }
            : {}),
        }),
      })
      if (!response.ok) throw new Error("change")
      const result = (await response.json()) as
        | { url: string }
        | NonNullable<typeof quote>
      if ("kind" in result && result.kind === "schedule") {
        if (result.scheduled) {
          setOpen(false)
          setQuote(null)
          onComplete?.()
        } else setQuote(result)
        setBusy(false)

        return
      }
      if (!("url" in result)) throw new Error("provider")
      const url = new URL(result.url)
      if (
        url.protocol !== "https:" ||
        url.hostname !== "billing.stripe.com" ||
        url.username ||
        url.password
      )
        throw new Error("provider")
      window.location.assign(result.url)
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) setQuote(null)
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="min-h-11 rounded-full border px-5 font-semibold"
        >
          {t("changePlan")}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-dvh overflow-y-auto rounded-3xl sm:max-w-xl [&_[data-slot=dialog-close]]:grid [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:place-items-center"
        style={{ background: T.bg.deep, color: T.ink.base }}
      >
        <DialogTitle
          className="pr-12 text-3xl"
          style={{ fontFamily: T.font.serif }}
        >
          {t("changePlan")}
        </DialogTitle>
        <DialogDescription style={{ color: T.ink.dim }}>
          {t("changeReviewExplanation")}
        </DialogDescription>
        <fieldset className="flex gap-3">
          <legend className="sr-only">{t("interval")}</legend>
          {(["month", "year"] as const).map((value) => (
            <label key={value} className="rounded-full border px-5 py-3">
              <input
                type="radio"
                name="change-interval"
                checked={selectedInterval === value}
                onChange={() => {
                  setSelectedInterval(value)
                  setQuote(null)
                }}
                style={{ accentColor: T.accent.primary }}
              />
              <span className="ml-2">{t(value)}</span>
            </label>
          ))}
        </fieldset>
        {!catalogue ? (
          <p role="status">{t("loading")}</p>
        ) : (
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">{t("plan")}</legend>
            {(["supporter", "pro"] as const).map((value) => {
              const price = catalogue.prices.find(
                (p) => p.plan === value && p.interval === selectedInterval
              )

              return (
                <label
                  key={value}
                  className="rounded-2xl border-2 p-4"
                  style={{
                    borderColor:
                      selectedPlan === value ? T.accent.primary : T.border.line,
                    background: selectedPlan === value ? "#faf9ff" : "white",
                  }}
                >
                  <input
                    type="radio"
                    name="change-plan"
                    checked={selectedPlan === value}
                    disabled={
                      !price ||
                      (value === "pro" && plan !== "pro" && complimentaryPro)
                    }
                    onChange={() => {
                      setSelectedPlan(value)
                      setQuote(null)
                    }}
                    style={{ accentColor: T.accent.primary }}
                  />
                  <span
                    className="ml-2 text-2xl"
                    style={{ fontFamily: T.font.serif }}
                  >
                    {t(value)}
                  </span>
                  <p className="font-semibold">
                    {price
                      ? formatBillingMoney(
                          price.unitAmount,
                          price.currency,
                          locale
                        )
                      : t("comingSoon")}
                  </p>
                  <p className="text-sm">{t(`${value}Description`)}</p>
                  {value === "pro" && plan !== "pro" && complimentaryPro ? (
                    <p className="text-sm">{t("complimentary")}</p>
                  ) : null}
                </label>
              )
            })}
          </fieldset>
        )}
        {error ? <p role="alert">{t("error")}</p> : null}
        {quote ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4"
          >
            <p>
              {t("scheduledReview", {
                plan: t(selectedPlan),
                interval: t(selectedInterval),
                amount: formatBillingMoney(
                  quote.unitAmount,
                  quote.currency,
                  locale
                ),
                date: formatBillingDate(quote.effectiveAt * 1000, locale),
              })}
            </p>
            <p className="text-sm">{t("scheduledNoCharge")}</p>
          </div>
        ) : null}
        <button
          type="button"
          disabled={
            busy ||
            current ||
            !selected ||
            (selectedPlan === "pro" && plan !== "pro" && complimentaryPro)
          }
          onClick={review}
          className="min-h-12 rounded-full px-6 font-semibold text-white disabled:opacity-50"
          style={{ background: T.accent.primary }}
        >
          {current
            ? t("currentPlan")
            : busy
              ? t("opening")
              : quote
                ? t("confirmSchedule")
                : t("reviewChange")}
        </button>
      </DialogContent>
    </Dialog>
  )
}
