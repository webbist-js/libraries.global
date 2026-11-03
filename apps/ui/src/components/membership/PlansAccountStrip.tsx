"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { buttonVariants } from "@/components/ui/button"
import type { SessionTeam } from "@/lib/access-server"

export function PlansAccountStrip({
  plan,
  source,
  team,
}: {
  readonly plan: string
  readonly source?: string | null
  /** The account's preferred Team, when it has one. */
  readonly team?: SessionTeam | null
}) {
  const t = useTranslations("membershipPage")
  const b = useTranslations("billing")
  const knownPlan =
    plan === "supporter" || plan === "pro" || plan === "team" ? plan : "free"

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <Icon
            aria-hidden
            icon={
              team ? "mdi:account-group-outline" : "mdi:account-check-outline"
            }
            className="size-5 text-(--t-accent-primary)"
          />
          <span className="text-base">
            {team ? (
              <strong>{t("inTeamTitle")}</strong>
            ) : (
              <>
                {t("currentAccess")}:{" "}
                <strong>{b(`accessPlans.${knownPlan}`)}</strong>
              </>
            )}
          </span>
          {source === "team" ? (
            <Badge color="aurora" label={t("teamSeat")} />
          ) : null}
        </div>
        {team ? (
          <p className="m-0 text-sm [overflow-wrap:anywhere] text-(--t-ink-dim)">
            {t(team.role === "organiser" ? "inTeamOrganiser" : "inTeamMember", {
              team: team.name,
            })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {team ? (
          <GlobalLink
            href="/staff/teams"
            className={buttonVariants({ variant: "primary", size: "pill" })}
          >
            {t("manageTeam")}
          </GlobalLink>
        ) : null}
        <GlobalLink
          href="/profile/membership"
          className={`${STAFF_LINK} inline-flex min-h-11 items-center gap-2 text-sm`}
        >
          {t("manageMembership")}
          <Icon aria-hidden icon="mdi:arrow-right" className="size-4" />
        </GlobalLink>
      </div>
    </div>
  )
}
