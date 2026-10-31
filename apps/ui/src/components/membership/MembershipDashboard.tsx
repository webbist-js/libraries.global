"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"

import {
  type BillingSummary,
  formatBillingDate,
  membershipStatusKey,
} from "@/components/billing/types"
import { SupporterPreferences } from "@/components/community/SupporterPreferences"
import { Badge } from "@/components/ds/Badge"
import { SidebarLinks } from "@/components/ds/SidebarLinks"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { PersonalBillingPanel } from "@/components/membership/PersonalBillingPanel"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button, buttonVariants } from "@/components/ui/button"
import type { SessionTeam } from "@/lib/access-server"
import { CONTACT_EMAIL } from "@/lib/constants"
import { featuresOf, PRO_FEATURE_COPY } from "@/lib/plans"

import {
  type MembershipBillingController,
  useMembershipBilling,
} from "./useMembershipBilling"

const FEATURE_DESTINATIONS = {
  "atlas.export": {
    icon: "mdi:download-outline",
    href: "/map",
    copy: "atlas_export",
  },
  "atlas.contextLayers": {
    icon: "mdi:layers-outline",
    href: "/map",
    copy: "atlas_contextLayers",
  },
  "atlas.analysis": {
    icon: "mdi:map-marker-radius-outline",
    href: "/map",
    copy: "atlas_analysis",
  },
  "atlas.compare": {
    icon: "mdi:compare-horizontal",
    href: "/map",
    copy: "atlas_compare",
  },
  "library.history": {
    icon: "mdi:history",
    href: "/libraries",
    copy: "library_history",
  },
} as const

export type MembershipDashboardProps = {
  /** The parent workspace provides the page gutters and section spacing. */
  readonly embedded?: boolean
  readonly plan: string
  readonly source: string
  readonly teams: SessionTeam[]
  readonly asOf: number
  readonly staffCount: number
  readonly recognition: {
    listed: boolean
    badgeVisible: boolean
    visibility: string
  } | null
}

export function MembershipDashboard({
  embedded = false,
  plan,
  source,
  teams,
  staffCount,
  recognition,
  asOf,
}: MembershipDashboardProps) {
  const copy = useMembershipCopy()
  const { t, b } = copy
  const billing = useMembershipBilling()
  const { summary, error } = billing
  const effective = summary?.effectivePlan ?? plan
  const current =
    effective === "supporter" || effective === "pro" || effective === "team"
      ? effective
      : "free"
  const accessSource = summary?.accessSource ?? source
  const hasTools = current !== "free"
  const activeTeam = teams.find(
    (entry) =>
      entry.status === "active" &&
      (!entry.expiresAt || Date.parse(entry.expiresAt) > asOf)
  )
  const team = activeTeam ?? teams[0]
  const membership = summary?.membership
  const status = membership ? membershipStatusKey(membership) : null
  const sourceKey =
    accessSource === "grant" ||
    accessSource === "earned" ||
    accessSource === "verified" ||
    accessSource === "team" ||
    accessSource === "paid"
      ? accessSource
      : "none"
  const sourceLabel =
    sourceKey === "none" ? t("freeAccount") : b(`accessSources.${sourceKey}`)
  const personalBilling =
    !summary ||
    error ||
    membership ||
    summary.confirmationPending ||
    summary.invoices.length > 0

  const view: MembershipView = {
    current,
    sourceKey,
    sourceLabel,
    hasTools,
    team,
    activeTeam,
    membership,
    status,
  }

  return (
    <Container
      hideDefaultPadding={embedded}
      className={embedded ? "max-w-none" : "py-8 sm:py-10 lg:pb-16"}
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <CurrentPlanPanel view={view} copy={copy} staffCount={staffCount} />

          <IncludedToolsPanel view={view} copy={copy} />

          <RecognitionPanel view={view} copy={copy} recognition={recognition} />

          {team ? (
            <TeamMembershipPanel
              team={team}
              active={Boolean(activeTeam)}
              copy={copy}
            />
          ) : null}
          {personalBilling ? (
            <PersonalBillingPanel billing={billing} billingOnly />
          ) : !team ? (
            <StaffPanel id="billing" title={t("billing")}>
              <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
                {t(hasTools ? "complimentaryBilling" : "freeBilling")}
              </p>
              <GlobalLink
                className={`${STAFF_LINK} mt-4 inline-flex min-h-11 items-center`}
                href="/plans"
              >
                {t("comparePlans")}
              </GlobalLink>
            </StaffPanel>
          ) : null}
        </div>

        <MembershipSidebar
          current={current}
          staffCount={staffCount}
          copy={copy}
          billing={billing}
        />
      </div>
    </Container>
  )
}

function Benefit({
  icon,
  title,
  href,
  action,
  description,
}: {
  readonly icon: string
  readonly title: string
  readonly href: string
  readonly action: string
  readonly description?: string
}) {
  return (
    <div className="flex min-w-0 flex-col items-start rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5">
      <span
        aria-hidden
        className="mb-4 flex size-10 items-center justify-center rounded-xl bg-(--t-accent-chip) text-(--t-accent-primary)"
      >
        <Icon icon={icon} className="size-5" />
      </span>
      <h3 className="type-card-title m-0">{title}</h3>
      {description ? (
        <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
          {description}
        </p>
      ) : null}
      <GlobalLink
        aria-label={`${action}: ${title}`}
        href={href}
        className={`${STAFF_LINK} mt-auto inline-flex min-h-11 items-center gap-1.5 pt-3 text-sm`}
      >
        {action}
        <Icon aria-hidden icon="mdi:arrow-right" className="size-4" />
      </GlobalLink>
    </div>
  )
}

function useMembershipCopy() {
  return {
    t: useTranslations("membershipPage"),
    b: useTranslations("billing"),
    tStatus: useTranslations("membershipStatus"),
    locale: useLocale(),
  }
}
type MembershipCopy = ReturnType<typeof useMembershipCopy>
type MembershipView = {
  current: "free" | "supporter" | "pro" | "team"
  sourceKey: "none" | "grant" | "earned" | "verified" | "team" | "paid"
  sourceLabel: string
  hasTools: boolean
  team: SessionTeam | undefined
  activeTeam: SessionTeam | undefined
  membership: BillingSummary["membership"] | undefined
  status: ReturnType<typeof membershipStatusKey> | null
}
function accessDescription(view: MembershipView, copy: MembershipCopy) {
  if (view.sourceKey === "team")
    return copy.t("teamAccess", { name: view.team?.name ?? copy.t("yourTeam") })
  if (view.sourceKey === "none") return copy.t("freeAccess")

  return copy.tStatus(`${view.sourceKey}Detail`)
}

function CurrentPlanPanel({
  view,
  copy,
  staffCount,
}: {
  view: MembershipView
  copy: MembershipCopy
  staffCount: number
}) {
  const { t, b, locale } = copy
  const {
    current,
    sourceKey,
    sourceLabel,
    hasTools,
    team,
    membership,
    status,
  } = view

  return (
    <StaffPanel
      id="current-plan"
      title={t("currentPlan")}
      aside={<Badge label={sourceLabel} color={hasTools ? "aurora" : "dim"} />}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="type-stat m-0">{b(`accessPlans.${current}`)}</p>
        <Badge
          color={hasTools ? "ok" : "dim"}
          label={hasTools ? t("activeAccess") : t("freeAccount")}
        />
      </div>
      <p className="mt-4 mb-0 max-w-[62ch] text-base leading-relaxed text-(--t-ink-dim)">
        {accessDescription(view, copy)}
      </p>
      <dl className="mt-6 mb-0 grid gap-5 border-y border-(--t-border-line) py-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-(--t-ink-dim)">{t("accessFrom")}</dt>
          <dd className="m-0 mt-1 font-semibold">
            {sourceKey === "team" && team ? team.name : sourceLabel}
          </dd>
        </div>
        <div>
          <dt className="text-(--t-ink-dim)">{t("libraryPermissions")}</dt>
          <dd className="m-0 mt-1 font-semibold">
            {staffCount
              ? t("approvedLibraries", { count: staffCount })
              : t("noStaffAccess")}
          </dd>
        </div>
        {membership?.paidThrough ? (
          <div>
            <dt className="text-(--t-ink-dim)">{t("paidThrough")}</dt>
            <dd className="m-0 mt-1 font-semibold">
              {formatBillingDate(membership.paidThrough, locale)}
            </dd>
          </div>
        ) : null}
        {status && sourceKey === "paid" ? (
          <div>
            <dt className="text-(--t-ink-dim)">{t("subscription")}</dt>
            <dd className="m-0 mt-1 font-semibold">{b(status)}</dd>
          </div>
        ) : null}
      </dl>
      <CurrentPlanActions hasTools={hasTools} copy={copy} />
    </StaffPanel>
  )
}
function CurrentPlanActions({
  hasTools,
  copy,
}: {
  hasTools: boolean
  copy: MembershipCopy
}) {
  const { t } = copy

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <GlobalLink
        href={hasTools ? "/map" : "/plans"}
        className={buttonVariants({ variant: "primary", size: "pill" })}
      >
        <Icon
          aria-hidden
          icon={hasTools ? "mdi:map-outline" : "mdi:sparkles"}
        />
        {hasTools ? t("openAtlas") : t("explorePlans")}
      </GlobalLink>
      <GlobalLink
        href={hasTools ? "/plans" : "/contribute"}
        className={buttonVariants({ variant: "surface", size: "pill" })}
      >
        {hasTools ? t("comparePlans") : t("startContributing")}
      </GlobalLink>
    </div>
  )
}
function IncludedToolsPanel({
  view,
  copy,
}: {
  view: MembershipView
  copy: MembershipCopy
}) {
  const { t } = copy
  const { current, hasTools, activeTeam } = view

  return (
    <StaffPanel
      id="included"
      title={t("included")}
      aside={
        <span className="text-sm text-(--t-ink-dim)">{t("availableNow")}</span>
      }
    >
      <p className="-mt-1 mb-5 text-base leading-relaxed text-(--t-ink-dim)">
        {hasTools ? t("toolsLead") : t("freeToolsLead")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {current !== "free" ? (
          featuresOf(current)
            .filter(
              (feature): feature is keyof typeof FEATURE_DESTINATIONS =>
                Object.hasOwn(FEATURE_DESTINATIONS, feature) &&
                PRO_FEATURE_COPY[feature].status === "live"
            )
            .map((feature) => {
              const target = FEATURE_DESTINATIONS[feature]!

              return (
                <Benefit
                  key={feature}
                  icon={target.icon}
                  title={t(`features.${target.copy}`)}
                  href={target.href}
                  action={t("openTool")}
                />
              )
            })
        ) : (
          <>
            <Benefit
              icon="mdi:map-search-outline"
              title={t("findLibraries")}
              href="/libraries"
              action={t("browseLibraries")}
            />
            <Benefit
              icon="mdi:pencil-outline"
              title={t("contributeRecords")}
              href="/contribute"
              action={t("startContributing")}
            />
          </>
        )}
        {activeTeam ? (
          <Benefit
            icon="mdi:widgets-outline"
            title={t("teamTools")}
            description={t("teamToolsDescription")}
            href="/staff/teams/widgets"
            action={t("openTeam")}
          />
        ) : null}
      </div>
      <p className="mt-5 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("apiSeparate")}
      </p>
    </StaffPanel>
  )
}
function RecognitionPanel({
  view,
  copy,
  recognition,
}: {
  view: MembershipView
  copy: MembershipCopy
  recognition: MembershipDashboardProps["recognition"]
}) {
  const { t } = copy
  const { hasTools } = view

  return (
    <StaffPanel id="recognition" title={t("recognition")}>
      <p className="-mt-1 mb-4 text-base leading-relaxed text-(--t-ink-dim)">
        {t("recognitionLead")}
      </p>
      {hasTools ? (
        recognition ? (
          <SupporterPreferences {...recognition} />
        ) : (
          <p role="status" className="text-sm text-(--t-ink-dim)">
            {t("recognitionUnavailable")}
          </p>
        )
      ) : (
        <p className="text-sm leading-relaxed text-(--t-ink-dim)">
          {t("recognitionFree")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <GlobalLink
          href="/community/supporters"
          className={`${STAFF_LINK} inline-flex min-h-11 items-center`}
        >
          {t("meetSupporters")}
        </GlobalLink>
        <GlobalLink
          href="/profile/settings#privacy"
          className={`${STAFF_LINK} inline-flex min-h-11 items-center`}
        >
          {t("profilePrivacy")}
        </GlobalLink>
      </div>
    </StaffPanel>
  )
}
function TeamMembershipPanel({
  team,
  active,
  copy,
}: {
  team: SessionTeam
  active: boolean
  copy: MembershipCopy
}) {
  const { t } = copy
  const teamHref = "/staff/teams"

  return (
    <StaffPanel
      id="team-billing"
      title={t("teamMembership")}
      aside={
        <Badge
          color={active ? "aurora" : "dim"}
          label={t(active ? "teamSeat" : "teamInactive")}
        />
      }
    >
      <h3 className="type-card-title m-0">{team.name}</h3>
      <p className="mt-3 mb-5 text-base leading-relaxed text-(--t-ink-dim)">
        {t(
          !active
            ? "inactiveTeamBilling"
            : team.role === "organiser"
              ? "organiserBilling"
              : "memberBilling"
        )}
      </p>
      <GlobalLink
        href={`${teamHref}${team.role === "organiser" ? "/billing" : ""}`}
        className={buttonVariants({ variant: "surface", size: "pill" })}
      >
        {t(team.role === "organiser" ? "manageTeamBilling" : "openTeam")}
      </GlobalLink>
      <p className="mt-4 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
        {t("apiSeparate")}
      </p>
    </StaffPanel>
  )
}
function MembershipSidebar({
  current,
  staffCount,
  copy,
  billing,
}: {
  current: MembershipView["current"]
  staffCount: number
  copy: MembershipCopy
  billing: MembershipBillingController
}) {
  const { t, b } = copy
  const { error, summary, reload: handleReload } = billing

  return (
    <aside
      aria-label={t("helpAndAccess")}
      className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-(--sticky-content-top)"
    >
      <StaffPanel
        compact
        id="library-access"
        title={t("libraryStaff")}
        aside={<Badge color="dim" label={t("separate")} />}
      >
        <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
          {t(staffCount ? "approvedStaff" : "staffOptional")}
        </p>
        {!staffCount ? (
          <p className="mt-3 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
            {t("claimExplanation")}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <GlobalLink
            href={staffCount ? "/staff" : "/contribute/claim"}
            className={buttonVariants({ variant: "surface", size: "pill" })}
          >
            {t(staffCount ? "manageLibraries" : "claimLibrary")}
          </GlobalLink>
          <GlobalLink
            href="/plans#library-staff-h"
            className={`${STAFF_LINK} inline-flex min-h-11 items-center text-base`}
          >
            {t("howItWorks")}
          </GlobalLink>
        </div>
      </StaffPanel>
      {current === "free" || current === "supporter" ? (
        <StaffPanel compact id="complimentary" title={t("getProFree")}>
          <p className="m-0 mb-4 text-base leading-relaxed text-(--t-ink-dim)">
            {t("getProFreeLead")}
          </p>
          <SidebarLinks>
            <li>
              <GlobalLink href="/plans#get-pro-free">
                {t("seeEligibility")}
              </GlobalLink>
            </li>
          </SidebarLinks>
        </StaffPanel>
      ) : null}
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
              href={`mailto:${CONTACT_EMAIL}?subject=Membership%20question`}
              data-contact-type="membership_support"
            >
              {t("askQuestion")}
            </a>
          </li>
        </SidebarLinks>
      </StaffPanel>
      {error && summary ? (
        <Button variant="surface" size="pill" onClick={handleReload}>
          {b("retry")}
        </Button>
      ) : null}
    </aside>
  )
}
