"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { ApiCheckoutReview } from "@/components/staff/ApiCheckoutReview"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { captureCheckoutAttempt } from "@/lib/checkout-analytics"
import { redirectForReauthentication } from "@/lib/fresh-auth"
import { Link } from "@/lib/navigation"
import type { ApiProspect } from "@/lib/team-api/types"

/**
 * API checkout for an account without an organisation. The server creates a
 * free single-member organisation with this account as its organiser, then
 * opens the organisation-owned checkout.
 */
export function ApiIndividualCheckout({
  prospect,
  accountName,
}: {
  readonly prospect: ApiProspect
  readonly accountName: string
}) {
  const locale = useLocale()
  const t = useTranslations("apiIndividualCheckout")
  const tErrors = useTranslations("teamApiErrors")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  if (!prospect.verified)
    return (
      <StaffPanel title={t("verifyTitle")} compact>
        <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
          {t("verifyBody")}{" "}
          <Link
            href="/profile/settings"
            className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
          >
            {t("openSettings")}
          </Link>
        </p>
      </StaffPanel>
    )

  const subscribe = (termsVersion: string) =>
    startTransition(async () => {
      const body = { locale, termsVersion }
      const { handoff, failed } = captureCheckoutAttempt(
        { action: "checkout" },
        { product: "team_api", billing_interval: "month" }
      )
      setError("")
      try {
        const response = await fetch("/api/billing/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const result = (await response.json()) as {
          error?: string
          reauthUrl?: string
          url?: string
        }
        if (!response.ok && redirectForReauthentication(result)) return
        if (!response.ok || !result.url)
          throw new Error(
            result.error && tErrors.has(result.error as never)
              ? tErrors(result.error as never)
              : t("openFailed")
          )
        handoff()
        window.location.assign(result.url)
      } catch (failure) {
        failed()
        setError(failure instanceof Error ? failure.message : t("retry"))
      }
    })

  return (
    <StaffPanel title={t("title")} id="api-checkout">
      <p className="mt-0 mb-5 max-w-[70ch] text-base leading-relaxed text-(--t-ink-dim)">
        {t("lead")}
      </p>
      <ApiCheckoutReview
        price={prospect.price}
        purchasing={prospect.purchasing}
        limits={prospect.limits}
        rates={prospect.rates}
        locale={locale}
        pending={pending}
        error={error}
        owner={accountName}
        onSubscribe={subscribe}
      />
    </StaffPanel>
  )
}
