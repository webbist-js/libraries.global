"use client"

import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { PlansAccountStrip } from "@/components/membership/PlansAccountStrip"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"

export function MembershipSettingsLink({
  plan,
  source,
}: {
  readonly plan: string
  readonly source?: string | null
}) {
  const t = useTranslations("membershipPage")

  return (
    <StaffPanel id="membership" title={t("title")}>
      <p className="-mt-1 mb-5 text-base leading-relaxed text-(--t-ink-dim)">
        {t("settingsLead")}
      </p>
      <PlansAccountStrip plan={plan} source={source} />
      <GlobalLink
        href="/plans"
        className={`${STAFF_LINK} mt-4 inline-flex min-h-11 items-center text-sm`}
      >
        {t("plansLink")}
      </GlobalLink>
    </StaffPanel>
  )
}
