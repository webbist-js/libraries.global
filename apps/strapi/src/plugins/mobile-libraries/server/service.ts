import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

import {
  libraryTypeName,
  cycleWeekOf,
  dayRoute,
  localDateTime,
  normalizeMobileTimetable,
  publicLiveState,
  snapToGrid,
  toMinutes,
  type LiveEndReason,
  type LiveSessionSnapshot,
  type TimetableNotice,
  noticeMatches,
  checkText,
  emailTemplate,
  isSupportedLocale,
  DEFAULT_LOCALE,
} from "@repo/shared-data"

import {
  distanceKm,
  foldEvents,
  inRouteCorridor,
  localInstant,
  type LiveEvent,
} from "./domain"
import { claimAffiliationFilter } from "../../../utils/affiliations"
import {
  noticesForLibraries,
  noticesForLibrary,
} from "../../../utils/library-notices"
import { requireStaffMember } from "../../../utils/staff"
import { emailConfigured } from "../../content-moderation/server/utils/email-config"

export const SETTING = "plugin::mobile-libraries.live-setting"
export const SESSION = "plugin::mobile-libraries.live-session"
export const EVENT = "plugin::mobile-libraries.live-event"
export class LiveError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code)
  }
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex")
/** Hex digests compared in constant time (2.14). */
const hashesMatch = (hash: string, stored: unknown) =>
  typeof stored === "string" &&
  stored.length === hash.length &&
  timingSafeEqual(Buffer.from(hash), Buffer.from(stored))
const CLOSED_STATUSES = new Set([
  "temporarily_closed",
  "permanently_closed",
  "planned",
])
/** A phone this far ahead of the server is clamped to now; further is refused. */
const EVENT_SKEW_MS = 2 * 60_000
const EVENT_MAX_AGE_MS = 10 * 60_000
const SESSION_CAP_MS = 12 * 60 * 60_000
const EVENT_TYPES = new Set(["arrived", "left", "delay", "skip", "not_running"])
/** The 12-hour cap ends a session as `expired`; the route's end as `auto`. */
const timedOutReason = (s: any): LiveEndReason =>
  Date.parse(s.endsAt) - Date.parse(s.startedAt) >= SESSION_CAP_MS - 1000
    ? "expired"
    : "auto"
/** The crew's reason ("Breakdown" or "Weather: flooding") as a notice reason and message. */
function breakdownNotice(raw: string): { reason: string; message: string } {
  const [label = "", ...rest] = raw.split(":")
  const key = label.trim().toLowerCase()
  const known = ["breakdown", "weather", "staffing", "other"].includes(key)
  // "Weather: flooding" names a reason; plain text is the message itself.
  const message = (known ? rest.join(":") : raw).trim()

  return {
    reason: known && key !== "other" ? key : "other",
    message:
      message || "This mobile library is not running for the rest of today.",
  }
}
const defaults = {
  enabled: false,
  precision: "stops",
  autoStopMinutes: 30,
  enabledAt: null,
}
const idPattern = /^[a-z0-9]{20,32}$/i
/**
 * A live event as a row. The event's `id` is the fold key (`"start"`, the
 * phone's own id), never a row id: Strapi passes `data.id` straight to the
 * insert, where Postgres refuses it. It travels in `eventKey` instead.
 */
function eventRow(e: LiveEvent, sessionId: string) {
  const { id, ...rest } = e

  return {
    ...rest,
    session: sessionId,
    sessionDocumentId: sessionId,
    eventKey: `${sessionId}:${id}`,
  }
}
const enabled = () => process.env.MOBILE_LIVE_ENABLED !== "false"

/** Both servers check the same signed proof. Bridge callers cannot invent its expiry. */
export function verifyLiveProof(
  proof: unknown,
  userId: string,
  baSessionId: unknown,
  now = Date.now()
): boolean {
  if (typeof proof !== "string" || typeof baSessionId !== "string") return false
  const [body, sig, extra] = proof.split(".")
  const secret = process.env.MOBILE_LIVE_STEPUP_SECRET
  if (!body || !sig || extra || !secret) return false
  const hash = createHmac("sha256", secret).update(body).digest("base64url")
  if (
    sig.length !== hash.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(hash))
  )
    return false
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString())

    return (
      p.userId === userId &&
      p.sessionId === baSessionId &&
      Number.isFinite(p.expiresAt) &&
      p.expiresAt > now &&
      p.expiresAt <= now + 12 * 60 * 60_000 + 60_000
    )
  } catch {
    return false
  }
}

export default ({ strapi }: { strapi: any }) => {
  async function transaction<T>(
    key: string,
    work: () => Promise<T>
  ): Promise<T> {
    return strapi.db.transaction(async ({ trx }: any) => {
      if (trx?.raw)
        await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
          `staff-library:${key}`,
        ])

      return work()
    })
  }
  async function authorise(
    userId: string,
    id: string,
    action: "goLive" | "manageLive" | "seeTeam" = "goLive"
  ) {
    if (!idPattern.test(id)) throw new LiveError(400, "invalid_id")
    if (!(await requireStaffMember(strapi, userId, id, action)))
      throw new LiveError(403, "staff_access_removed")
    const library = await strapi.documents("api::library.library").findOne({
      populate: { libraryType: { fields: ["name"] } },
      documentId: id,
      status: "published",
      fields: [
        "documentId",
        "name",
        "mobileTimetable",
        "timezone",
        "location",
        "operationalStatus",
      ],
    })
    if (!library || libraryTypeName(library.libraryType) !== "Mobile")
      throw new LiveError(404, "not_mobile")
    if (
      action === "goLive" &&
      ["temporarily_closed", "permanently_closed", "planned"].includes(
        library.operationalStatus
      )
    )
      throw new LiveError(409, "service_ended")

    return library
  }
  async function profileName(userId: string) {
    const p = (
      await strapi.documents("api::user-profile.user-profile").findMany({
        filters: { baUserId: userId },
        fields: ["firstName", "lastName"],
        limit: 1,
      })
    )[0]

    return (
      [p?.firstName, p?.lastName].filter(Boolean).join(" ") || "Library staff"
    )
  }
  async function setting(id: string) {
    return (
      (
        await strapi
          .documents(SETTING)
          .findMany({ filters: { libraryDocumentId: id }, limit: 1 })
      )[0] ?? defaults
    )
  }
  async function checkLive(
    userId: string,
    id: string,
    proof?: unknown,
    baSessionId?: unknown,
    requireProof = true
  ) {
    if (!enabled()) throw new LiveError(503, "live_disabled")
    const library = await authorise(userId, id)
    const settings = await setting(id)
    if (!settings.enabled) throw new LiveError(403, "sharing_off")
    if (requireProof && !verifyLiveProof(proof, userId, baSessionId))
      throw new LiveError(401, "confirmation_required")

    return { library, settings }
  }
  async function audit(
    userId: string,
    id: string,
    action: string,
    detail: unknown
  ) {
    await strapi.documents("plugin::library-staff.staff-audit").create({
      data: {
        library: id,
        actor: userId,
        action,
        detail,
        at: new Date().toISOString(),
      },
    })
  }
  async function events(id: string) {
    return strapi.documents(EVENT).findMany({
      filters: { sessionDocumentId: id },
      sort: ["clientAt:asc", "eventKey:asc"],
      limit: 201,
    })
  }
  async function getSession(id: string) {
    const s = await strapi.documents(SESSION).findOne({ documentId: id })
    if (!s) throw new LiveError(404, "session_not_found")

    return s
  }
  async function active(id: string) {
    return (
      (
        await strapi.documents(SESSION).findMany({
          filters: { libraryDocumentId: id, status: "active" },
          limit: 1,
        })
      )[0] ?? null
    )
  }
  async function end(s: any, reason: LiveEndReason) {
    if (s.status !== "active") return s
    const now = new Date().toISOString()
    if ((await events(s.documentId)).length < 200)
      await strapi.documents(EVENT).create({
        data: {
          session: s.documentId,
          sessionDocumentId: s.documentId,
          eventKey: `${s.documentId}:end`,
          type: "end",
          reason,
          at: now,
          clientAt: now,
        },
      })
    await strapi.documents(SESSION).update({
      documentId: s.documentId,
      data: {
        status: "ended",
        endReason: reason,
        endedAt: now,
        tokenHash: null,
        position: null,
        state: { ...s.state, phase: "ended", lastEventAt: now },
      },
    })

    return {
      ...s,
      status: "ended",
      endReason: reason,
      endedAt: now,
      position: null,
      state: { ...s.state, phase: "ended", lastEventAt: now },
    }
  }
  function privateSnapshot(s: any) {
    if (!s) return null

    return {
      id: s.documentId,
      libraryDocumentId: s.libraryDocumentId,
      status: s.status,
      mode: s.mode,
      serviceDate: s.serviceDate,
      cycleWeek: s.cycleWeek,
      day: s.day,
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      endedAt: s.endedAt,
      endReason: s.endReason,
      state: s.state,
      route: s.route,
      positionStatus: s.position?.hidden ?? null,
    }
  }
  async function sessionAccess(
    userId: string,
    id: string,
    token: unknown,
    proof?: unknown,
    baSessionId?: unknown,
    requireProof = true
  ) {
    const s = await getSession(id)
    const ctx = await checkLive(
      userId,
      s.libraryDocumentId,
      proof,
      baSessionId,
      requireProof
    )
    if (s.startedBy !== userId) throw new LiveError(403, "not_session_owner")
    if (s.status !== "active")
      throw new LiveError(
        409,
        s.endReason === "revoked"
          ? "staff_access_removed"
          : s.endReason === "takeover"
            ? "session_taken_over"
            : "session_ended"
      )
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !hashesMatch(tokenHash(token), s.tokenHash)
    )
      throw new LiveError(409, "session_taken_over")
    // The sweep owns ending expired sessions under the library lock. Access checks
    // are read-only, so a rejected write cannot race an ending or roll it back.
    if (Date.parse(s.endsAt) <= Date.now())
      throw new LiveError(409, "session_ended")

    return { ...ctx, session: s }
  }
  async function notices(id: string): Promise<TimetableNotice[]> {
    return noticesForLibrary(strapi, id)
  }
  const api = {
    async settings(userId: string, id: string) {
      const library = await authorise(userId, id, "seeTeam")
      const [settings, live, ttNotices] = await Promise.all([
        setting(id),
        active(id),
        notices(id),
      ])
      const tt = normalizeMobileTimetable(library.mobileTimetable)
      const today = localDateTime(new Date(), library.timezone ?? "UTC").date

      return {
        settings: {
          enabled: settings.enabled,
          precision: settings.precision,
          autoStopMinutes: settings.autoStopMinutes,
          enabledAt: settings.enabledAt,
        },
        library: {
          id,
          name: library.name,
          timezone: library.timezone ?? "UTC",
          timetable: tt,
        },
        route: tt
          ? dayRoute(tt, ttNotices, today).filter((v) => !v.cancelledBy)
          : [],
        activeSession: live
          ? {
              ...privateSnapshot(live),
              startedByName: await profileName(live.startedBy),
            }
          : null,
        liveEnabled: enabled(),
      }
    },
    async updateSettings(userId: string, id: string, input: any) {
      await authorise(userId, id, "manageLive")
      if (
        (input.enabled !== undefined && typeof input.enabled !== "boolean") ||
        (input.precision !== undefined &&
          !["stops", "approximate"].includes(input.precision)) ||
        (input.autoStopMinutes !== undefined &&
          ![15, 30, 60].includes(input.autoStopMinutes))
      )
        throw new LiveError(400, "invalid_settings")
      const result = await transaction(id, async () => {
        await authorise(userId, id, "manageLive")
        const old = await setting(id)
        if (
          input.enabled === true &&
          !old.enabled &&
          input.privacyAccepted !== true
        )
          throw new LiveError(400, "privacy_confirmation_required")
        const data: any = Object.fromEntries(
          ["enabled", "precision", "autoStopMinutes"]
            .filter((key) => input[key] !== undefined)
            .map((key) => [key, input[key]])
        )
        if (input.enabled === true && !old.enabled) {
          data.enabledBy = userId
          data.enabledAt = new Date().toISOString()
        }
        await (old.documentId
          ? strapi
              .documents(SETTING)
              .update({ documentId: old.documentId, data })
          : strapi.documents(SETTING).create({
              data: {
                ...defaults,
                ...data,
                library: id,
                libraryDocumentId: id,
              },
            }))
        if (input.enabled === false || input.precision === "stops") {
          const s = await active(id)
          if (s) {
            await (input.enabled === false
              ? end(s, "revoked")
              : strapi.documents(SESSION).update({
                  documentId: s.documentId,
                  data: { mode: "checkins", position: null },
                }))
          }
        }
        await audit(userId, id, "live_settings_changed", data)

        return api.settings(userId, id)
      })
      await strapi
        .plugin("mobile-libraries")
        ?.service("stop-index")
        ?.reindexLibrary(id)

      return result
    },
    async start(
      userId: string,
      input: any,
      proof: unknown,
      baSessionId: unknown,
      takeover = false
    ) {
      const id = input.libraryDocumentId
      if (typeof id !== "string" || !idPattern.test(id))
        throw new LiveError(400, "invalid_id")

      return transaction(id, async () => {
        const { library, settings } = await checkLive(
          userId,
          id,
          proof,
          baSessionId
        )
        const tt = normalizeMobileTimetable(library.mobileTimetable)
        if (!tt) throw new LiveError(409, "no_timetable")
        if (
          !["checkins", "approximate"].includes(input.mode) ||
          (input.mode === "approximate" && settings.precision !== "approximate")
        )
          throw new LiveError(400, "invalid_mode")
        const now = new Date(),
          local = localDateTime(now, library.timezone ?? "UTC")
        const routeDate =
          typeof input.routeDate === "string" ? input.routeDate : local.date
        // A swapped route may be selected from this cycle, but the session belongs to today.
        const dayDelta =
          (Date.parse(`${routeDate}T00:00:00Z`) -
            Date.parse(`${local.date}T00:00:00Z`)) /
          86_400_000
        if (
          !Number.isInteger(dayDelta) ||
          Math.abs(dayDelta) > tt.cycle.weeks * 7
        )
          throw new LiveError(400, "invalid_route")
        const activeNotices = await notices(id)
        const route = dayRoute(tt, activeNotices, routeDate)
          .filter(
            (v) =>
              !v.cancelledBy &&
              !activeNotices.some(
                (n) =>
                  n.type === "not_running" &&
                  noticeMatches(
                    tt,
                    tt.visits.find((visit) => visit.id === v.visitId)!,
                    local.date,
                    n
                  )
              )
          )
          .map((v) => ({ ...v, date: local.date }))
        if (!route.length) throw new LiveError(409, "no_route_today")
        const endsAt = new Date(
          Math.min(
            now.getTime() + 12 * 60 * 60_000,
            localInstant(
              local.date,
              toMinutes(route.at(-1)!.depart) + settings.autoStopMinutes,
              library.timezone ?? "UTC"
            ).getTime()
          )
        )
        if (endsAt <= now) throw new LiveError(409, "route_already_finished")
        const old = await active(id)
        if (old && !takeover) throw new LiveError(409, "already_live")
        if (old) await end(old, "takeover")
        const token = randomBytes(32).toString("hex")
        const firstEvent: LiveEvent = {
          id: "start",
          type: "start",
          stopId: null,
          delayMin: 0,
          reason: "",
          at: now.toISOString(),
          clientAt: now.toISOString(),
        }
        const state = foldEvents(route, [firstEvent], library.timezone ?? "UTC")
        const s = await strapi.documents(SESSION).create({
          data: {
            library: id,
            libraryDocumentId: id,
            startedBy: userId,
            status: "active",
            mode: input.mode,
            serviceDate: local.date,
            cycleWeek: cycleWeekOf(tt, routeDate),
            day: local.weekday,
            startedAt: now.toISOString(),
            endsAt: endsAt.toISOString(),
            tokenHash: tokenHash(token),
            state,
            route,
            position: null,
          },
        })
        await strapi.documents(EVENT).create({
          data: eventRow(firstEvent, s.documentId),
        })

        return { session: privateSnapshot(s), token }
      })
    },
    async resume(
      userId: string,
      id: string,
      token: unknown,
      proof: unknown,
      baSessionId: unknown
    ) {
      const { session } = await sessionAccess(
        userId,
        id,
        token,
        proof,
        baSessionId
      )

      return { session: privateSnapshot(session) }
    },
    async append(
      userId: string,
      id: string,
      token: unknown,
      input: any,
      proof: unknown,
      baSessionId: unknown
    ) {
      const initial = await sessionAccess(userId, id, token, proof, baSessionId)

      return transaction(initial.session.libraryDocumentId, async () => {
        const { session: s, library } = await sessionAccess(
          userId,
          id,
          token,
          proof,
          baSessionId
        )
        if (
          !Array.isArray(input.events) ||
          input.events.length < 1 ||
          input.events.length > 50
        )
          throw new LiveError(400, "invalid_events")
        const old = await events(id)
        const known = new Set(old.map((e: any) => e.eventKey))
        const now = new Date(),
          accepted: LiveEvent[] = [],
          rejected: { id: string | null; code: string }[] = []
        // One bad check-in is refused on its own; the rest of the batch lands.
        const validate = (e: any): { event: LiveEvent } | { code: string } => {
          if (
            !e ||
            typeof e.id !== "string" ||
            !/^[a-zA-Z0-9-]{8,64}$/.test(e.id) ||
            !EVENT_TYPES.has(e.type)
          )
            return { code: "invalid_event" }
          const parsed = Date.parse(e.clientAt)
          if (
            !Number.isFinite(parsed) ||
            parsed < Date.parse(s.startedAt) ||
            parsed > now.getTime() + EVENT_SKEW_MS ||
            now.getTime() - parsed > EVENT_MAX_AGE_MS
          )
            return { code: "event_too_old" }
          if (
            ["arrived", "left", "skip"].includes(e.type) &&
            !s.route.some((v: any) => v.stopId === e.stopId)
          )
            return { code: "stop_not_on_route" }
          if (e.type === "delay" && ![0, 5, 10, 15, 30].includes(e.delayMin))
            return { code: "invalid_delay" }
          const reason = typeof e.reason === "string" ? e.reason.trim() : ""
          if (
            reason.length > 280 ||
            (reason && Boolean(checkText(reason, [library.name ?? ""])))
          )
            return { code: "unsafe_message" }

          return {
            event: {
              id: e.id,
              type: e.type,
              stopId: e.stopId ?? null,
              delayMin: e.delayMin ?? 0,
              reason,
              clientAt: new Date(Math.min(parsed, now.getTime())).toISOString(),
              at: now.toISOString(),
            },
          }
        }
        for (const e of input.events) {
          const result = validate(e)
          if ("code" in result) {
            rejected.push({
              id: typeof e?.id === "string" ? e.id : null,
              code: result.code,
            })
            continue
          }
          const key = `${id}:${result.event.id}`
          if (known.has(key)) continue
          known.add(key)
          accepted.push(result.event)
        }
        if (old.length + accepted.length > 199)
          throw new LiveError(429, "event_limit")
        for (const e of accepted)
          await strapi.documents(EVENT).create({ data: eventRow(e, id) })
        const all = [
          ...old.map((e: any) => ({ ...e, id: e.eventKey })),
          ...accepted.map((e) => ({ ...e, id: `${id}:${e.id}` })),
        ]
        const state = foldEvents(s.route, all, library.timezone ?? "UTC")
        await strapi.documents(SESSION).update({
          documentId: id,
          data: {
            state,
            ...(state.phase === "at_stop" ? { position: null } : {}),
          },
        })
        if (accepted.some((e) => e.type === "not_running")) {
          const e = accepted.find((e) => e.type === "not_running")!
          const noticeService = strapi
            .plugin("library-staff")
            ?.service("notices")
          if (!noticeService?.createNotice)
            throw new LiveError(503, "notice_service_unavailable")
          // The notice carries the crew's reason and covers today's service
          // only: it ends with the route's last departure (the service date).
          const notice = breakdownNotice(e.reason)
          await noticeService.createNotice({
            baUserId: userId,
            libraryDocumentId: s.libraryDocumentId,
            source: "live",
            type: "not_running",
            scope: "service",
            from: s.serviceDate,
            to: s.serviceDate,
            message: notice.message,
            reason: notice.reason,
          })

          return {
            session: privateSnapshot(await end({ ...s, state }, "breakdown")),
            noticePosted: true,
            rejected,
          }
        }

        return {
          session: privateSnapshot({
            ...s,
            state,
            ...(state.phase === "at_stop" ? { position: null } : {}),
          }),
          rejected,
        }
      })
    },
    async position(
      userId: string,
      id: string,
      token: unknown,
      input: any,
      proof: unknown,
      baSessionId: unknown
    ) {
      const initial = await sessionAccess(userId, id, token, proof, baSessionId)

      return transaction(initial.session.libraryDocumentId, async () => {
        const { session: s, library } = await sessionAccess(
          userId,
          id,
          token,
          proof,
          baSessionId
        )
        if (s.mode !== "approximate")
          throw new LiveError(400, "position_not_enabled")
        if (s.state.phase !== "between") return { positionStatus: "at_stop" }
        if (
          !Number.isFinite(input.lat) ||
          !Number.isFinite(input.lng) ||
          Math.abs(input.lat) > 90 ||
          Math.abs(input.lng) > 180
        )
          throw new LiveError(400, "invalid_position")
        const now = Date.now(),
          prev = s.position?.latest ?? s.position?.pending
        if (
          s.position?.receivedAt &&
          now - Date.parse(s.position.receivedAt) < 25_000
        )
          throw new LiveError(429, "position_rate")
        const cell = {
          ...snapToGrid(input.lat, input.lng),
          at: new Date(now).toISOString(),
        }
        if (
          prev &&
          distanceKm(prev, cell) / ((now - Date.parse(prev.at)) / 3_600_000) >
            130
        ) {
          if ((await events(id)).length < 199)
            await strapi.documents(EVENT).create({
              data: {
                session: id,
                sessionDocumentId: id,
                eventKey: `${id}:speed:${now}`,
                type: "delay",
                at: cell.at,
                clientAt: cell.at,
                delayMin: s.state.delayMin,
                flagged: "speed",
              },
            })
          await strapi.documents(SESSION).update({
            documentId: id,
            data: { position: { ...s.position, receivedAt: cell.at } },
          })

          return { positionStatus: "speed_rejected" }
        }
        const tt = normalizeMobileTimetable(library.mobileTimetable)
        const pins = s.route.flatMap(
          (v: any) =>
            tt?.stops.find((stop) => stop.id === v.stopId)?.location ?? []
        )
        const near = inRouteCorridor(
          { lat: input.lat, lng: input.lng },
          pins,
          library.location ?? null
        )
        const pending = s.position?.pending
        const mature = pending && now - Date.parse(pending.at) >= 60_000
        const published = near
          ? mature
            ? pending
            : (s.position?.published ?? null)
          : null
        await strapi.documents(SESSION).update({
          documentId: id,
          data: {
            position: {
              receivedAt: cell.at,
              pending: near ? (mature || !pending ? cell : pending) : null,
              latest: near ? cell : null,
              published,
              hidden: near ? null : "far_from_route",
            },
            state: { ...s.state, lastEventAt: cell.at },
          },
        })

        return { positionStatus: near ? "sharing" : "far_from_route" }
      })
    },
    async end(userId: string, id: string, token: unknown) {
      const { session: s } = await sessionAccess(
        userId,
        id,
        token,
        undefined,
        undefined,
        false
      )

      return transaction(s.libraryDocumentId, async () => {
        const current = await sessionAccess(
          userId,
          id,
          token,
          undefined,
          undefined,
          false
        )

        return {
          session: privateSnapshot(await end(current.session, "manual")),
        }
      })
    },
    async log(userId: string, id: string) {
      const logLibrary = await authorise(userId, id, "seeTeam")
      const rows = await strapi.documents(SESSION).findMany({
        filters: {
          libraryDocumentId: id,
          startedAt: {
            $gte: new Date(Date.now() - 90 * 86_400_000).toISOString(),
          },
        },
        sort: "startedAt:desc",
        limit: 200,
      })

      return {
        sessions: await Promise.all(
          rows.map(async (s: any) => {
            const es = await events(s.documentId)

            return {
              ...privateSnapshot(s),
              startedByName: await profileName(s.startedBy),
              checkIns:
                foldEvents(
                  s.route,
                  es.map((e: any) => ({ ...e, id: e.eventKey })),
                  logLibrary.timezone ?? "UTC"
                ).arrivals?.length ?? 0,
              totalStops: s.route.length,
              flags: es.flatMap((e: any) => (e.flagged ? [e.flagged] : [])),
            }
          })
        ),
      }
    },
    async public(ids: string[]) {
      const now = new Date()
      const unique = [...new Set(ids)]
      if (!unique.length) return { states: [] }
      // One query each for the libraries, their live settings, today's
      // sessions and their notices, instead of four per id (1.5).
      const libraries = (
        (await strapi.documents("api::library.library").findMany({
          populate: { libraryType: { fields: ["name"] } },
          filters: { documentId: { $in: unique } },
          status: "published",
          fields: [
            "documentId",
            "mobileTimetable",
            "timezone",
            "operationalStatus",
          ],
          limit: unique.length,
        })) as any[]
      ).flatMap((library) => {
        const tt = normalizeMobileTimetable(library.mobileTimetable)

        return tt &&
          libraryTypeName(library.libraryType) === "Mobile" &&
          !CLOSED_STATUSES.has(library.operationalStatus)
          ? [
              {
                library,
                tt,
                local: localDateTime(now, library.timezone ?? "UTC"),
              },
            ]
          : []
      })
      if (!libraries.length) return { states: [] }
      const mobileIds = libraries.map(({ library }) => library.documentId)
      const [settingRows, sessions, noticesByLibrary] = await Promise.all([
        strapi.documents(SETTING).findMany({
          filters: { libraryDocumentId: { $in: mobileIds } },
          limit: mobileIds.length,
        }) as Promise<any[]>,
        enabled()
          ? (strapi.documents(SESSION).findMany({
              filters: {
                libraryDocumentId: { $in: mobileIds },
                serviceDate: {
                  $in: [...new Set(libraries.map(({ local }) => local.date))],
                },
              },
              sort: "startedAt:desc",
              limit: Math.min(1000, mobileIds.length * 20),
            }) as Promise<any[]>)
          : Promise.resolve([] as any[]),
        noticesForLibraries(strapi, mobileIds, now),
      ])
      const settingsOf = new Map(
        settingRows.map((row) => [row.libraryDocumentId, row])
      )

      return {
        states: libraries.flatMap(({ library, tt, local }) => {
          const id = library.documentId
          const settings = settingsOf.get(id) ?? defaults
          // Newest first, so the first match is today's latest session.
          const s = sessions.find(
            (row) =>
              row.libraryDocumentId === id && row.serviceDate === local.date
          )
          const position =
            s?.position?.pending &&
            now.getTime() - Date.parse(s.position.pending.at) >= 60_000
              ? s.position.pending
              : s?.position?.published
          const timedOut =
            s?.status === "active" && Date.parse(s.endsAt) <= now.getTime()
          const snapshot: LiveSessionSnapshot | null = s
            ? {
                status: timedOut ? "ended" : s.status,
                endReason: timedOut ? timedOutReason(s) : (s.endReason ?? null),
                serviceDate: s.serviceDate,
                ...s.state,
                route: s.route,
                publishedPosition:
                  s.mode === "approximate" &&
                  settings.precision === "approximate" &&
                  !s.position?.hidden &&
                  s.status === "active" &&
                  !timedOut &&
                  s.state.phase === "between" &&
                  position
                    ? { lat: position.lat, lng: position.lng }
                    : null,
              }
            : null
          const state = publicLiveState({
            libraryDocumentId: id,
            tt,
            notices: noticesByLibrary.get(id) ?? [],
            session: snapshot,
            sharesLive: enabled() && settings.enabled,
            now,
            tz: library.timezone ?? "UTC",
          })

          return state ? [state] : []
        }),
      }
    },
    async revokeFor(userId: string, id: string) {
      return transaction(id, async () => {
        const s = await active(id)
        if (s?.startedBy === userId) await end(s, "revoked")
      })
    },
    async eraseFor(userId: string) {
      const rows = await strapi
        .documents(SESSION)
        .findMany({ filters: { startedBy: userId }, limit: 10000 })
      for (const s of rows) {
        await strapi.db
          .query(EVENT)
          .deleteMany({ where: { sessionDocumentId: s.documentId } })
        await strapi.documents(SESSION).delete({ documentId: s.documentId })
      }
      await strapi.db
        .query(SETTING)
        .updateMany({ where: { enabledBy: userId }, data: { enabledBy: null } })
    },
    async locked(userId: string) {
      const claims = await strapi
        .documents("api::library-affiliation.library-affiliation")
        .findMany({
          filters: claimAffiliationFilter(userId),
          populate: { library: { fields: ["documentId"] } },
          limit: 100,
        })
      for (const c of claims)
        if (c.library?.documentId)
          await audit(userId, c.library.documentId, "stepup_locked", {
            until: new Date(Date.now() + 15 * 60_000).toISOString(),
          })
    },
    async emailLink(userId: string, id: string, email: string, locale: string) {
      await authorise(userId, id, "seeTeam")
      const base = process.env.APP_PUBLIC_URL
      if (!base) throw new LiveError(503, "public_url_missing")
      if (!emailConfigured()) throw new LiveError(503, "email_unavailable")
      const language = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE
      const mobile = process.env.MOBILE_APP_URL
      const url = mobile
        ? `${mobile.replace(/\/$/, "")}${language === DEFAULT_LOCALE ? "" : `/${language}`}/${id}`
        : `${base}/${language}/live/${id}`
      await strapi
        .plugin("email")
        .service("email")
        .send({
          to: email,
          ...emailTemplate({
            postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
            siteUrl: process.env.APP_PUBLIC_URL,
            title: "Your mobile library live console",
            body: "Sign in on your phone, then confirm it is you before starting. This link does not sign you in.",
            url,
            action: "Open live console",
          }),
        })

      return { ok: true }
    },
    async sweep() {
      const rows = await strapi
        .documents(SESSION)
        .findMany({ filters: { status: "active" }, limit: 10000 })
      for (const s of rows)
        await transaction(s.libraryDocumentId, async () => {
          const current = await getSession(s.documentId)
          if (current.status !== "active") return
          if (!enabled()) await end(current, "kill_switch")
          else if (Date.parse(current.endsAt) <= Date.now())
            await end(current, timedOutReason(current))
          else {
            const library = await strapi
              .documents("api::library.library")
              .findOne({
                populate: { libraryType: { fields: ["name"] } },
                documentId: current.libraryDocumentId,
                status: "published",
                fields: ["operationalStatus"],
              })
            if (
              !library ||
              libraryTypeName(library.libraryType) !== "Mobile" ||
              ["temporarily_closed", "permanently_closed", "planned"].includes(
                library.operationalStatus
              ) ||
              !(await requireStaffMember(
                strapi,
                current.startedBy,
                current.libraryDocumentId,
                "goLive"
              )) ||
              !(await setting(current.libraryDocumentId)).enabled
            )
              await end(current, "revoked")
          }
        })
    },
    async prune() {
      const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString()
      await strapi.db
        .query(EVENT)
        .deleteMany({ where: { at: { $lt: cutoff } } })
      await strapi.db
        .query(SESSION)
        .deleteMany({ where: { status: "ended", startedAt: { $lt: cutoff } } })
    },
  }

  return api
}
