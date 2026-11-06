"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { useMembershipContent } from "@/lib/localized-plans"
import { standingName } from "@/lib/plans"

/**
 * The signed-in viewer's earned standing in one line, with a link to the
 * profile's standing, staff and API sections. Display only.
 */
export function PlansAccountStrip({
  standing,
  acceptedContributions,
  recentlyActive = false,
}: {
  readonly standing: string
  readonly acceptedContributions: number
  readonly recentlyActive?: boolean
}) {
  const t = useTranslations("membershipPage")
  const m = useMembershipContent()

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Icon
          aria-hidden
          icon="mdi:account-check-outline"
          className="size-5 text-(--t-accent-primary)"
        />
        <span className="text-base">
          {t("yourStanding")}:{" "}
          <strong>{m(`standing.${standingName(standing)}`)}</strong>
        </span>
        <span className="text-sm text-(--t-ink-dim)">
          {t("acceptedCount", { count: acceptedContributions })}
        </span>
        {recentlyActive ? (
          <Badge color="ok" label={t("recentlyActive")} />
        ) : null}
      </div>
      <GlobalLink
        href="/profile/membership"
        className={`${STAFF_LINK} inline-flex min-h-11 items-center gap-2 text-sm`}
      >
        {t("viewStanding")}
        <Icon aria-hidden icon="mdi:arrow-right" className="size-4" />
      </GlobalLink>
    </div>
  )
}
