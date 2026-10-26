import { Icon } from "@iconify/react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  getLocale,
  getTranslations as getUiTranslations,
} from "next-intl/server"

import { Badge, Notice, PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { StaffAccessRequired } from "@/components/staff/StaffAccessRequired"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffClaimSteps } from "@/components/staff/StaffClaimSteps"
import { YourTeamCard } from "@/components/staff/YourTeamCard"
import { sessionTeamsOf, staffLibrariesOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { mobileConsoleHref } from "@/lib/mobile-app"
import { Link } from "@/lib/navigation"
import { staffLibraryHref } from "@/lib/staff/paths"
import { isActiveTeam } from "@/lib/staff/team-status"
import type { StaffOverview, TeamSummary } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

const ROLE_LABEL = { owner: "Owner", editor: "Editor" } as const

const QUICK_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

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

/**
 * Your libraries as cards, "Claim another library", and for team members
 * a "Your team" card. With exactly one library and no team, straight to it,
 * unless an OAuth result needs showing first.
 */
export default async function StaffLibrariesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ oauth?: string | string[] }>
}) {
  const tUi = await getUiTranslations("ui")
  const locale = await getLocale()

  const [session, query] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
  ])
  if (!session?.user) return <StaffAccessRequired />
  const libraries = staffLibrariesOf(session.user)
  const teams = sessionTeamsOf(session.user)
  if (libraries.length >= 100) redirect("/staff/networks/libraries")
  if (!libraries.length && !teams.length)
    return <StaffAccessRequired signedIn />
  const oauth = oauthNotice(query.oauth)
  if (!oauth && libraries.length === 1 && teams.length === 0)
    redirect(staffLibraryHref(libraries[0]!.slug))
  const [summaries, teamsResult] = await Promise.all([
    Promise.all(
      libraries.map((lib) =>
        fetchStaff<StaffOverview>(session.user, `libraries/${lib.id}/overview`)
      )
    ),
    teams.length
      ? fetchStaff<{ teams: TeamSummary[] }>(
          session.user,
          "teams/mine",
          "access"
        )
      : Promise.resolve(null),
  ])
  const teamRows = teamsResult?.body?.teams
  const canAddLibrary =
    libraries.length > 0 ||
    Boolean(teamRows?.some((team) => team.verified && isActiveTeam(team)))

  return (
    <>
      <PageHero
        staff
        title="Your *Staff area*"
        eyebrow="Library staff"
        eyebrowIcon="mdi:shield-account-outline"
        lead="Publish record changes, answer suggestions and post notices for the libraries you run."
        tabs={
          <StaffAreaTabs
            active="overview"
            teamId={teams[0]?.id}
            adding={canAddLibrary}
          />
        }
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/staff/claim"
            className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              height={16}
              icon="mdi:plus"
              width={16}
              style={{ color: T.accent.primary }}
            />
            Claim another library
          </Link>
          {canAddLibrary && (
            <Link
              href="/staff/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
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
      </PageHero>
      <Container className="py-10">
        {oauth ? (
          <div className="mb-6">
            <Notice
              icon="mdi:alert-circle-outline"
              tone="warn"
              title={oauth.title}
            >
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
        ) : null}
        <div
          className={
            teams.length
              ? "grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"
              : ""
          }
        >
          <div className="min-w-0">
            {libraries.length ? (
              <ul className="m-0 grid list-none gap-5 p-0 md:grid-cols-2">
                {libraries.map((lib, index) => {
                  const overview = summaries[index]?.body ?? null
                  const done = overview
                    ? overview.health.filter((row) => row.status === "ok")
                        .length
                    : null
                  const tint = tintForLibraryType(lib.libraryType)
                  const mobile = lib.libraryType === "Mobile"
                  const base = staffLibraryHref(lib.slug)
                  const waiting = overview?.counts.suggestions ?? 0

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
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
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
                        className="m-0"
                        style={{
                          fontFamily: T.font.serif,
                          fontSize: "clamp(24px,2.6vw,30px)",
                          fontWeight: 500,
                          lineHeight: 1.15,
                          letterSpacing: "-0.01em",
                          color: T.ink.base,
                        }}
                      >
                        <Link
                          href={base}
                          className="underline decoration-(--t-border-hi) underline-offset-4 hover:decoration-(--t-accent-primary)"
                          style={{ color: T.ink.base }}
                        >
                          {lib.name}
                        </Link>
                      </h2>
                      <p
                        className="m-0 text-[15px]"
                        style={{ color: T.ink.dim }}
                      >
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
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={base}
                          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
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
            ) : (
              <section
                className="rounded-[20px] border p-6 sm:p-8"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <h2
                  className="m-0 mb-2"
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "clamp(24px,2.6vw,30px)",
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  Connect your first Library
                </h2>
                <p
                  className="m-0 mb-4 max-w-[52ch] text-[15px]"
                  style={{ color: T.ink.dim }}
                >
                  {teams[0]?.role === "organiser"
                    ? "Your Team membership and Library staff access are separate. Claim a Library you work with, then add it to your Team under Members & libraries and assign colleagues. A moderator checks your claim; payment does not grant staff authority."
                    : "Your Team organiser can assign you to a covered Library. You can also claim a Library you work with yourself. A moderator checks each claim before staff access is granted."}
                </p>
                <StaffClaimSteps />
                <Link
                  href="/staff/claim"
                  className="mt-5 inline-flex min-h-11 items-center rounded-full bg-(--t-accent-primary) px-5 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                >
                  Claim your library
                </Link>
              </section>
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
