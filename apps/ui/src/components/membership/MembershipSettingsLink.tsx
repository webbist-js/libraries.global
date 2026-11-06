"use client"

import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { PlansAccountStrip } from "@/components/membership/PlansAccountStrip"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { useHydratedSession } from "@/lib/access-client"

/** Settings' pointer to the profile's standing, staff and API sections. */
export function MembershipSettingsLink() {
  const t = useTranslations("membershipPage")
  const user = useHydratedSession().data?.user

  return (
    <StaffPanel id="membership" title={t("title")}>
      <p className="-mt-1 mb-5 text-base leading-relaxed text-(--t-ink-dim)">
        {t("settingsLead")}
      </p>
      {user ? (
        <PlansAccountStrip
          standing={String(user.standing ?? "explorer")}
          acceptedContributions={
            Number.isSafeInteger(user.acceptedContributions)
              ? Number(user.acceptedContributions)
              : 0
          }
          recentlyActive={user.recentlyActive === true}
        />
      ) : null}
      <GlobalLink
        href="/plans"
        className={`${STAFF_LINK} mt-4 inline-flex min-h-11 items-center text-sm`}
      >
        {t("plansLink")}
      </GlobalLink>
    </StaffPanel>
  )
}
