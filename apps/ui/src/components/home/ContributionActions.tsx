"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { useHydratedSession } from "@/lib/access-client"
import { analyticsAttributes } from "@/lib/analytics-events"

/** Guest acquisition stays client-side so public drive content remains shared. */
export function ContributionActions({
  memberLabel,
  memberHref,
  secondaryAction,
}: {
  readonly memberLabel?: string | null
  readonly memberHref?: string | null
  readonly secondaryAction: ReactNode
}) {
  const { data } = useHydratedSession()
  const t = useTranslations("homepageContribute")
  const signedIn = !!data?.user

  return (
    <div className="home-contribution-actions">
      <div className="home-inline-links">
        <GlobalLink
          href={signedIn ? (memberHref ?? "/contribute") : "/auth/register"}
          {...analyticsAttributes("navigation_action", {
            interaction_source: "home",
            action_type: "open",
            destination: "contribute",
          })}
          className="home-button home-button-primary"
        >
          {signedIn ? (memberLabel ?? t("start")) : t("register")}
        </GlobalLink>
        {secondaryAction}
      </div>
      <div className="home-contribution-account-note">
        <p>{signedIn ? t("memberNote") : t("guestNote")}</p>
        {!signedIn ? (
          <GlobalLink
            href="/auth/signin?callbackUrl=%2Fcontribute"
            className="home-text-link home-contribution-signin"
          >
            {t("signIn")}
          </GlobalLink>
        ) : null}
      </div>
    </div>
  )
}
