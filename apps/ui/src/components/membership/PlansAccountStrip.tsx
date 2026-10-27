"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import { STAFF_LINK } from "@/components/staff/StaffPanel"

export function PlansAccountStrip({
  plan,
  source,
}: {
  readonly plan: string
  readonly source?: string | null
}) {
  const t = useTranslations("membershipPage")
  const b = useTranslations("billing")
  const knownPlan =
    plan === "supporter" || plan === "pro" || plan === "team" ? plan : "free"

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Icon
          aria-hidden
          icon="mdi:account-check-outline"
          className="size-5 text-(--t-accent-primary)"
        />
        <span className="text-base">
          {t("currentAccess")}: <strong>{b(`accessPlans.${knownPlan}`)}</strong>
        </span>
        {source === "team" ? (
          <Badge color="aurora" label={t("teamSeat")} />
        ) : null}
      </div>
      <GlobalLink
        href="/profile/membership"
        className={`${STAFF_LINK} inline-flex min-h-11 items-center gap-2 text-sm`}
      >
        {t("manageMembership")}
        <Icon aria-hidden icon="mdi:arrow-right" className="size-4" />
      </GlobalLink>
    </div>
  )
}
