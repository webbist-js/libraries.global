"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { SupporterPreferences } from "@/components/community/SupporterPreferences"
import { Badge } from "@/components/ds/Badge"
import { SidebarLinks } from "@/components/ds/SidebarLinks"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { buttonVariants } from "@/components/ui/button"
import type {
  SessionApiAccount,
  SessionTeam,
  StaffLibrarySummary,
} from "@/lib/access-server"
import { CONTACT_EMAIL } from "@/lib/constants"
import { useMembershipContent, useOfferValues } from "@/lib/localized-plans"
import { RECOGNITION, standingName, standingProgress } from "@/lib/plans"

export type MembershipDashboardProps = {
  /** The parent workspace provides the page gutters and section spacing. */
  readonly embedded?: boolean
  readonly acceptedContributions: number
  /** A moderator revoked recognition; the count no longer applies. */
  readonly recognitionRevoked?: boolean
  readonly recentlyActive: boolean
  readonly staffLibraries: StaffLibrarySummary[]
  readonly teams: SessionTeam[]
  readonly apiAccounts: SessionApiAccount[]
  readonly recognition: {
    listed: boolean
    badgeVisible: boolean
    visibility: string
  } | null
}

/**
 * Three separate things, never merged into a "plan": earned standing from
 * accepted contributions, verified staff authority from staff claims, and API
 * accounts (managed on /developers). Nothing here can be bought.
 */
export function MembershipDashboard({
  embedded = false,
  acceptedContributions,
  recognitionRevoked = false,
  recentlyActive,
  staffLibraries,
  teams,
  apiAccounts,
  recognition,
}: MembershipDashboardProps) {
  return (
    <Container
      hideDefaultPadding={embedded}
      className={embedded ? "max-w-none" : "py-8 sm:py-10 lg:pb-16"}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <StandingPanel
            acceptedContributions={acceptedContributions}
            recognitionRevoked={recognitionRevoked}
            recentlyActive={recentlyActive}
            recognition={recognition}
          />
          <StaffAuthorityPanel libraries={staffLibraries} teams={teams} />
          <ApiAccountsPanel accounts={apiAccounts} teams={teams} />
        </div>
        <MembershipSidebar />
      </div>
    </Container>
  )
}

export function StandingPanel({
  acceptedContributions,
  recognitionRevoked = false,
  recentlyActive,
  recognition,
}: Pick<
  MembershipDashboardProps,
  | "acceptedContributions"
  | "recognitionRevoked"
  | "recentlyActive"
  | "recognition"
>) {
  const t = useTranslations("membershipPage")
  const m = useMembershipContent()
  const values = useOfferValues()
  const progress = standingProgress({
    signedIn: true,
    acceptedContributions,
    recognitionRevoked,
  })
  const name = standingName(progress.standing)
  const supporter = progress.standing === "supporter"

  return (
    <StaffPanel
      id="standing"
      title={t("standingTitle")}
      aside={
        <Badge
          color={recentlyActive ? "ok" : "dim"}
          label={t(recentlyActive ? "recentlyActive" : "notRecentlyActive")}
        />
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="type-stat m-0">{m(`standing.${name}`)}</p>
        <p className="m-0 text-base text-(--t-ink-dim)">
          {t("acceptedCount", { count: progress.accepted })}
        </p>
      </div>
      <p className="mt-3 mb-0 max-w-[62ch] text-base leading-relaxed text-(--t-ink-dim)">
        {t(`standingBody.${name}`, values)}
      </p>

      <div className="mt-5">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span id="supporter-progress-label" className="font-semibold">
            {t("progressLabel", values)}
          </span>
          <span className="text-(--t-ink-dim) tabular-nums">
            {t("progressValue", {
              count: Math.min(progress.accepted, RECOGNITION.supporterAt),
              total: RECOGNITION.supporterAt,
            })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby="supporter-progress-label"
          aria-valuemin={0}
          aria-valuemax={RECOGNITION.supporterAt}
          aria-valuenow={Math.min(progress.accepted, RECOGNITION.supporterAt)}
          className="mt-2 h-2.5 rounded-full bg-(--t-bg-muted)"
        >
          <div
            className="h-full rounded-full bg-(--t-accent-primary)"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 mb-0 text-sm text-(--t-ink-dim)">
          {progress.next
            ? t(`nextMilestone.${progress.next.standing}`, {
                count: progress.remaining,
              })
            : t("milestoneReached")}
        </p>
      </div>

      <p className="mt-4 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("activityNote", values)}
      </p>

      {supporter ? (
        <div className="mt-6 border-t border-(--t-border-line) pt-5">
          <h3 className="type-card-title m-0">{t("recognition")}</h3>
          <p className="mt-2 mb-4 text-sm leading-relaxed text-(--t-ink-dim)">
            {t("recognitionLead")}
          </p>
          {recognition ? (
            <SupporterPreferences {...recognition} />
          ) : (
            <p role="status" className="m-0 text-sm text-(--t-ink-dim)">
              {t("recognitionUnavailable")}
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <GlobalLink
          href="/contribute"
          className={buttonVariants({ variant: "primary", size: "pill" })}
        >
          <Icon aria-hidden icon="mdi:pencil-outline" />
          {t("startContributing")}
        </GlobalLink>
        <GlobalLink
          href="/contribute/submissions"
          className={buttonVariants({ variant: "surface", size: "pill" })}
        >
          {t("yourContributions")}
        </GlobalLink>
      </div>
      <p className="mt-4 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("standingIndependence")}
      </p>
    </StaffPanel>
  )
}

export function StaffAuthorityPanel({
  libraries,
  teams,
}: {
  readonly libraries: StaffLibrarySummary[]
  readonly teams: SessionTeam[]
}) {
  const t = useTranslations("membershipPage")

  return (
    <StaffPanel
      id="staff-authority"
      title={t("staffTitle")}
      aside={
        <Badge
          color={libraries.length ? "aurora" : "dim"}
          label={
            libraries.length
              ? t("approvedLibraries", { count: libraries.length })
              : t("noStaffAccess")
          }
        />
      }
    >
      <p className="-mt-1 mb-5 max-w-[62ch] text-base leading-relaxed text-(--t-ink-dim)">
        {t(libraries.length ? "staffLead" : "claimExplanation")}
      </p>
      {libraries.length ? (
        <ul className="m-0 mb-5 flex list-none flex-col gap-2 p-0">
          {libraries.map((library) => (
            <li
              key={library.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) px-4 py-3"
            >
              <GlobalLink
                href={`/staff/${library.slug}`}
                className={`${STAFF_LINK} min-w-0 [overflow-wrap:anywhere]`}
              >
                {library.name}
              </GlobalLink>
              <span className="text-sm text-(--t-ink-dim)">
                {t(`staffRoles.${library.role}`)}
                {library.canGoLive ? ` · ${t("canGoLive")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {teams.length ? (
        <div className="mb-5">
          <h3 className="type-small-heading m-0 mb-2">{t("organisations")}</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
            {teams.map((team) => (
              <li key={team.id} className="[overflow-wrap:anywhere]">
                <strong>{team.name}</strong>{" "}
                <span className="text-(--t-ink-dim)">
                  ·{" "}
                  {t(
                    team.role === "organiser"
                      ? "organisationOrganiser"
                      : "organisationMember"
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {t("organisationNote")}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <GlobalLink
          href={libraries.length ? "/staff" : "/contribute/claim"}
          className={buttonVariants({ variant: "surface", size: "pill" })}
        >
          {t(libraries.length ? "manageLibraries" : "claimLibrary")}
        </GlobalLink>
        {teams.length ? (
          <GlobalLink
            href="/staff/teams"
            className={buttonVariants({ variant: "surface", size: "pill" })}
          >
            {t("openOrganisation")}
          </GlobalLink>
        ) : null}
      </div>
    </StaffPanel>
  )
}

export function ApiAccountsPanel({
  accounts,
  teams,
}: {
  readonly accounts: SessionApiAccount[]
  readonly teams: SessionTeam[]
}) {
  const t = useTranslations("membershipPage")
  const values = useOfferValues()
  const nameOf = (teamId: string) =>
    teams.find((team) => team.id === teamId)?.name ?? t("organisationUnnamed")

  return (
    <StaffPanel id="api-accounts" title={t("apiTitle")}>
      <p className="-mt-1 mb-5 max-w-[62ch] text-base leading-relaxed text-(--t-ink-dim)">
        {t(accounts.length ? "apiLead" : "apiNone", values)}
      </p>
      {accounts.length ? (
        <ul className="m-0 mb-5 flex list-none flex-col gap-2 p-0">
          {accounts.map((account) => (
            <li
              key={account.teamId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) px-4 py-3"
            >
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                {nameOf(account.teamId)}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-(--t-ink-dim)">
                {t(
                  account.role === "organiser"
                    ? "organisationOrganiser"
                    : "organisationMember"
                )}
                <Badge
                  color={account.active ? "ok" : "dim"}
                  label={t(account.active ? "apiActive" : "apiInactive")}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <GlobalLink
        href="/developers"
        className={buttonVariants({ variant: "surface", size: "pill" })}
      >
        <Icon aria-hidden icon="mdi:code-braces" />
        {t("openDevelopers")}
      </GlobalLink>
      <p className="mt-4 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("apiIndependence")}
      </p>
    </StaffPanel>
  )
}

function MembershipSidebar() {
  const t = useTranslations("membershipPage")

  return (
    <aside
      aria-label={t("helpAndAccess")}
      className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-(--sticky-content-top)"
    >
      <StaffPanel compact id="membership-plans" title={t("waysToTakePart")}>
        <p className="m-0 mb-4 text-base leading-relaxed text-(--t-ink-dim)">
          {t("waysLead")}
        </p>
        <SidebarLinks>
          <li>
            <GlobalLink href="/plans">{t("comparePlans")}</GlobalLink>
          </li>
          <li>
            <GlobalLink href="/sponsor">{t("sponsorLink")}</GlobalLink>
          </li>
        </SidebarLinks>
      </StaffPanel>
      <StaffPanel compact id="membership-help" title={t("termsAndHelp")}>
        <SidebarLinks>
          <li>
            <GlobalLink href="/legal/membership">{t("terms")}</GlobalLink>
          </li>
          <li>
            <GlobalLink href="/legal/cancellation-refunds">
              {t("cancellationAndRefunds")}
            </GlobalLink>
          </li>
          <li>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=Account%20question`}
              data-contact-type="membership_support"
            >
              {t("askQuestion")}
            </a>
          </li>
        </SidebarLinks>
      </StaffPanel>
    </aside>
  )
}
