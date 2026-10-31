import { Icon } from "@iconify/react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  getLocale,
  getTranslations as getUiTranslations,
} from "next-intl/server"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Badge, HealthList, Notice } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { staffHealthRows } from "@/components/staff/staff-health"
import { StaffAccessRequests } from "@/components/staff/StaffAccessRequests"
import { StaffAccessRequired } from "@/components/staff/StaffAccessRequired"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffClaimSteps } from "@/components/staff/StaffClaimSteps"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { YourTeamCard } from "@/components/staff/YourTeamCard"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { mobileConsoleHref } from "@/lib/mobile-app"
import { Link } from "@/lib/navigation"
import { fetchMySubmissionsResult } from "@/lib/role-application-server"
import { staffLibraryHref } from "@/lib/staff/paths"
import { fetchStaffTeams } from "@/lib/staff/teams-server"
import type { StaffOverview } from "@/lib/staff/types"
import { canAddStaffLibrary } from "@/lib/staff/workspace-access"
import { fetchStaff } from "@/lib/staff-proxy"

const ROLE_LABEL = { owner: "Owner", editor: "Editor" } as const

const QUICK_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/** What `?oauth=` means after an Eventbrite sign-in came back here. */
const OAUTH_NOTICE: Record<string, { title: string; message: string }> = {
  failed: {
    title: "Eventbrite sign-in didn’t finish",
    message:
      "Nothing was connected. Open the library’s Event feeds and try again.",
  },
  refused: {
    title: "Couldn’t send the feed for review",
    message:
      "Eventbrite connected, but the feed couldn’t be sent for review. Try again from the library’s Event feeds.",
  },
}

function oauthNotice(value: string | string[] | undefined) {
  const key = Array.isArray(value) ? value[0] : value

  return key ? (OAUTH_NOTICE[key] ?? OAUTH_NOTICE.failed) : null
}

function availableStaffTeams(
  result: Awaited<ReturnType<typeof fetchStaffTeams>> | null
) {
  return result?.status === 200 ? (result.body?.teams ?? []) : []
}

function StaffOauthNotice({
  oauth,
  libraries,
}: {
  oauth: ReturnType<typeof oauthNotice>
  libraries: ReturnType<typeof staffLibrariesOf>
}) {
  if (!oauth) return null

  return (
    <div className="mb-6">
      <Notice icon="mdi:alert-circle-outline" tone="warn" title={oauth.title}>
        <p className="m-0" style={{ color: T.ink.base }}>
          {oauth.message}
        </p>
        {libraries.length === 1 ? (
          <p className="m-0 mt-1">
            <Link
              href={staffLibraryHref(libraries[0]!.slug, "/events")}
              className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Open Event feeds
              <Icon
                aria-hidden="true"
                height={15}
                icon="mdi:arrow-right"
                width={15}
              />
            </Link>
          </p>
        ) : null}
      </Notice>
    </div>
  )
}

/**
 * Your libraries as cards, "Claim another library", and for team members
 * a "Your team" card. Single-library accounts keep this overview too.
 */
export default async function StaffLibrariesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ oauth?: string | string[] }>
}) {
  const tUi = await getUiTranslations("ui")
  const t = await getUiTranslations("staffWorkspace")
  const locale = await getLocale()

  const [session, query] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
  ])
  if (!session?.user) return <StaffAccessRequired />
  const libraries = staffLibrariesOf(session.user)
  const teams = sessionTeamsOf(session.user)
  if (libraries.length >= 100) redirect("/staff/networks/libraries")
  const oauth = oauthNotice(query.oauth)
  const [summaries, teamsResult, submissions] = await Promise.all([
    Promise.all(
      libraries.map((lib) =>
        fetchStaff<StaffOverview>(session.user, `libraries/${lib.id}/overview`)
      )
    ),
    teams.length ? fetchStaffTeams(session.user) : Promise.resolve(null),
    fetchMySubmissionsResult(session.user),
  ])
  const accessRequests = (submissions ?? []).filter(
    (row) =>
      row.submissionType === "library_claim" &&
      row.documentId &&
      ["draft", "pending", "needs_info"].includes(row.status ?? "")
  )
  const teamRows = teamsResult?.body?.teams
  const canAddLibrary = canAddStaffLibrary(
    libraries.length,
    availableStaffTeams(teamsResult)
  )

  return (
    <>
      <WorkspacePageHeader
        title={t("yourLibraries")}
        lead="Publish record changes, answer suggestions and post notices for the libraries you run."
        tabs={
          <StaffAreaTabs
            active="overview"
            teamId={teams[0]?.id}
            adding={canAddLibrary}
          />
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {libraries.length + accessRequests.length > 0 ? (
              <Link
                href="/staff/claim"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                <Icon
                  aria-hidden="true"
                  height={16}
                  icon="mdi:plus"
                  width={16}
                  style={{ color: T.accent.primary }}
                />
                {t("claimAnother")}
              </Link>
            ) : null}
            {canAddLibrary && (
              <Link
                href="/staff/new"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                <Icon
                  icon="mdi:plus"
                  aria-hidden="true"
                  width={16}
                  style={{ color: T.accent.primary }}
                />
                Add a new library
              </Link>
            )}
          </div>
        }
      />
      <Container className="py-10">
        <StaffOauthNotice oauth={oauth} libraries={libraries} />
        <div className={teams.length ? "staff-overview-grid" : ""}>
          <div className="min-w-0 space-y-6">
            {accessRequests.length || submissions === null ? (
              <StaffAccessRequests
                requests={accessRequests}
                unavailable={submissions === null}
              />
            ) : null}
            {libraries.length ? (
              <ul className="staff-libraries-grid">
                {libraries.map((lib, index) => {
                  const overview = summaries[index]?.body ?? null
                  const done = overview
                    ? overview.health.filter((row) => row.status === "ok")
                        .length
                    : null
                  const tint = tintForLibraryType(lib.libraryType)
                  const mobile = lib.libraryType === "Mobile"
                  const base = staffLibraryHref(lib.slug)
                  const waiting = overview?.counts.suggestions ?? null

                  return (
                    <li
                      key={lib.id}
                      className="flex min-w-0 flex-col gap-4 rounded-3xl border p-6"
                      style={{
                        background: T.bg.deep,
                        borderColor: T.border.line,
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
                          style={{ background: tint.bg, color: tint.fg }}
                        >
                          <Icon
                            aria-hidden="true"
                            height={14}
                            icon={
                              mobile ? "mdi:bus-side" : "mdi:library-outline"
                            }
                            width={14}
                          />
                          {mobile
                            ? "Mobile library"
                            : `${lib.libraryType} library`}
                        </span>
                        <Badge label={ROLE_LABEL[lib.role]} color="dim" />
                      </div>
                      <h2
                        className="type-h2 m-0"
                        style={{
                          color: T.ink.base,
                        }}
                      >
                        <Link
                          href={base}
                          className="no-underline hover:text-(--t-accent-primary)"
                          style={{ color: T.ink.base }}
                        >
                          {lib.name}
                        </Link>
                      </h2>
                      <p className="m-0 text-base" style={{ color: T.ink.dim }}>
                        {overview ? (
                          <>
                            <span
                              className="font-semibold"
                              style={{ color: T.ink.base }}
                            >
                              {done} of {overview.health.length}
                            </span>{" "}
                            record checks complete ·{" "}
                            {waiting === 0 ? (
                              "nothing waiting for review"
                            ) : (
                              <Link
                                href={`${base}#suggestions`}
                                className="font-semibold underline underline-offset-[3px]"
                                style={{ color: T.accent.primary }}
                              >
                                {waiting} suggested{" "}
                                {waiting === 1 ? "change" : "changes"} to review
                              </Link>
                            )}
                          </>
                        ) : (
                          "The record summary is unavailable right now."
                        )}
                      </p>
                      <p className="m-0 rounded-xl bg-(--t-accent-chip) p-3 text-sm text-(--t-ink-dim)">
                        Your changes to this record publish straight away.
                        Moves, type changes and permanent closures still need
                        review.
                      </p>
                      {overview ? (
                        <HealthList
                          headingId={`staff-health-${lib.id}`}
                          title={tUi("record_health")}
                          rows={staffHealthRows(overview)}
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={base}
                          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-(--t-action-primary) px-4 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover)"
                        >
                          Open Staff area
                          <Icon
                            aria-hidden="true"
                            height={14}
                            icon="mdi:arrow-right"
                            width={14}
                          />
                        </Link>
                        {mobile && lib.canGoLive ? (
                          <Link
                            href={mobileConsoleHref(lib.id, locale)}
                            className={QUICK_LINK}
                            style={{
                              borderColor: T.border.hi,
                              color: T.ink.base,
                            }}
                          >
                            <Icon
                              aria-hidden="true"
                              height={11}
                              icon="mdi:circle"
                              width={11}
                              style={{ color: T.accent.ok }}
                            />
                            {tUi("go_live")}
                          </Link>
                        ) : null}
                        <Link
                          href={`${base}/edit`}
                          className={QUICK_LINK}
                          style={{
                            borderColor: T.border.hi,
                            color: T.ink.base,
                          }}
                        >
                          {tUi("edit_record")}
                        </Link>
                        <Link
                          href={`${base}/notices#post-notice`}
                          className={QUICK_LINK}
                          style={{
                            borderColor: T.border.hi,
                            color: T.ink.base,
                          }}
                        >
                          {tUi("post_a_notice")}
                        </Link>
                        {mobile ? (
                          <Link
                            href={`${base}/edit?step=timetable`}
                            className={QUICK_LINK}
                            style={{
                              borderColor: T.border.hi,
                              color: T.ink.base,
                            }}
                          >
                            Edit timetable
                          </Link>
                        ) : null}
                        <Link
                          href={`${base}/events`}
                          className={QUICK_LINK}
                          style={{
                            borderColor: T.border.hi,
                            color: T.ink.base,
                          }}
                        >
                          {tUi("event_feeds")}
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : accessRequests.length || submissions === null ? (
              <p className="text-base text-(--t-ink-dim)">
                {t("noApprovedAccess")}
              </p>
            ) : (
              <StaffPanel title={t("connectLibrary")}>
                <p
                  className="m-0 mb-4 max-w-[52ch] text-base"
                  style={{ color: T.ink.dim }}
                >
                  {t(
                    teams.length
                      ? "connectTeamLibraryLead"
                      : "connectLibraryLead"
                  )}
                </p>
                <StaffClaimSteps />
                <Link
                  href="/staff/claim"
                  className="mt-5 inline-flex min-h-11 items-center rounded-full bg-(--t-action-primary) px-5 font-semibold text-white no-underline transition-colors hover:bg-(--t-action-primary-hover)"
                >
                  {t("claimLibrary")}
                </Link>
              </StaffPanel>
            )}
          </div>
          {teams.length ? (
            <aside className="min-w-0 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto">
              <YourTeamCard teams={teamRows} />
            </aside>
          ) : null}
        </div>
      </Container>
    </>
  )
}
