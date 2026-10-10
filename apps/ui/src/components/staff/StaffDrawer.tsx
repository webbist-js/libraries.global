"use client"

import { Icon } from "@iconify/react"
import { useLocale } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import { Drawer } from "@/components/ds/Drawer"
import {
  DRAWER_CARD as CARD,
  DrawerLinkCard,
  DrawerTile as Tile,
} from "@/components/ds/DrawerCards"
import { TONES as NOTICE_TONES } from "@/components/ds/Notice"
import { useFeaturedDrive } from "@/hooks/useContributeMenu"
import { useEntitlements, useStaff } from "@/lib/access-client"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { searchLibraryNames } from "@/lib/meilisearch"
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

/** Per library, for the session: shown at once, refreshed on every open. */
const cache = new Map<string, StaffDrawerData>()

async function fetchDrawer(id: string): Promise<StaffDrawerData> {
  const res = await fetch(`/api/staff/${encodeURIComponent(id)}/drawer`, {
    cache: "no-store",
  })
  if (!res.ok) throw new Error("drawer_unavailable")
  const data = (await res.json()) as StaffDrawerData
  cache.set(id, data)

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
  // What the last fetch returned, for which library; the cache fills in
  // while a refetch is in flight, so nothing is set synchronously.
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
            data: cache.get(selected) ?? null,
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

  const data =
    loaded?.id === selected
      ? loaded.data
      : selected
        ? (cache.get(selected) ?? null)
        : null
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
          Verified staff
        </span>
      }
      headerContent={
        <div className="flex flex-col gap-3">
          <label className="relative block" style={{ color: T.ink.dim }}>
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
              height={18}
              icon="mdi:swap-vertical"
              width={18}
            />
            <span className="sr-only">Library</span>
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

          {mobile ? (
            <section
              aria-label="Live sharing"
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
                  {isLive ? "Live now" : "Not live"}
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
                  href={`/live/${id}`}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                >
                  Go live
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
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-5 py-3"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <Link
            href={base}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            onClick={closeStaffDrawer}
          >
            Open staff area
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:arrow-right"
              width={15}
            />
          </Link>
          <span className="text-[13px]" style={{ color: T.ink.dim }}>
            Shortcut:{" "}
            <kbd
              className="rounded-md border px-1.5 py-0.5 font-semibold"
              style={{
                borderColor: T.border.hi,
                background: T.bg.surface,
                fontFamily: T.font.mono,
                color: T.ink.base,
              }}
            >
              Alt S
            </kbd>
          </span>
        </div>
      }
      onClose={closeStaffDrawer}
      initialFocus={(panel) =>
        panel.querySelector<HTMLElement>("select") ??
        panel.querySelector<HTMLElement>("button")
      }
    >
      <div className="flex flex-col gap-5 px-5 py-4">
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

        <div aria-live="polite">
          {failed && !data ? (
            <p
              role="status"
              className="m-0 rounded-[16px] px-3 py-2 text-[13px]"
              style={{ background: T.bg.muted, color: T.ink.dim }}
            >
              The summary is unavailable right now. The links below still work.
            </p>
          ) : data && data.suggestions > 0 ? (
            <Link
              href={`${base}#suggestions`}
              className={`${CARD} flex items-center gap-3 px-3.5 py-3.5 no-underline transition-colors hover:bg-(--t-bg-surface)`}
              style={{ background: T.bg.deep, borderColor: T.edge.danger }}
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums"
                style={{
                  background: TYPE_TINT.special.bg,
                  color: T.accent.danger,
                }}
              >
                {data.suggestions}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-[15px] leading-snug font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {data.suggestions} suggested{" "}
                  {data.suggestions === 1 ? "change" : "changes"} to review
                </span>
                <span
                  className="mt-0.5 block text-[15px] leading-snug"
                  style={{ color: T.ink.dim }}
                >
                  Review them before they go live.
                </span>
              </span>
              <Icon
                aria-hidden="true"
                height={18}
                icon="mdi:chevron-right"
                style={{ color: T.ink.dim }}
                width={18}
              />
            </Link>
          ) : (
            <p
              className="m-0 flex items-center gap-2 px-1 text-[13px]"
              style={{ color: T.ink.dim }}
            >
              <Icon
                aria-hidden="true"
                height={15}
                icon={data ? "mdi:check-circle-outline" : "mdi:progress-clock"}
                style={{ color: data ? T.accent.ok : T.ink.dim }}
                width={15}
              />
              {data
                ? "Nothing waiting for review"
                : "Checking for suggestions…"}
            </p>
          )}
        </div>

        <section aria-labelledby="staff-drawer-library-h">
          <h3
            id="staff-drawer-library-h"
            className="m-0 mb-2.5 text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            Your library
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            <Tile
              href={base}
              icon="mdi:view-dashboard-outline"
              label="Staff area"
            />
            <Tile
              href={`${base}/edit`}
              icon="mdi:pencil-outline"
              label="Edit record"
            />
            {mobile ? (
              <>
                <Tile
                  href={`${base}/edit?step=timetable`}
                  icon="mdi:calendar-blank-outline"
                  label="Timetable"
                  tag="Mobile"
                />
                <Tile
                  href={`${base}/live`}
                  icon="mdi:broadcast"
                  label="Go live"
                  tag="Mobile"
                />
              </>
            ) : null}
            <Tile
              href={`${base}/notices`}
              icon="mdi:bell-outline"
              label="Notices"
            />
            <Tile
              href={`${base}/events`}
              icon="mdi:calendar-check-outline"
              label="Event feeds"
            />
            <Tile
              href={
                data?.library.path ??
                `/libraries?q=${encodeURIComponent(library.slug)}`
              }
              icon="mdi:eye-outline"
              label="Public page"
            />
            <Tile
              href="/contribute/index/new"
              icon="mdi:map-marker-plus-outline"
              label="Add a library"
            />
            <Tile
              href={`${base}/traffic`}
              icon="mdi:chart-bar"
              label="Traffic"
              tag={trafficCovered ? undefined : "Team"}
            />
            <Tile
              href={`${base}/team`}
              icon="mdi:account-group-outline"
              label="Team"
              tag={teamCovered ? undefined : "Team"}
            />
            {organises ? (
              <Tile
                href="/staff/team"
                icon="mdi:account-multiple-plus-outline"
                label="Team organiser"
              />
            ) : null}
          </div>
        </section>

        {featuredDrive ? (
          <section aria-labelledby="staff-drawer-featured-drive-h">
            <h3
              id="staff-drawer-featured-drive-h"
              className="m-0 mb-2.5 text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Featured drive
            </h3>
            <DrawerLinkCard
              href={driveHref(featuredDrive.slug)}
              title={featuredDrive.title}
            />
          </section>
        ) : null}

        <section aria-labelledby="staff-drawer-drives-h">
          <h3
            id="staff-drawer-drives-h"
            className="m-0 mb-2.5 text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            Drives that include your library
          </h3>
          <div aria-live="polite">
            {data?.drives.length ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.drives.map((drive) => (
                  <li key={drive.slug}>
                    <DrawerLinkCard
                      href={`/community/drives/${drive.slug}`}
                      title={drive.title}
                      description={
                        drive.need
                          ? `Your library needs: ${drive.need}`
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 px-1 text-[13px]" style={{ color: T.ink.dim }}>
                {data
                  ? "No open drive includes it right now."
                  : "Checking drives…"}
              </p>
            )}
          </div>
          <Link
            href="/community"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            All drives
          </Link>
        </section>
      </div>
    </Drawer>
  )
}
