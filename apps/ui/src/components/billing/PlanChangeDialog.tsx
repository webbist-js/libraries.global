"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

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
        <Button type="button" variant="surface" size="pill">
          {t("changePlan")}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-5 overflow-y-auto overscroll-contain rounded-3xl p-6 sm:max-w-2xl sm:gap-6 sm:p-8"
        closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-white opacity-100 hover:bg-(--t-bg-surface)"
        style={{ background: T.bg.deep, color: T.ink.base }}
      >
        <DialogHeader className="shrink-0 gap-3 text-left">
          <DialogTitle
            className="m-0 pr-12 text-3xl leading-tight font-normal sm:text-4xl"
            style={{ fontFamily: T.font.serif }}
          >
            {t("changePlan")}
          </DialogTitle>
          <DialogDescription
            className="m-0 leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            {t("changeReviewExplanation")}
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={busy}
          className="m-0 flex w-fit max-w-full shrink-0 flex-wrap gap-1 rounded-full border border-(--t-border-line) p-1"
        >
          <legend className="sr-only">{t("interval")}</legend>
          {(["month", "year"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-full px-5 py-2.5 font-semibold transition-colors has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-60 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--t-accent-primary)",
                selectedInterval === value
                  ? "bg-(--t-ink-base) text-white hover:bg-(--t-ink-base)/90"
                  : "bg-transparent text-(--t-ink-base) hover:bg-(--t-bg-surface)"
              )}
            >
              <input
                className="sr-only"
                type="radio"
                name="change-interval"
                checked={selectedInterval === value}
                onChange={() => {
                  setSelectedInterval(value)
                  setQuote(null)
                }}
                style={{ accentColor: T.accent.primary }}
              />
              <span>{t(value)}</span>
            </label>
          ))}
        </fieldset>
        {!catalogue ? (
          <p role="status">{t("loading")}</p>
        ) : (
          <fieldset
            disabled={busy}
            className="m-0 grid shrink-0 gap-4 p-0 sm:grid-cols-2"
          >
            <legend className="sr-only">{t("plan")}</legend>
            {(["supporter", "pro"] as const).map((value) => {
              const price = catalogue.prices.find(
                (p) => p.plan === value && p.interval === selectedInterval
              )

              return (
                <label
                  key={value}
                  className={cn(
                    "flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 transition-colors has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-60 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-(--t-accent-primary)",
                    selectedPlan === value
                      ? "border-(--t-accent-primary) bg-[#faf9ff]"
                      : "border-(--t-border-line) bg-(--t-bg-deep)",
                    "hover:border-(--t-accent-primary) hover:bg-(--t-bg-selected)"
                  )}
                >
                  <span className="flex flex-wrap items-center gap-3">
                    <input
                      className="size-5 shrink-0"
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
                      className="text-3xl leading-none"
                      style={{ fontFamily: T.font.serif }}
                    >
                      {t(value)}
                    </span>
                    {value === plan && selectedInterval === interval ? (
                      <span className="rounded-full bg-(--t-bg-muted) px-2.5 py-1 text-xs font-semibold">
                        {t("currentPlan")}
                      </span>
                    ) : null}
                  </span>
                  <p className="m-0 font-semibold tabular-nums">
                    {price
                      ? formatBillingMoney(
                          price.unitAmount,
                          price.currency,
                          locale
                        )
                      : t("comingSoon")}{" "}
                    {price
                      ? `/ ${t(selectedInterval === "month" ? "perMonth" : "perYear")}`
                      : ""}
                  </p>
                  <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                    {t(`${value}Description`)}
                  </p>
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
            className="flex shrink-0 flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4"
          >
            <p className="m-0 leading-relaxed">
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
            <p className="m-0 text-sm">{t("scheduledNoCharge")}</p>
          </div>
        ) : null}
        <div className="flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <DialogClose asChild>
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={busy}
              className="min-h-12 w-full text-base sm:w-auto"
            >
              {t("dismiss")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="primary"
            size="pill"
            disabled={
              busy ||
              current ||
              !selected ||
              (selectedPlan === "pro" && plan !== "pro" && complimentaryPro)
            }
            onClick={review}
            className="min-h-12 w-full max-w-full text-base sm:w-auto"
          >
            {current
              ? t("currentPlan")
              : busy
                ? t("opening")
                : quote
                  ? t("confirmSchedule")
                  : t("reviewChange")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
