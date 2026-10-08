import {
  addDays,
  dayRoute,
  GAPS,
  type DriveFocus,
  type DriveLibrary,
  type DriveScope,
  type GapKey,
  libraryInScope,
  localDateTime,
  type MobileTimetable,
  normalizeMobileTimetable,
  type PublicLiveState,
  toMinutes,
} from "@repo/shared-data"

import { StaffError } from "./service"
import { noticesForLibrary } from "../../../utils/library-notices"

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"
/** How far ahead the drawer looks for a Mobile library's next route. */
const NEXT_ROUTE_DAYS = 60
const MAX_DRIVES = 5
const LIVE_KINDS = new Set(["here", "road", "late"])

export type DrawerLive = {
  state: "off" | "idle" | "live"
  nextRoute: { date: string; time: string } | null
  currentStop: string | null
}

export type DrawerResponse = {
  library: {
    documentId: string
    name: string
    slug: string
    path: string
    libraryType: string
    role: string
  }
  suggestions: number
  noticesUpcoming: number
  live: DrawerLive | null
  drives: { slug: string; title: string; need: string | null }[]
}

/**
 * The next visit after `now` in the library's zone, over the whole
 * timetable (up to `NEXT_ROUTE_DAYS` ahead), as the ISO date and its
 * arrival time. Today's visits that have already begun are skipped, so at
 * 21:20 a route that started at 09:30 points at the 22:30 stop or at
 * tomorrow, never at the morning.
 */
export function nextRouteOf(
  tt: MobileTimetable,
  notices: Parameters<typeof dayRoute>[1],
  now: Date,
  tz: string
): { date: string; time: string } | null {
  const local = localDateTime(now, tz)
  for (let i = 0; i <= NEXT_ROUTE_DAYS; i++) {
    const date = addDays(local.date, i)
    const upcoming = dayRoute(tt, notices, date)
      .filter(
        (v) => !v.cancelledBy && (i > 0 || toMinutes(v.arrive) > local.minute)
      )
      .sort((a, b) => toMinutes(a.arrive) - toMinutes(b.arrive))
    if (upcoming.length === 0) continue

    return { date, time: upcoming[0]!.arrive }
  }

  return null
}

/** What this drive asks of this library, as a lower-case phrase. */
export function driveNeed(
  focus: DriveFocus | null | undefined,
  libraryGaps: readonly GapKey[]
): string | null {
  if (!focus) return null
  if (focus.kind === "gaps") {
    const gap = focus.gaps.find((g) => libraryGaps.includes(g))

    return gap ? (GAPS.find((g) => g.key === gap)?.phrase ?? gap) : null
  }
  if (focus.kind === "verify")
    return `a fresh check of its ${focus.sections.join(", ")}`

  return "a more complete record"
}

export default ({ strapi }: { strapi: any }) => ({
  async countSuggestions(user: string, id: string): Promise<number> {
    return strapi.documents(SUBMISSION).count({
      filters: {
        targetDocumentId: { $eq: id },
        submissionType: { $eq: "correction" },
        status: { $eq: "pending" },
        submittedByUserId: { $ne: user },
      },
    })
  },

  async countNotices(id: string): Promise<number> {
    try {
      return (
        (await strapi
          .plugin("library-staff")
          .service("notices")
          ?.countUpcoming(id)) ?? 0
      )
    } catch {
      return 0
    }
  },

  /**
   * The Mobile library's live state from the `mobile-libraries` plugin's
   * public read (optional: null when the plugin or timetable is missing),
   * plus the next route from the timetable.
   */
  async live(lib: any): Promise<DrawerLive | null> {
    if (lib.libraryType !== "Mobile") return null
    const tt = normalizeMobileTimetable(lib.mobileTimetable)
    const tz = lib.timezone ?? "UTC"
    const now = new Date()
    let state: PublicLiveState | null = null
    try {
      const result = await strapi
        .plugin("mobile-libraries")
        ?.service("live")
        ?.public?.([lib.documentId])
      state = result?.states?.[0] ?? null
    } catch {
      state = null
    }
    const isLive = !!state && state.sharesLive && LIVE_KINDS.has(state.kind)
    const notices = await noticesForLibrary(strapi, lib.documentId)

    return {
      state: !state || !state.sharesLive ? "off" : isLive ? "live" : "idle",
      nextRoute: tt ? nextRouteOf(tt, notices, now, tz) : null,
      currentStop:
        isLive && state?.stopId && tt
          ? (tt.stops.find((s) => s.id === state!.stopId)?.name ?? null)
          : null,
    }
  },

  /** Open drives whose scope includes this library, pinned first. */
  async drives(
    lib: any
  ): Promise<{ slug: string; title: string; need: string | null }[]> {
    let rows: Record<string, any>[] = []
    try {
      rows = await strapi.service("api::drive.drive").listPublic("open", 50)
    } catch {
      return []
    }
    const driveLib: DriveLibrary = {
      documentId: lib.documentId,
      continent: lib.continent?.slug ?? null,
      country: lib.country?.slug ?? null,
      region: lib.region?.slug ?? null,
      area: lib.area?.slug ?? null,
      libraryType: lib.libraryType ?? null,
      source: lib.source ?? null,
      completeness: lib.completeness ?? null,
      createdAt: lib.createdAt ?? null,
      operationalStatus: lib.operationalStatus ?? null,
    }
    const gaps: GapKey[] = Array.isArray(lib.gaps) ? lib.gaps : []

    return rows
      .filter(
        (row) =>
          row.scope &&
          libraryInScope(driveLib, row.scope as DriveScope, row.openedAt)
      )
      .slice(0, MAX_DRIVES)
      .map((row) => ({
        slug: String(row.slug),
        title: String(row.title),
        need: driveNeed(row.focus as DriveFocus, gaps),
      }))
  },

  async get(user: string, id: string): Promise<DrawerResponse> {
    const member = await strapi
      .plugin("library-staff")
      .service("staff")
      .authorise(user, id, "seeTeam")
    const lib = await strapi.documents(LIBRARY).findOne({
      documentId: id,
      status: "published",
      fields: [
        "documentId",
        "name",
        "slug",
        "libraryType",
        "mobileTimetable",
        "timezone",
        "operationalStatus",
        "source",
        "completeness",
        "createdAt",
        "gaps",
      ],
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["slug"] },
        area: { fields: ["slug"] },
      },
    })
    if (!lib) throw new StaffError(404, "not_found")
    const [suggestions, noticesUpcoming, live, drives] = await Promise.all([
      this.countSuggestions(user, id),
      this.countNotices(id),
      this.live(lib),
      this.drives(lib),
    ])
    const path = [
      lib.continent?.slug,
      lib.country?.slug,
      lib.region?.slug,
      lib.slug,
    ]
      .filter(Boolean)
      .join("/")

    return {
      library: {
        documentId: id,
        name: lib.name,
        slug: lib.slug,
        path: `/${path}`,
        libraryType: lib.libraryType,
        role: member.staffRole,
      },
      suggestions,
      noticesUpcoming,
      live,
      drives,
    }
  },
})
