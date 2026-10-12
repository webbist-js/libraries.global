"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { PlanChangeDialog } from "@/components/billing/PlanChangeDialog"
import {
  formatBillingMoney,
  formatBillingDate,
  type BillingSummary,
  membershipStatusKey,
  invoiceStatusKey,
} from "@/components/billing/types"
import { useMembershipRefresh } from "@/components/billing/useMembershipRefresh"
import GlobalLink from "@/components/global/GlobalLink"
import { SectionCard } from "@/components/profile-form/FormParts"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"

export function MembershipBillingSection() {
  const t = useTranslations("billing")
  const locale = useLocale()
  const refreshMembership = useMembershipRefresh()
  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let refreshed = false
    const load = async () => {
      try {
        const res = await fetch("/api/billing/summary", {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
          cache: "no-store",
        })
        if (!res.ok) throw new Error("billing")
        const data = (await res.json()) as BillingSummary
        if (controller.signal.aborted) return
        if (data.membership && !data.confirmationPending && !refreshed) {
          refreshed = true
          await refreshMembership()
          if (!controller.signal.aborted) await load()

          return
        }
        setSummary(data)
        setError(false)
        if (data.confirmationPending) timer = setTimeout(load, 5000)
      } catch {
        if (!controller.signal.aborted) {
          setError(true)
          timer = setTimeout(load, 10_000)
        }
      }
    }
    load()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [reload, refreshMembership])
  const manage = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      if (!res.ok) throw new Error("portal")
      const result = (await res.json()) as { url: string }
      const url = new URL(result.url)
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
        throw new Error("portal url")
      window.location.assign(result.url)
    } catch {
      setError(true)
      setBusy(false)
    }
  }
  const membership = summary?.membership
  const membershipStatus = membership ? membershipStatusKey(membership) : null
  const undo = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/billing/undo-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error("undo")
      setReload((n) => n + 1)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard
      id="membership"
      title={t("settingsTitle")}
      lead={t("settingsLead")}
    >
      {error ? (
        <div role="alert">
          <p>{t("error")}</p>
          <Button
            type="button"
            variant="link"
            className="min-h-11 px-0 text-(--t-accent-primary)"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("retry")}
          </Button>
        </div>
      ) : !summary ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <>
          <div
            className="space-y-4 rounded-2xl border p-5"
            style={{ borderColor: T.border.line }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="m-0 text-3xl" style={{ fontFamily: T.font.serif }}>
                {membership
                  ? t(membership.plan)
                  : summary.confirmationPending
                    ? t("confirming")
                    : t("noMembership")}
              </h3>
              {membership ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background:
                      membership.revoked ||
                      membership.graceExpired ||
                      membership.status === "past_due"
                        ? "#fff1e9"
                        : "#e6f0e7",
                    color:
                      membership.revoked ||
                      membership.graceExpired ||
                      membership.status === "past_due"
                        ? "#8c371f"
                        : T.accent.ok,
                  }}
                >
                  {summary.confirmationPending
                    ? t("membershipConfirming")
                    : membershipStatus
                      ? t(membershipStatus)
                      : null}
                </span>
              ) : null}
              {summary.foundingPrice ? (
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                  {t("foundingPrice")}
                </span>
              ) : null}
              {summary.canManage &&
              summary.available &&
              membershipStatus === "active" &&
              membership &&
              !membership.cancelAtPeriodEnd &&
              !summary.scheduledChange &&
              !summary.paymentAttention &&
              !membership.revoked &&
              !membership.graceExpired ? (
                <PlanChangeDialog
                  plan={membership.plan}
                  interval={membership.interval}
                  onComplete={() => setReload((n) => n + 1)}
                  complimentaryPro={
                    ["pro", "team"].includes(summary.effectivePlan) &&
                    summary.accessSource !== "paid"
                  }
                />
              ) : null}
            </div>
            {membership ? (
              <>
                <p>
                  {formatBillingMoney(
                    membership.unitAmount,
                    membership.currency,
                    locale
                  )}{" "}
                  / {t(membership.interval)}
                </p>
                <p>
                  {membership.cancelAtPeriodEnd ? t("ends") : t("periodEnd")}:{" "}
                  {membership.periodEnd
                    ? formatBillingDate(membership.periodEnd, locale)
                    : "—"}
                </p>
                <p className="text-sm">{t("taxAndCurrency")}</p>
                {summary.scheduledChange ? (
                  <div
                    role="status"
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <p>
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
                      onClick={summary.scheduledChange.canUndo ? undo : manage}
                      disabled={busy}
                    >
                      {summary.scheduledChange.canUndo
                        ? t("undoScheduledChange")
                        : t("reviewScheduledChange")}
                    </Button>
                  </div>
                ) : null}
                <p className="text-sm">
                  {t("memberSince")}:{" "}
                  {formatBillingDate(membership.memberSince, locale)}
                </p>
                {membership.status === "past_due" ||
                membership.status === "unpaid" ||
                summary.paymentAttention ? (
                  <div
                    role="status"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
                  >
                    <p className="font-semibold">{t("paymentAttention")}</p>
                    <p>{t("paymentAttentionBody")}</p>
                    {summary.nextAttempt ? (
                      <p>
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
              <p>
                {summary.confirmationPending ? t("pending") : t("freeRemains")}
              </p>
            )}
            {summary.confirmationPending && membership ? (
              <p role="status">{t("pending")}</p>
            ) : null}
            {(!summary.confirmationPending || membership) && (
              <p>
                {t("effectiveAccess")}:{" "}
                {t(`accessPlans.${summary.effectivePlan}`)} ·{" "}
                {t(`accessSources.${summary.accessSource}`)}
              </p>
            )}
            {summary.canManage ? (
              <Button
                type="button"
                variant="surface"
                size="pill"
                onClick={manage}
                disabled={busy}
              >
                {busy ? t("opening") : t("manage")}
              </Button>
            ) : (
              <GlobalLink className="underline" href="/contribute/membership">
                {t("viewPlans")}
              </GlobalLink>
            )}
          </div>
          {summary.paymentMethod ? (
            <div className="flex flex-wrap items-center gap-4 border-b py-5">
              <span className="rounded-lg bg-(--t-ink-base) px-3 py-2 text-xs font-bold text-white">
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
            <div className="flex flex-wrap items-center gap-4 border-b py-5">
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
          <p>{t("portalExplanation")}</p>
          {summary.invoices.length ? (
            <div
              className="overflow-x-auto [contain:paint] focus-visible:outline-2"
              role="region"
              aria-label={t("invoices")}
              tabIndex={0}
            >
              <table className="w-full text-left">
                <caption className="mb-3 text-left font-semibold">
                  {t("invoices")}
                </caption>
                <thead>
                  <tr>
                    <th className="p-2">{t("date")}</th>
                    <th className="p-2">{t("description")}</th>
                    <th className="p-2">{t("amount")}</th>
                    <th className="p-2">{t("status")}</th>
                    <th className="p-2">{t("invoice")}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">
                        {formatBillingDate(invoice.created * 1000, locale)}
                      </td>
                      <td className="min-w-48 p-2">
                        <span className="font-semibold">
                          {invoice.description ?? t("membershipInvoice")}
                        </span>
                        <br />
                        <span className="text-sm" style={{ color: T.ink.dim }}>
                          {invoice.number}
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {formatBillingMoney(
                          invoice.total,
                          invoice.currency,
                          locale
                        )}
                      </td>
                      <td className="p-2">
                        {t(
                          `invoiceStatuses.${invoiceStatusKey(invoice.status)}`
                        )}
                      </td>
                      <td className="p-2">
                        {invoice.pdf ? (
                          <a
                            href={invoice.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center underline"
                            aria-label={`${t("download")} ${invoice.number ?? t("invoice")}`}
                          >
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
          <GlobalLink className="underline" href="/profile/settings#privacy">
            {t("recognitionSettings")}
          </GlobalLink>
        </>
      )}
    </SectionCard>
  )
}
