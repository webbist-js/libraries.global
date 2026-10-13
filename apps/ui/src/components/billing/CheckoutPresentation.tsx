"use client"

import { Check, LockKeyhole } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

import { formatBillingMoney, type PriceCatalogue } from "./types"

export function CheckoutHeader({ sandbox }: { readonly sandbox?: boolean }) {
  const t = useTranslations("billing")

  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3 pr-12 lg:pr-0">
      <span
        className="text-2xl sm:text-[28px]"
        style={{ fontFamily: T.font.serif }}
        translate="no"
      >
        Libraries <i>Global</i>
      </span>
      <span className="inline-flex items-center gap-2 text-sm font-semibold sm:text-base">
        <LockKeyhole
          className="size-4 shrink-0 text-(--t-accent-ok)"
          aria-hidden="true"
        />
        {t("secureCheckout")}
      </span>
      {sandbox ? (
        <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
          {t("sandbox")}
        </span>
      ) : null}
    </header>
  )
}

export function CheckoutSteps({ step }: { readonly step: "plan" | "details" }) {
  const t = useTranslations("billing")

  return (
    <ol
      className="m-0 flex list-none items-center p-0 text-sm sm:text-base"
      aria-label={t("steps")}
    >
      {(["plan", "details", "payment"] as const).map((value, index) => {
        const current = step === value
        const complete = step === "details" && value === "plan"

        return (
          <li
            key={value}
            aria-current={current ? "step" : undefined}
            className="flex min-w-0 items-center gap-2 font-semibold last:shrink-0 sm:gap-3 [&:not(:last-child)]:flex-1"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full border sm:size-9"
              style={{
                background: complete
                  ? T.accent.ok
                  : current
                    ? T.accent.primary
                    : "white",
                borderColor: complete
                  ? T.accent.ok
                  : current
                    ? T.accent.primary
                    : T.border.line,
                color: complete || current ? "white" : T.ink.dim,
              }}
            >
              {complete ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            <span className={current || complete ? "" : "text-(--t-ink-dim)"}>
              {t(value)}
            </span>
            {index < 2 ? (
              <span
                className="mx-2 hidden h-px min-w-2 flex-1 bg-(--t-border-line) sm:block"
                aria-hidden="true"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function CheckoutPlanPicker({
  catalogue,
  plan,
  interval,
  complimentaryPro,
  onPlan,
  onInterval,
}: {
  readonly catalogue: PriceCatalogue
  readonly plan: "supporter" | "pro"
  readonly interval: "month" | "year"
  readonly complimentaryPro?: boolean
  readonly onPlan: (plan: "supporter" | "pro") => void
  readonly onInterval: (interval: "month" | "year") => void
}) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const monthly = catalogue.prices.find(
    (p) => p.plan === plan && p.interval === "month"
  )
  const yearly = catalogue.prices.find(
    (p) => p.plan === plan && p.interval === "year"
  )
  const twoMonthsFree =
    monthly &&
    yearly &&
    monthly.currency === yearly.currency &&
    monthly.unitAmount * 10 === yearly.unitAmount

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <fieldset className="m-0 flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-(--t-border-line) p-1">
        <legend className="sr-only">{t("interval")}</legend>
        {(["month", "year"] as const).map((value) => (
          <label
            key={value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-2.5 font-semibold transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-(--t-accent-primary) sm:px-5",
              interval === value
                ? "bg-(--t-ink-base) text-white hover:bg-(--t-ink-base)/90"
                : "bg-transparent text-(--t-ink-base) hover:bg-(--t-bg-surface)"
            )}
          >
            <input
              className="sr-only"
              type="radio"
              name="interval"
              value={value}
              checked={interval === value}
              onChange={() => onInterval(value)}
            />
            {t(value)}
            {value === "year" && twoMonthsFree ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800">
                {t("twoMonthsFree")}
              </span>
            ) : null}
          </label>
        ))}
      </fieldset>
      <fieldset className="m-0 grid gap-4 p-0 sm:grid-cols-2">
        <legend className="sr-only">{t("plan")}</legend>
        {(["supporter", "pro"] as const).map((value) => {
          const price = catalogue.prices.find(
            (p) => p.plan === value && p.interval === interval
          )
          const disabled = !price || (value === "pro" && complimentaryPro)
          const benefits =
            value === "pro"
              ? [
                  t("includedSupporter"),
                  t("exportBenefit", {
                    count: new Intl.NumberFormat(locale).format(10000),
                  }),
                  t("comparisonBenefit"),
                ]
              : [
                  t("historyBenefit"),
                  t("exportBenefit", {
                    count: new Intl.NumberFormat(locale).format(500),
                  }),
                  t("recognitionBenefit"),
                ]

          return (
            <label
              key={value}
              className={cn(
                "flex min-w-0 flex-col gap-5 rounded-3xl border-2 p-5 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-4 has-[input:focus-visible]:outline-(--t-accent-primary) sm:p-6",
                plan === value
                  ? "border-(--t-accent-primary) bg-[#faf9ff]"
                  : "border-(--t-border-line) bg-(--t-bg-deep)",
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:border-(--t-accent-primary) hover:bg-(--t-bg-selected)"
              )}
            >
              <span className="flex flex-wrap items-center gap-3">
                <input
                  className="size-5 shrink-0"
                  style={{ accentColor: T.accent.primary }}
                  type="radio"
                  name="plan"
                  value={value}
                  checked={plan === value}
                  disabled={Boolean(disabled)}
                  onChange={() => onPlan(value)}
                />
                <span
                  className="text-[30px] leading-none"
                  style={{ fontFamily: T.font.serif }}
                >
                  {t(value)}
                </span>
                {value === "pro" ? (
                  <span className="rounded-full bg-(--t-accent-chip) px-2.5 py-1 text-xs font-semibold text-(--t-accent-primary)">
                    {t("foundingPrice")}
                  </span>
                ) : null}
              </span>
              <span className="flex flex-wrap items-baseline gap-2">
                <span
                  className="text-[42px] leading-none tabular-nums"
                  style={{ fontFamily: T.font.serif }}
                >
                  {price
                    ? formatBillingMoney(
                        price.unitAmount,
                        price.currency,
                        locale
                      )
                    : t("comingSoon")}
                </span>
                {price ? (
                  <span className="text-sm font-medium text-(--t-ink-dim)">
                    / {t(interval === "month" ? "perMonth" : "perYear")}
                  </span>
                ) : null}
              </span>
              <span className="text-sm leading-relaxed text-(--t-ink-dim)">
                {t(value === "pro" ? "proIntro" : "supporterIntro")}
              </span>
              <ul className="m-0 flex list-none flex-col gap-3 border-t border-(--t-border-line) pt-4 pl-0 text-sm leading-relaxed">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-(--t-accent-ok)"
                      aria-hidden="true"
                    />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}

export function CheckoutSummary({
  catalogue,
  plan,
  interval,
  onInterval,
  disabled = false,
}: {
  readonly catalogue: PriceCatalogue | null
  readonly plan: "supporter" | "pro"
  readonly interval: "month" | "year"
  readonly onInterval: (interval: "month" | "year") => void
  readonly disabled?: boolean
}) {
  const t = useTranslations("billing")
  const locale = useLocale()
  const price = catalogue?.prices.find(
    (p) => p.plan === plan && p.interval === interval
  )
  const yearly = catalogue?.prices.find(
    (p) => p.plan === plan && p.interval === "year"
  )
  const annualSaving =
    interval === "month" &&
    price &&
    yearly &&
    price.currency === yearly.currency
      ? price.unitAmount * 12 - yearly.unitAmount
      : 0

  return (
    <aside className="flex min-w-0 flex-col gap-6 border-t border-(--t-border-line) bg-(--t-bg-void) p-6 sm:p-10 lg:border-t-0 lg:border-l lg:pt-24">
      <h3 className="m-0 text-base font-semibold text-(--t-accent-primary)">
        {t("summary")}
      </h3>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p
          className="m-0 text-[36px] leading-none"
          style={{ fontFamily: T.font.serif }}
        >
          {t(plan)}
        </p>
        <p className="m-0 text-lg font-semibold tabular-nums">
          {price
            ? formatBillingMoney(price.unitAmount, price.currency, locale)
            : catalogue
              ? t("unavailable")
              : t("loading")}
        </p>
      </div>
      <p className="m-0 -mt-3 text-(--t-ink-dim)">
        {t(interval === "month" ? "billedMonthly" : "billedYearly")}
      </p>
      <div className="flex flex-col gap-5 border-y border-(--t-border-line) py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-semibold">{t("basePrice")}</span>
          <span
            className="text-[42px] leading-none tabular-nums"
            style={{ fontFamily: T.font.serif }}
          >
            {price
              ? formatBillingMoney(price.unitAmount, price.currency, locale)
              : "—"}
          </span>
        </div>
        <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
          {t("taxAndCurrency")}
        </p>
      </div>
      <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t(interval === "month" ? "renewsMonthly" : "renewsYearly")}
      </p>
      {annualSaving > 0 && yearly ? (
        <Button
          type="button"
          variant="surface"
          size="pill"
          disabled={disabled}
          onClick={() => onInterval("year")}
          className="flex-col items-start gap-1 rounded-2xl border-green-200 bg-green-50 px-4 text-left text-sm font-normal text-green-800 hover:bg-green-100"
        >
          <span className="font-semibold">
            {t("switchYearly", {
              amount: formatBillingMoney(
                yearly.unitAmount,
                yearly.currency,
                locale
              ),
            })}
          </span>
          <span>
            {t("annualSaving", {
              amount: formatBillingMoney(annualSaving, yearly.currency, locale),
            })}
          </span>
        </Button>
      ) : null}
      <ul className="mt-auto mb-0 flex list-none flex-col gap-4 border-t border-(--t-border-line) pt-6 pl-0 text-sm leading-relaxed">
        {[t("cancel"), t("trust"), t("securePaymentBenefit")].map((benefit) => (
          <li key={benefit} className="flex items-start gap-3">
            <Check
              className="mt-0.5 size-4 shrink-0 text-(--t-accent-ok)"
              aria-hidden="true"
            />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
