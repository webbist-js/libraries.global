import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"

import { apiSectionHref } from "@/components/developers/ApiWorkspace"
import { formatApiBytes } from "@/components/staff/api-format"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import { API_OFFER, API_REACH, offerValues } from "@/lib/plans"
import type { ApiLimits } from "@/lib/team-api/types"

/**
 * The standalone API offer on /developers: what £100 a month buys, the
 * allowances and limits, how opt-in overage works and where to start. It
 * works for an account with no organisation; checkout creates one.
 */
export function ApiOfferOverview({
  buy,
  limits,
  overageAvailable,
  showPricing = true,
}: {
  /** Where "Buy API access" goes, or null when the viewer already has an account to manage. */
  readonly buy: { href: string; label: "buy" | "signIn" } | null
  /** The offer's rate and size limits (`apiConfig().limits`). */
  readonly limits: Pick<
    ApiLimits,
    "perMinute" | "concurrency" | "responseBytes" | "pageSize"
  >
  readonly showPricing?: boolean
  readonly overageAvailable: boolean
}) {
  const t = useTranslations("developersOffer")
  const locale = useLocale()
  const values = offerValues(locale)
  const count = (n: number) => new Intl.NumberFormat(locale).format(n)
  const metrics = [
    { label: t("requests"), value: values.apiRequests },
    {
      label: t("responseData"),
      value: formatApiBytes(API_OFFER.bytes, locale),
    },
    { label: t("credits"), value: values.apiCredits },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="api-introduction"
        className="grid min-w-0 gap-6 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7 xl:grid-cols-2"
      >
        <div>
          <p className="mb-3 text-sm font-semibold text-(--t-accent-primary)">
            {t("introEyebrow")}
          </p>
          <h2 id="api-introduction" className="type-h2 m-0">
            {t("introTitle")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-(--t-ink-dim)">
            {t("introBody")}
          </p>
          <ul className="m-0 grid list-none gap-3 p-0 text-sm">
            {(["discover", "retrieve", "attribute"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2">
                <Icon
                  aria-hidden
                  icon="mdi:check"
                  className="mt-0.5 shrink-0 text-(--t-accent-primary)"
                />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl bg-(--t-bg-inverse) text-(--t-ink-on-dark)">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/20 px-5 py-3 text-sm">
            <span>{t("exampleTitle")}</span>
            <span className="font-mono">cURL</span>
          </div>
          <pre
            tabIndex={0}
            aria-label={t("exampleTitle")}
            className="m-0 overflow-x-auto p-5 font-mono text-sm leading-loose focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-current"
            translate="no"
          >
            <code>
              {[
                "curl https://libraries.global/api/v1/libraries \\",
                '  -H "Authorization: Bearer YOUR_API_KEY"',
              ].join("\n")}
            </code>
          </pre>
          <p className="m-0 border-t border-current/20 px-5 py-4 text-sm leading-relaxed">
            {t("exampleNote")}
          </p>
        </div>
      </section>
      {showPricing ? (
        <StaffPanel
          id="api-offer"
          title={t("title")}
          aside={
            <span className="rounded-full bg-(--t-accent-chip) px-3 py-1 text-sm font-semibold text-(--t-accent-primary)">
              {t("badge")}
            </span>
          }
        >
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="type-stat tabular-nums">{values.apiPrice}</span>
            <span className="text-base text-(--t-ink-dim)">
              {t("perMonth")}
            </span>
          </p>
          <p className="mt-2 mb-0 max-w-[70ch] text-base leading-relaxed text-(--t-ink-dim)">
            {t("priceNote")}
          </p>

          {buy ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {buy.href.startsWith("#") ? (
                <a
                  href={buy.href}
                  className={buttonVariants({
                    variant: "primary",
                    size: "pill",
                  })}
                >
                  {t(buy.label)}
                  <Icon aria-hidden icon="mdi:arrow-down" />
                </a>
              ) : (
                <Link
                  href={buy.href}
                  className={buttonVariants({
                    variant: "primary",
                    size: "pill",
                  })}
                >
                  {t(buy.label)}
                </Link>
              )}
              <Link
                href={apiSectionHref("reference")}
                className={buttonVariants({ variant: "surface", size: "pill" })}
              >
                {t("readReference")}
              </Link>
            </div>
          ) : null}

          <h3 className="type-small-heading mt-6 mb-3">{t("includedTitle")}</h3>
          <dl className="m-0 grid gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-accent-chip) p-4"
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
          <p className="mt-4 mb-0 max-w-[70ch] text-sm leading-relaxed text-(--t-ink-dim)">
            {t("period")}
          </p>
        </StaffPanel>
      ) : null}

      <details className="group rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7">
        <summary className="cursor-pointer rounded text-base font-semibold focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)">
          {t("detailsTitle")}
        </summary>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <StaffPanel
            compact
            id="api-overage"
            title={t(overageAvailable ? "overageTitle" : "overageOffTitle")}
          >
            {overageAvailable ? (
              <>
                <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
                  {t("overageBody", values)}
                </p>
                <ul className="mt-3 mb-0 flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-(--t-ink-dim)">
                  <li>{t("overageRequest", values)}</li>
                  <li>{t("overageMib", values)}</li>
                  <li>{t("overageCredit", values)}</li>
                </ul>
                <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                  {t("overageStop")}
                </p>
              </>
            ) : (
              <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
                {t("overageUnavailable")}
              </p>
            )}
          </StaffPanel>
          <StaffPanel compact id="api-who" title={t("whoTitle")}>
            <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
              {t("whoBody")}
            </p>
            <p className="mt-3 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("reachBonus", {
                perHour: API_REACH.perHour,
                perDay: API_REACH.perDay,
                libraries: API_REACH.serviceLibraries,
              })}
            </p>
          </StaffPanel>
        </div>
      </details>

      <p className="m-0 flex items-start gap-2 text-sm leading-relaxed text-(--t-ink-dim)">
        <Icon
          aria-hidden
          className="mt-0.5 shrink-0 text-(--t-accent-ok)"
          icon="mdi:shield-check-outline"
          width={16}
          height={16}
        />
        <span>
          {t("independence")}{" "}
          <Link href="/legal/membership" className={STAFF_LINK}>
            {t("terms")}
          </Link>
        </span>
      </p>
    </div>
  )
}
