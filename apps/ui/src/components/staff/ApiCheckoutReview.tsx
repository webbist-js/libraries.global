"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import {
  API_TERMS_VERSION,
  OVERAGE_CAP_MAX_PENCE,
  OVERAGE_CAP_MIN_PENCE,
} from "@/lib/team-api/constants"
import type { ApiLimits, ApiOverageRates } from "@/lib/team-api/types"

import { formatApiBytes, formatPence } from "./api-format"

/**
 * The API checkout review: £100/month tax-inclusive, the three included
 * allowances, limits, the opt-in overage basis and a fresh consent step.
 */
export function ApiCheckoutReview({
  price,
  purchasing,
  overageAvailable,
  limits,
  rates,
  locale,
  pending,
  error,
  owner,
  onCancel,
  onSubscribe,
}: {
  readonly price: { unitAmount: number; currency: string } | null
  readonly purchasing: boolean
  readonly overageAvailable: boolean
  readonly limits: ApiLimits
  readonly rates: ApiOverageRates
  readonly locale: string
  readonly pending: boolean
  readonly error: string
  /** Who will own the subscription, for example the organisation name. */
  readonly owner: string
  readonly onCancel?: () => void
  readonly onSubscribe: (termsVersion: string) => void
}) {
  const t = useTranslations("teamApiSubscription")
  const consentId = useId()
  const [consent, setConsent] = useState(false)
  const count = (value: number) => new Intl.NumberFormat(locale).format(value)
  const available = purchasing && Boolean(price)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5">
        {price ? (
          <>
            <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-sans text-[38px] leading-tight tabular-nums">
                {formatPence(price.unitAmount, locale, price.currency)}
              </span>
              <span className="text-base text-(--t-ink-dim)">
                {t("perMonthTaxIncluded")}
              </span>
            </p>
            <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("taxDetail")} {t("billedTo", { owner })}
            </p>
          </>
        ) : null}
        {!available ? (
          <p
            role="status"
            className="m-0 text-base leading-relaxed text-(--t-ink-dim)"
          >
            {t("unavailable")}
          </p>
        ) : null}
      </div>
      <div>
        <h3 className="type-small-heading mt-0 mb-3">{t("allowance")}</h3>
        <dl className="m-0 grid gap-3 sm:grid-cols-3">
          {[
            { label: t("requests"), value: count(limits.requests) },
            {
              label: t("responseData"),
              value: formatApiBytes(limits.bytes, locale),
            },
            { label: t("credits"), value: count(limits.analysisCredits) },
          ].map((metric) => (
            <div
              key={metric.label}
              className="min-w-0 rounded-2xl border border-(--t-border-line) p-4"
            >
              <dt className="text-sm font-semibold text-(--t-ink-dim)">
                {metric.label}
              </dt>
              <dd className="type-h2 mt-2 mb-0 ml-0 [overflow-wrap:anywhere] tabular-nums">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 mb-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm leading-relaxed text-(--t-ink-dim)">
          <li>{t("rate", { count: count(limits.perMinute) })}</li>
          <li>{t("concurrency", { count: count(limits.concurrency) })}</li>
          <li>
            {t("responseLimit", {
              size: formatApiBytes(limits.responseBytes, locale),
              records: count(limits.pageSize),
            })}
          </li>
          <li>{t("keys")}</li>
        </ul>
        <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
          {overageAvailable
            ? t("periodAndOverage", {
                capMin: formatPence(OVERAGE_CAP_MIN_PENCE, locale),
                capMax: formatPence(OVERAGE_CAP_MAX_PENCE, locale),
                request: formatPence(rates.requestPence, locale),
                mib: formatPence(rates.mibPence, locale),
                credit: formatPence(rates.creditPence, locale),
              })
            : t("periodNoOverage")}
        </p>
      </div>

      <label
        htmlFor={consentId}
        className="flex cursor-pointer items-start gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-base leading-relaxed"
      >
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          disabled={pending}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
        />
        <span>
          {t.rich("consent", {
            membership: (chunks) => (
              <Link href="/legal/membership" className={STAFF_LINK}>
                {chunks}
              </Link>
            ),
            refunds: (chunks) => (
              <Link href="/legal/cancellation-refunds" className={STAFF_LINK}>
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-(--t-accent-danger)/30 bg-(--t-bg-surface) p-4 text-base leading-relaxed text-(--t-accent-danger)"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3 border-t border-(--t-border-line) pt-5">
        {onCancel ? (
          <Button
            type="button"
            variant="surface"
            size="pill"
            disabled={pending}
            onClick={onCancel}
          >
            {t("cancel")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="pill"
          disabled={pending || !consent || !available}
          aria-busy={pending}
          onClick={() => onSubscribe(API_TERMS_VERSION)}
        >
          {t(pending ? "opening" : "subscribe")}
        </Button>
      </div>
    </div>
  )
}
