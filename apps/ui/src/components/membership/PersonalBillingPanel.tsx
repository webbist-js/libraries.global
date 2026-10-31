"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"

import { PlanChangeDialog } from "@/components/billing/PlanChangeDialog"
import {
  formatBillingMoney,
  formatBillingDate,
  membershipStatusKey,
  invoiceStatusKey,
} from "@/components/billing/types"
import { useContactModal } from "@/components/contact/ContactModalProvider"
import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import type { MembershipBillingController } from "@/components/membership/useMembershipBilling"
import { SectionCard } from "@/components/profile-form/FormParts"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"

export function PersonalBillingPanel({
  billing,
  billingOnly = false,
}: {
  readonly billing: MembershipBillingController
  readonly billingOnly?: boolean
}) {
  const t = useTranslations("billing")
  const tContact = useTranslations("contactModal.contact")
  const { openContact } = useContactModal()
  const locale = useLocale()
  const { summary, error, busy, manage, undo, reload } = billing
  const membership = summary?.membership
  const membershipStatus = membership ? membershipStatusKey(membership) : null

  return (
    <SectionCard
      id={billingOnly ? "billing" : "membership"}
      title={billingOnly ? t("personalBillingTitle") : t("settingsTitle")}
      lead={billingOnly ? t("personalBillingLead") : t("settingsLead")}
    >
      {error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-2xl bg-(--t-palette-coral-soft) p-5"
        >
          <p className="m-0 flex items-start gap-2.5 text-base leading-relaxed text-(--t-palette-coral-fg)">
            <Icon
              aria-hidden
              icon="mdi:alert-circle-outline"
              className="mt-0.5 size-5 shrink-0"
            />
            {t("error")}
          </p>
          <Button type="button" variant="surface" size="pill" onClick={reload}>
            {t("retry")}
          </Button>
        </div>
      ) : !summary ? (
        <div
          role="status"
          className="flex flex-col gap-4 rounded-2xl bg-(--t-bg-surface) p-5 sm:p-6"
        >
          <div
            aria-hidden="true"
            className="flex flex-col gap-3 motion-safe:animate-pulse"
          >
            <span className="h-3 w-24 rounded-full bg-(--t-bg-muted)" />
            <span className="h-9 w-36 rounded-lg bg-(--t-bg-muted)" />
            <span className="h-3 w-3/4 max-w-sm rounded-full bg-(--t-bg-muted)" />
          </div>
          <p className="m-0 text-sm text-(--t-ink-dim)">{t("loading")}</p>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-5 rounded-[18px] bg-(--t-bg-surface) p-5 sm:p-6">
            {!billingOnly && (!summary.confirmationPending || membership) && (
              <div className="flex items-start gap-3.5 border-b border-(--t-border-line) pb-5">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-(--t-bg-deep) text-(--t-accent-primary)"
                >
                  <Icon icon="mdi:account-check-outline" className="size-6" />
                </span>
                <dl className="m-0 min-w-0 flex-1">
                  <dt className="text-sm font-semibold text-(--t-ink-dim)">
                    {t("effectiveAccess")}
                  </dt>
                  <dd className="m-0 mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className="text-[34px] leading-none text-(--t-ink-base)"
                      style={{ fontFamily: T.font.sans }}
                    >
                      {t(`accessPlans.${summary.effectivePlan}`)}
                    </span>
                    <Badge
                      label={t(`accessSources.${summary.accessSource}`)}
                      color="aurora"
                    />
                  </dd>
                </dl>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="type-h3 m-0 text-(--t-ink-base)">
                  {membership
                    ? t(membership.plan)
                    : summary.confirmationPending
                      ? t("confirming")
                      : t("noMembership")}
                </h3>
                {membership ? (
                  <Badge
                    color={
                      membershipStatus === "active"
                        ? "ok"
                        : membershipStatus === "paymentAttention" ||
                            membershipStatus === "suspended"
                          ? "warn"
                          : "dim"
                    }
                    label={
                      summary.confirmationPending
                        ? t("membershipConfirming")
                        : membershipStatus
                          ? t(membershipStatus)
                          : ""
                    }
                  />
                ) : null}
                {summary.foundingPrice ? (
                  <Badge label={t("foundingPrice")} color="violet" />
                ) : null}
              </div>
              {membership ? (
                <>
                  <dl className="m-0 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-(--t-ink-dim)">{t("basePrice")}</dt>
                      <dd className="m-0 mt-1 font-semibold text-(--t-ink-base) tabular-nums">
                        {formatBillingMoney(
                          membership.unitAmount,
                          membership.currency,
                          locale
                        )}{" "}
                        / {t(membership.interval)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-(--t-ink-dim)">
                        {membership.cancelAtPeriodEnd
                          ? t("ends")
                          : t("periodEnd")}
                        :{" "}
                      </dt>
                      <dd className="m-0 mt-1 font-semibold text-(--t-ink-base) tabular-nums">
                        {membership.periodEnd
                          ? formatBillingDate(membership.periodEnd, locale)
                          : "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="inline text-(--t-ink-dim)">
                        {t("memberSince")}:{" "}
                      </dt>
                      <dd className="m-0 inline text-(--t-ink-base)">
                        {formatBillingDate(membership.memberSince, locale)}
                      </dd>
                    </div>
                  </dl>
                  <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                    {t("taxAndCurrency")}
                  </p>
                  {summary.scheduledChange ? (
                    <div
                      role="status"
                      className="flex flex-col items-start gap-3 rounded-xl bg-(--t-palette-amber-bg) p-4 text-sm leading-relaxed text-(--t-palette-amber-fg)"
                    >
                      <p className="m-0">
                        {t("scheduledChange", {
                          plan: t(summary.scheduledChange.plan),
                          interval: t(summary.scheduledChange.interval),
                          amount: formatBillingMoney(
                            summary.scheduledChange.unitAmount,
                            summary.scheduledChange.currency,
                            locale
                          ),
                          date: formatBillingDate(
                            summary.scheduledChange.date * 1000,
                            locale
                          ),
                        })}
                      </p>
                      <Button
                        type="button"
                        variant="surface"
                        size="pill"
                        onClick={
                          summary.scheduledChange.canUndo ? undo : manage
                        }
                        disabled={busy}
                      >
                        {summary.scheduledChange.canUndo
                          ? t("undoScheduledChange")
                          : t("reviewScheduledChange")}
                      </Button>
                    </div>
                  ) : null}
                  {membership.status === "past_due" ||
                  membership.status === "unpaid" ||
                  summary.paymentAttention ? (
                    <div
                      role="status"
                      className="flex flex-col gap-2 rounded-xl bg-(--t-palette-coral-bg) p-4 text-sm leading-relaxed text-(--t-palette-coral-fg)"
                    >
                      <p className="m-0 font-semibold">
                        {t("paymentAttention")}
                      </p>
                      <p className="m-0">{t("paymentAttentionBody")}</p>
                      {summary.nextAttempt ? (
                        <p className="m-0">
                          {t("nextRetry")}:{" "}
                          {formatBillingMoney(
                            summary.nextAttempt.total,
                            summary.nextAttempt.currency,
                            locale
                          )}{" "}
                          ·{" "}
                          {formatBillingDate(
                            summary.nextAttempt.date * 1000,
                            locale
                          )}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="m-0 max-w-[55ch] text-sm leading-relaxed text-(--t-ink-dim)">
                  {summary.confirmationPending
                    ? t("pending")
                    : t("freeRemains")}
                </p>
              )}
            </div>
            {summary.confirmationPending && membership ? (
              <p
                role="status"
                className="m-0 text-sm leading-relaxed text-(--t-ink-dim)"
              >
                {t("pending")}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {summary.canManage ? (
                <Button
                  type="button"
                  variant="primary"
                  size="pill"
                  className="w-full sm:w-auto"
                  onClick={manage}
                  disabled={busy}
                >
                  {busy ? t("opening") : t("manage")}
                  <Icon
                    aria-hidden
                    icon="mdi:arrow-top-right"
                    className="size-4"
                  />
                </Button>
              ) : (
                <Button
                  asChild
                  variant="primary"
                  size="pill"
                  className="w-full sm:w-auto"
                >
                  <GlobalLink href="/plans">
                    {t("viewPlans")}
                    <Icon
                      aria-hidden
                      icon="mdi:arrow-right"
                      className="size-4"
                    />
                  </GlobalLink>
                </Button>
              )}
              {summary.canManage &&
              summary.available &&
              membershipStatus === "active" &&
              membership &&
              !membership.cancelAtPeriodEnd &&
              !summary.scheduledChange &&
              !summary.paymentAttention &&
              !membership.revoked &&
              !membership.graceExpired ? (
                <div className="[&>button]:w-full sm:[&>button]:w-auto">
                  <PlanChangeDialog
                    plan={membership.plan}
                    interval={membership.interval}
                    onComplete={reload}
                    complimentaryPro={
                      ["pro", "team"].includes(summary.effectivePlan) &&
                      summary.accessSource !== "paid"
                    }
                  />
                </div>
              ) : null}
              {membership ||
              ["supporter", "pro", "team"].includes(summary.effectivePlan) ? (
                <Button
                  type="button"
                  aria-haspopup="dialog"
                  variant="surface"
                  size="pill"
                  className="w-full sm:w-auto"
                  onClick={() => openContact("membership_support")}
                >
                  <Icon
                    aria-hidden
                    icon="mdi:message-text-outline"
                    className="size-4"
                  />
                  {tContact("types.membership_support")}
                </Button>
              ) : null}
            </div>
          </div>
          {summary.paymentMethod ? (
            <div className="flex flex-wrap items-center gap-4 border-b border-(--t-border-line) pb-5 text-sm">
              <span className="rounded-lg bg-(--t-bg-inverse) px-3 py-2 text-xs font-bold text-white">
                {summary.paymentMethod.brand.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">
                  {t("cardEnding", {
                    brand: summary.paymentMethod.wallet
                      ? summary.paymentMethod.wallet.replaceAll("_", " ")
                      : summary.paymentMethod.brand,
                    last4: summary.paymentMethod.last4,
                  })}
                </p>
                <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                  {t("expiresCard")}:{" "}
                  {String(summary.paymentMethod.expiryMonth).padStart(2, "0")}/
                  {summary.paymentMethod.expiryYear}
                </p>
              </div>
              <Button
                type="button"
                variant="surface"
                size="pill"
                disabled={busy}
                onClick={manage}
              >
                {t("update")}
              </Button>
            </div>
          ) : null}
          {summary.billingDetails ? (
            <div className="flex flex-wrap items-center gap-4 border-b border-(--t-border-line) pb-5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold">{t("billingDetails")}</p>
                <p
                  className="m-0 text-sm break-words"
                  style={{ color: T.ink.dim }}
                >
                  {[
                    summary.billingDetails.name,
                    summary.billingDetails.email,
                    summary.billingDetails.postalCode,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                variant="surface"
                size="pill"
                disabled={busy}
                onClick={manage}
              >
                {t("edit")}
              </Button>
            </div>
          ) : null}
          {summary.invoices.length ? (
            <div
              className="overflow-x-auto rounded-2xl border border-(--t-border-line) [contain:paint] focus-visible:outline-2"
              role="region"
              aria-label={t("invoices")}
              tabIndex={0}
            >
              <table className="w-full text-left text-sm">
                <caption className="p-4 text-left font-semibold text-(--t-ink-base)">
                  {t("invoices")}
                </caption>
                <thead>
                  <tr className="border-t border-(--t-border-line) bg-(--t-bg-surface) text-xs text-(--t-ink-dim)">
                    <th scope="col" className="px-4 py-3">
                      {t("date")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("description")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("amount")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("status")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("invoice")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-t border-(--t-border-line)"
                    >
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {formatBillingDate(invoice.created * 1000, locale)}
                      </td>
                      <td className="min-w-48 px-4 py-3">
                        <span className="font-semibold">
                          {invoice.description ?? t("membershipInvoice")}
                        </span>
                        <br />
                        <span className="text-sm" style={{ color: T.ink.dim }}>
                          {invoice.number}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {formatBillingMoney(
                          invoice.total,
                          invoice.currency,
                          locale
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t(
                          `invoiceStatuses.${invoiceStatusKey(invoice.status)}`
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {invoice.pdf ? (
                          <a
                            href={invoice.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-(--t-accent-primary) underline underline-offset-4"
                            aria-label={`${t("download")} ${invoice.number ?? t("invoice")}`}
                          >
                            <Icon
                              aria-hidden
                              icon="mdi:download-outline"
                              className="size-4"
                            />
                            PDF
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 border-t border-(--t-border-line) pt-5">
            <p className="m-0 flex items-start gap-2.5 text-sm leading-relaxed text-(--t-ink-dim)">
              <Icon
                aria-hidden
                icon="mdi:lock-outline"
                className="mt-0.5 size-4 shrink-0"
              />
              {t("portalExplanation")}
            </p>
            <GlobalLink
              className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-(--t-accent-primary) underline decoration-transparent underline-offset-4 hover:decoration-current"
              href="/profile/membership#recognition"
            >
              <Icon
                aria-hidden
                icon="mdi:account-heart-outline"
                className="size-4 shrink-0"
              />
              {t("recognitionSettings")}
              <Icon
                aria-hidden
                icon="mdi:arrow-right"
                className="size-4 shrink-0"
              />
            </GlobalLink>
          </div>
        </>
      )}
    </SectionCard>
  )
}
