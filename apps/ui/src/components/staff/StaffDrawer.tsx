"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import { Drawer } from "@/components/ds/Drawer"
import {
  DRAWER_CARD as CARD,
  DrawerAction,
  DrawerFooter,
  DrawerSection,
} from "@/components/ds/DrawerCards"
import { TONES as NOTICE_TONES } from "@/components/ds/Notice"
import { useFeaturedDrive } from "@/hooks/useContributeMenu"
import { useEntitlements, useStaff } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { searchLibraryNames } from "@/lib/meilisearch"
import { mobileConsoleHref } from "@/lib/mobile-app"
import { Link } from "@/lib/navigation"
import { useCurrentLibrary } from "@/lib/staff/current-library"
import {
  closeStaffDrawer,
  readLastDrawerLibrary,
  rememberDrawerLibrary,
  useStaffDrawer,
} from "@/lib/staff/drawer"
import { shortDate } from "@/lib/staff/format"
import { staffLibraryHref } from "@/lib/staff/paths"

/** `GET /api/staff/[documentId]/drawer` (spec §1 "Staff drawer"). */
export type StaffDrawerData = {
  library: {
    documentId: string
    name: string
    slug: string
    path: string
    libraryType: string
    role: "owner" | "editor"
  }
  suggestions: number
  noticesUpcoming: number
  live: {
    state: "off" | "idle" | "live"
    nextRoute: { date: string; time: string } | null
    currentStop: string | null
  } | null
  drives: { slug: string; title: string; need: string | null }[]
}

async function fetchDrawer(id: string): Promise<StaffDrawerData> {
  const res = await fetch(`/api/staff/${encodeURIComponent(id)}/drawer`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("drawer_unavailable")
  const data = (await res.json()) as StaffDrawerData

  return data
}

/** The page's library, when the viewer isn't staff of it: name and slug for
 * the "You're not staff of …" line and its claim link. */
type PageLibrary = { documentId: string; name: string; slug: string }
const pageLibraries = new Map<string, PageLibrary | null>()

async function lookupPageLibrary(
  documentId: string,
  locale: string
): Promise<PageLibrary | null> {
  if (pageLibraries.has(documentId)) return pageLibraries.get(documentId)!
  try {
    const { hits } = await searchLibraryNames("", {
      hitsPerPage: 1,
      attributesToRetrieve: ["documentId", "name", "slug"],
      filters: [`documentId = ${JSON.stringify(documentId)}`],
      locale,
    })
    const hit = hits[0]
    const found = hit ? { documentId, name: hit.name, slug: hit.slug } : null
    pageLibraries.set(documentId, found)

    return found
  } catch {
    return null
  }
}

/**
 * The staff drawer: one library at a time, with its live state (Mobile),
 * what's waiting for review, the staff area's pages, and the drives that
 * include it. Opens from the edge tab, Alt+S, the user menu and the
 * Contribute dropdown; the page's own library is the default choice.
 */
export function StaffDrawer() {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("workspaceDrawer")

  const staff = useStaff()
  const { libraries } = staff
  const teams = staff.teams ?? []
  const { canForLibrary } = useEntitlements()
  const locale = useLocale()
  const { data: featuredDrive = null } = useFeaturedDrive(libraries.length > 0)
  const { libraryDocumentId: requested } = useStaffDrawer()
  const current = useCurrentLibrary()
  const ids = useMemo(() => new Set(libraries.map((l) => l.id)), [libraries])
  const initial = useMemo(() => {
    const last = readLastDrawerLibrary()
    const pick = [requested, current, last].find((id) => id && ids.has(id))

    return pick ?? libraries[0]?.id ?? null
  }, [requested, current, ids, libraries])
  const [selected, setSelected] = useState<string | null>(initial)
  // Keep summaries local to this open drawer, never shared between accounts.
  const [loaded, setLoaded] = useState<{
    id: string
    data: StaffDrawerData | null
    failed: boolean
  } | null>(null)
  // The page's library when it isn't one of the viewer's: named so the
  // drawer can say what it is showing instead, and offer a claim.
  const elsewhere = !!current && !ids.has(current)
  const [pageLibrary, setPageLibrary] = useState<PageLibrary | null>(null)

  useEffect(() => {
    if (!selected) return
    let live = true
    rememberDrawerLibrary(selected)
    fetchDrawer(selected)
      .then((d) => {
        if (live) setLoaded({ id: selected, data: d, failed: false })
      })
      .catch(() => {
        if (live)
          setLoaded({
            id: selected,
            data: null,
            failed: true,
          })
      })

    return () => {
      live = false
    }
  }, [selected])

  useEffect(() => {
    if (!elsewhere || !current) return
    let live = true
    lookupPageLibrary(current, locale).then((found) => {
      if (live) setPageLibrary(found)
    })

    return () => {
      live = false
    }
  }, [elsewhere, current, locale])

  const data = loaded?.id === selected ? loaded.data : null
  const failed = loaded?.id === selected && loaded.failed

  const library = libraries.find((l) => l.id === selected) ?? libraries[0]
  if (!library) return null
  const id = library.id
  const base = staffLibraryHref(library.slug)
  const mobile = library.libraryType === "Mobile"
  const live = data?.live ?? null
  const isLive = live?.state === "live"
  const canGoLive = staff.can("goLive", id)
  const teamCovered = canForLibrary("library.team", id)
  const trafficCovered = canForLibrary("library.traffic", id)
  const organises = teams.some((t) => t.role === "organiser")
  const claimHref = pageLibrary
    ? `/contribute/claim?librarySlug=${encodeURIComponent(pageLibrary.slug)}&libraryName=${encodeURIComponent(pageLibrary.name)}&libraryDocumentId=${encodeURIComponent(pageLibrary.documentId)}`
    : null

  return (
    <Drawer
      size="md"
      titleId="staff-drawer-title"
      title={library.name}
      eyebrow={
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] font-semibold"
          style={{
            background: T.bg.deep,
            borderColor: T.border.line,
            color: T.ink.base,
          }}
        >
          <Icon
            aria-hidden="true"
            height={16}
            icon="mdi:check"
            style={{ color: T.accent.ok }}
            width={16}
          />
          {tUi("verified_staff")}
        </span>
      }
      headerContent={
        <div className="flex flex-col gap-3">
          {libraries.length > 1 ? (
            <label className="relative block" style={{ color: T.ink.dim }}>
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
                height={18}
                icon="mdi:swap-vertical"
                width={18}
              />
              <span className="sr-only">{tUi("library")}</span>
              <select
                className="min-h-12 w-full min-w-0 appearance-none truncate rounded-[14px] border py-2 pr-10 pl-10 text-[15px] font-semibold"
                onChange={(event) => setSelected(event.target.value)}
                style={{
                  background: T.bg.deep,
                  borderColor: T.border.hi,
                  color: T.ink.base,
                }}
                value={id}
              >
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.name}
                  </option>
                ))}
              </select>
              <Icon
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
                height={18}
                icon="mdi:chevron-down"
                width={18}
              />
            </label>
          ) : (
            <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-(--t-ink-dim)">
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-(--t-ink-base)">
                {library.role === "owner"
                  ? t("libraryOwner")
                  : t("libraryEditor")}
              </span>
              {library.libraryType}
            </p>
          )}

          {mobile ? (
            <section
              aria-label={tUi("live_sharing")}
              className={`${CARD} flex min-h-16 items-center gap-3 px-3.5 py-3`}
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full ${
                  isLive ? "animate-pulse motion-reduce:animate-none" : ""
                }`}
                style={{ background: isLive ? T.accent.ok : T.border.hi }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="m-0 text-[15px] font-semibold"
                  style={{ color: isLive ? T.accent.ok : T.ink.base }}
                >
                  {isLive ? tUi("live_now") : "Not live"}
                </p>
                <p
                  aria-live="polite"
                  className="m-0 text-[15px] leading-snug"
                  style={{ color: T.ink.dim }}
                >
                  {isLive && live?.currentStop
                    ? `At ${live.currentStop}`
                    : live?.nextRoute
                      ? `Next route ${shortDate(live.nextRoute.date)} · ${live.nextRoute.time}`
                      : live?.state === "off"
                        ? "Live updates are off"
                        : data
                          ? "No route planned"
                          : "Checking today’s route…"}
                </p>
              </div>
              {canGoLive ? (
                <Link
                  href={mobileConsoleHref(id, locale)}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                >
                  {tUi("go_live")}
                </Link>
              ) : (
                <p
                  className="m-0 max-w-[12ch] shrink-0 text-right text-[12px]"
                  style={{ color: T.ink.dim }}
                >
                  Live updates: ask an owner
                </p>
              )}
            </section>
          ) : null}
        </div>
      }
      footer={
        <DrawerFooter
          href={base}
          label={t("openStaff")}
          shortcut="Alt S"
          onClose={closeStaffDrawer}
        />
      }
      onClose={closeStaffDrawer}
      initialFocus={(panel) =>
        panel.querySelector<HTMLElement>("select") ??
        panel.querySelector<HTMLElement>("button")
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        {elsewhere ? (
          <p
            className="m-0 flex items-start gap-2 rounded-[16px] px-3.5 py-3 text-[14px]"
            style={{
              background: NOTICE_TONES.info.bg,
              color: T.ink.base,
            }}
          >
            <Icon
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              height={17}
              icon="mdi:information-outline"
              style={{ color: NOTICE_TONES.info.fg }}
              width={17}
            />
            <span>
              You’re not staff of {pageLibrary?.name ?? "this library"}. Showing{" "}
              {library.name}.{" "}
              {claimHref ? (
                <Link
                  href={claimHref}
                  className="font-semibold underline underline-offset-[3px]"
                  style={{ color: T.accent.primary }}
                >
                  Claim {pageLibrary!.name}
                </Link>
              ) : null}
            </span>
          </p>
        ) : null}

        <DrawerSection id="staff-drawer-library-h" title={t("yourLibrary")}>
          <div aria-live="polite" className="mb-2">
            {failed && !data ? (
              <p
                role="status"
                className="m-0 rounded-[14px] bg-(--t-bg-surface) px-3 py-2.5 text-[13px] leading-relaxed text-(--t-ink-dim)"
              >
                {t("staffUnavailable")}
              </p>
            ) : data && data.suggestions > 0 ? (
              <Link
                href={`${base}#suggestions`}
                onClick={closeStaffDrawer}
                className="flex items-center gap-3 rounded-[16px] bg-[#19172c] px-3.5 py-3 text-white no-underline transition-colors hover:bg-[#29253f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[17px] font-semibold tabular-nums"
                >
                  {data.suggestions}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-snug font-semibold">
                    {t("suggestedChanges", { count: data.suggestions })}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-[#d1cedd]">
                    {t("reviewBeforeLive")}
                  </span>
                </span>
                <Icon
                  aria-hidden
                  icon="mdi:arrow-right"
                  width={17}
                  height={17}
                />
              </Link>
            ) : (
              <p className="m-0 flex items-center gap-2 rounded-[12px] bg-(--t-bg-surface) px-3 py-2.5 text-[12px] text-(--t-ink-dim)">
                <Icon
                  aria-hidden
                  icon={
                    data ? "mdi:check-circle-outline" : "mdi:progress-clock"
                  }
                  width={15}
                  height={15}
                  className={data ? "text-(--t-accent-ok)" : undefined}
                />
                {data
                  ? tUi("nothing_waiting_for_review")
                  : t("checkingSuggestions")}
              </p>
            )}
          </div>
          <div className="divide-y divide-(--t-border-line)">
            <DrawerAction
              href={`${base}/edit`}
              icon="mdi:pencil-outline"
              label={tUi("edit_record")}
              onClick={closeStaffDrawer}
            />
            <DrawerAction
              href={`${base}/notices`}
              icon="mdi:bell-outline"
              label={tUi("notices")}
              count={
                data && data.noticesUpcoming > 0
                  ? data.noticesUpcoming
                  : undefined
              }
              onClick={closeStaffDrawer}
            />
            <DrawerAction
              href={`${base}/events`}
              icon="mdi:calendar-check-outline"
              label={tUi("event_feeds")}
              onClick={closeStaffDrawer}
            />
            {mobile ? (
              <>
                <DrawerAction
                  href={`${base}/edit?step=timetable`}
                  icon="mdi:calendar-blank-outline"
                  label={tUi("timetable")}
                  tag="Mobile"
                  onClick={closeStaffDrawer}
                />
                <DrawerAction
                  href={`${base}/live`}
                  icon="mdi:broadcast"
                  label={tUi("go_live")}
                  tag="Mobile"
                  onClick={closeStaffDrawer}
                />
              </>
            ) : null}
            <DrawerAction
              href={
                data?.library.path ??
                `/libraries?q=${encodeURIComponent(library.slug)}`
              }
              icon="mdi:eye-outline"
              label={tUi("public_page")}
              onClick={closeStaffDrawer}
            />
            <DrawerAction
              href={base}
              icon="mdi:view-dashboard-outline"
              label={tUi("staff_area")}
              onClick={closeStaffDrawer}
            />
          </div>
        </DrawerSection>

        <DrawerSection id="staff-drawer-team-h" title={t("teamAndInsights")}>
          <DrawerAction
            href={`${base}/team`}
            icon="mdi:account-group-outline"
            label={tUi("team")}
            tag={teamCovered ? undefined : "Team"}
            onClick={closeStaffDrawer}
          />
          <DrawerAction
            href={`${base}/traffic`}
            icon="mdi:chart-bar"
            label={tUi("traffic")}
            tag={trafficCovered ? undefined : "Team"}
            onClick={closeStaffDrawer}
          />
          {organises ? (
            <DrawerAction
              href="/staff/team"
              icon="mdi:account-multiple-plus-outline"
              label={tUi("team_organiser")}
              onClick={closeStaffDrawer}
            />
          ) : null}
          {!teamCovered || !trafficCovered ? (
            <p className="m-0 mt-2 border-t border-(--t-border-line) pt-2 text-[12px] leading-relaxed text-(--t-ink-dim)">
              {t("teamAccess")}
            </p>
          ) : null}
        </DrawerSection>

        <DrawerSection
          id="staff-drawer-drives-h"
          title={t("communityDrives")}
          action={
            <Link
              href="/community"
              onClick={closeStaffDrawer}
              className="inline-flex min-h-8 shrink-0 items-center text-[12px] font-semibold text-(--t-accent-primary) underline underline-offset-4"
            >
              {tUi("all_drives")}
            </Link>
          }
        >
          <div aria-live="polite">
            {data?.drives.length ? (
              <div className="divide-y divide-(--t-border-line)">
                {data.drives.map((drive) => (
                  <DrawerAction
                    key={drive.slug}
                    href={driveHref(drive.slug)}
                    icon="mdi:flag-outline"
                    label={drive.title}
                    description={
                      drive.need
                        ? t("libraryNeeds", { need: drive.need })
                        : undefined
                    }
                    onClick={closeStaffDrawer}
                  />
                ))}
              </div>
            ) : (
              <p className="m-0 text-[13px] leading-relaxed text-(--t-ink-dim)">
                {data
                  ? t("noLibraryDrive")
                  : failed
                    ? t("drivesUnavailable")
                    : t("checkingDrives")}
              </p>
            )}
          </div>
          {featuredDrive &&
          !data?.drives.some((drive) => drive.slug === featuredDrive.slug) ? (
            <div className="mt-3 border-t border-(--t-border-line) pt-2">
              <DrawerAction
                href={driveHref(featuredDrive.slug)}
                icon="mdi:pin-outline"
                label={featuredDrive.title}
                description={t("featuredDrive")}
                onClick={closeStaffDrawer}
              />
            </div>
          ) : null}
        </DrawerSection>
        <DrawerAction
          href="/contribute/index/new"
          icon="mdi:map-marker-plus-outline"
          label={tUi("add_a_library")}
          onClick={closeStaffDrawer}
        />
      </div>
    </Drawer>
  )
}
