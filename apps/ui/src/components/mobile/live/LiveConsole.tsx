"use client"
import {
  addDays,
  cycleWeekOf,
  dayRoute,
  fromMinutes,
  localDateTime,
  publicLiveState,
  toMinutes,
} from "@repo/shared-data"
import { useCallback, useEffect, useRef, useState } from "react"

import { Sheet } from "@/components/ds/Sheet"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { applyQueuedCheckin } from "@/lib/mobile-live/optimistic"
import {
  clearLiveQueue,
  pruneOldQueues,
  clearSessionQueue,
  enqueueCheckin,
  queuedCheckins,
  removeCheckins,
} from "@/lib/mobile-live/queue"
import type {
  ConsoleEvent,
  ConsoleSession,
  LiveSettingsResponse,
} from "@/lib/mobile-live/types"
import { Link } from "@/lib/navigation"
import { shortDate, weekdayName } from "@/lib/staff/format"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { publicLiveCopy } from "../live-copy"
import { useMobileClock } from "../useMobileClock"
import { ConfirmIdentity, liveRequest } from "./ConfirmIdentity"
import {
  BeforeYouStartScreen,
  ConsoleLine,
  CurrentStopCard,
  DelayButtons,
  ExceptionButtons,
  FinishedScreen,
  LiveStatusStrip,
  NextStopCard,
  type ScreenStop,
  StopList,
} from "./LiveConsoleScreens"

const storageKey = (id: string) => `lg-live:${id}`
type ActionSheet = "skip" | "breakdown" | "end" | "route" | null

export function LiveConsole({
  initial,
  locale,
  role,
  canGoLive,
}: {
  readonly initial: LiveSettingsResponse
  readonly locale: string
  readonly role: string
  readonly canGoLive: boolean
}) {
  const id = initial.library.id,
    tt = initial.library.timetable
  const staffHref = useStaffLibraryHref(id)
  const [live, setLive] = useState<ConsoleSession | null>(null),
    [token, setToken] = useState<string | null>(null)
  const [startedElsewhere, setStartedElsewhere] = useState(
      Boolean(initial.activeSession)
    ),
    [confirm, setConfirm] = useState(false),
    [confirmed, setConfirmed] = useState(false)
  const [mode, setMode] = useState<"checkins" | "approximate">("checkins"),
    [online, setOnline] = useState(true),
    [visible, setVisible] = useState(true),
    [queued, setQueued] = useState(0)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [guard, setGuard] = useState("")
  const [sheet, setSheet] = useState<ActionSheet>(null),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState("")
  // The clock ticks after mount; until then the server's route (today's)
  // dates the screen, so the first render matches on both sides.
  const now = useMobileClock()
  const today = now
    ? localDateTime(now, initial.library.timezone).date
    : (initial.route[0]?.date ?? null)
  const [chosenDate, setRouteDate] = useState<string | null>(null)
  const routeDate = chosenDate ?? today
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    // The header menu is a `details`: close it on Escape or a click outside.
    const close = (e: Event) => {
      const el = menu.current
      if (!el?.open) return
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") {
          el.open = false
          el.querySelector("summary")?.focus()
        }

        return
      }
      if (!el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener("keydown", close)
    document.addEventListener("pointerdown", close)

    return () => {
      document.removeEventListener("keydown", close)
      document.removeEventListener("pointerdown", close)
    }
  }, [])
  /** "10:14" in the library's zone. */
  const clock = useCallback(
    (at: Date) =>
      fromMinutes(localDateTime(at, initial.library.timezone).minute),
    [initial.library.timezone]
  )
  const liveRef = useRef(live),
    tokenRef = useRef(token),
    flushing = useRef(false),
    resumeRef = useRef<{ id: string; token: string } | null>(null)
  liveRef.current = live
  tokenRef.current = token
  const route =
    live?.route ??
    (tt && routeDate
      ? dayRoute(tt, [], routeDate).filter((v) => !v.cancelledBy)
      : initial.route.filter((v) => !v.cancelledBy))
  const stopName = (stopId: string | null | undefined) =>
    tt?.stops.find((s) => s.id === stopId)?.name ?? "the next stop"
  const current = route.find((v) =>
      live?.state.currentVisitId
        ? v.visitId === live.state.currentVisitId
        : v.stopId === live?.state.currentStopId
    ),
    next =
      route.find(
        (v) =>
          (live?.state.nextVisitId
            ? v.visitId === live.state.nextVisitId
            : v.stopId === live?.state.nextStopId) &&
          v.visitId !== live?.state.currentVisitId &&
          !live?.state.completedVisitIds?.includes(v.visitId)
      ) ?? (!live ? route[0] : null)
  const preview =
    tt && now && today
      ? publicLiveCopy(
          publicLiveState({
            libraryDocumentId: id,
            tt,
            notices: [],
            session: null,
            sharesLive: initial.settings.enabled,
            now,
            tz: initial.library.timezone,
          }),
          tt,
          { today, now }
        )
      : null
  const autoStopAt = route.length
    ? fromMinutes(
        Math.min(
          1439,
          toMinutes(route.at(-1)!.depart) + initial.settings.autoStopMinutes
        )
      )
    : null
  const finished = live?.status === "ended"
  const active = live?.status === "active"
  const expected = (time: string) =>
    fromMinutes(Math.min(1439, toMinutes(time) + (live?.state.delayMin ?? 0)))

  const resume = useCallback(
    async (record: { id: string; token: string }) => {
      try {
        const result = await liveRequest<{ session: ConsoleSession }>(
          `/api/mobile/live/${record.id}`,
          undefined,
          record.token,
          "GET"
        )
        setLive(result.session)
        setToken(record.token)
        setStartedElsewhere(false)
        setConfirmed(true)
        resumeRef.current = null
        setError("")
      } catch (e) {
        const code = (e as Error).message
        if (code === "confirmation_required") {
          resumeRef.current = record
          setConfirm(true)
        } else {
          sessionStorage.removeItem(storageKey(id))
          setToken(null)
          setLive((previous) =>
            previous ? { ...previous, status: "ended", endReason: code } : null
          )
          setGuard(
            code === "staff_access_removed"
              ? "Your access to go live has been removed."
              : code === "session_taken_over"
                ? `Taken over by ${initial.activeSession?.startedByName ?? "another staff member"} at ${clock(new Date())}. This phone has stopped sharing.`
                : "Sharing from this phone has stopped. The route ended or another phone took over."
          )
          setStartedElsewhere(code === "session_taken_over")
        }
      }
    },
    [id, initial.activeSession?.startedByName, clock]
  )
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey(id))
      if (raw) void resume(JSON.parse(raw))
    } catch {
      sessionStorage.removeItem(storageKey(id))
    }
  }, [id, resume])
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine)
      setVisible(document.visibilityState === "visible")
    }
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    document.addEventListener("visibilitychange", update)

    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
      document.removeEventListener("visibilitychange", update)
    }
  }, [])

  const flush = useCallback(async () => {
    const s = liveRef.current,
      rawToken = tokenRef.current
    if (
      !s ||
      s.status !== "active" ||
      !rawToken ||
      !navigator.onLine ||
      document.visibilityState !== "visible" ||
      flushing.current
    )
      return
    flushing.current = true
    try {
      const all = await queuedCheckins(s.id)
      const stale = all.filter(
        (e) => Date.now() - Date.parse(e.clientAt) > 10 * 60_000
      )
      if (stale.length) {
        await removeCheckins(
          s.id,
          stale.map((e) => e.id)
        )
        setError(
          `${stale.length} check-ins were over 10 minutes old and could not be sent. Check the route before continuing.`
        )
      }
      const pending = all.filter((e) => !stale.includes(e)).slice(0, 50)
      if (pending.length) {
        const result = await liveRequest<{ session: ConsoleSession }>(
          `/api/mobile/live/${s.id}/events`,
          { events: pending },
          rawToken
        )
        await removeCheckins(
          s.id,
          pending.map((e) => e.id)
        )
        setLive(result.session)
        if (result.session.status === "ended") {
          sessionStorage.removeItem(storageKey(id))
          setToken(null)
          setConfirmed(false)
          await clearSessionQueue(s.id)
        }
      }
      setQueued((await queuedCheckins(s.id)).length)
    } catch (e) {
      const code = (e as Error).message
      if (code === "confirmation_required") {
        setConfirm(true)
        setConfirmed(false)
      } else if (
        [
          "staff_access_removed",
          "session_taken_over",
          "session_ended",
          "live_disabled",
          "sharing_off",
        ].includes(code)
      ) {
        setGuard(
          code === "staff_access_removed"
            ? `You can no longer go live for ${initial.library.name}.`
            : code === "session_taken_over"
              ? `Taken over by another staff member at ${clock(new Date())}. This phone has stopped sharing.`
              : "Sharing from this phone has stopped. The route ended or another phone took over."
        )
        setLive({ ...s, status: "ended", endReason: code })
        sessionStorage.removeItem(storageKey(id))
        setToken(null)
        await clearSessionQueue(s.id)
      } else if (navigator.onLine)
        setError("Check-ins could not be sent. They remain on this phone.")
    } finally {
      flushing.current = false
    }
  }, [id, initial.library.name, clock])
  useEffect(() => {
    if (!active) return
    void flush()
    const timer = setInterval(() => {
      void flush()
    }, 5000)

    return () => clearInterval(timer)
  }, [active, online, visible, flush])
  useEffect(() => {
    if (!active || !token || !liveRef.current) return
    const timer = setInterval(() => {
      if (
        !navigator.onLine ||
        document.visibilityState !== "visible" ||
        flushing.current
      )
        return
      resume({ id: liveRef.current!.id, token })
    }, 30_000)

    return () => clearInterval(timer)
  }, [active, live?.id, token, resume])

  useEffect(() => {
    if (!active || liveRef.current?.mode !== "approximate" || !visible) return
    let wake: WakeLockSentinel | undefined
    if ("wakeLock" in navigator)
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          wake = lock
        })
        .catch(() =>
          setGuard("Keep this screen open. Check-ins still work if it locks.")
        )

    return () => {
      wake?.release().catch(() => {})
    }
  }, [active, live?.mode, visible])
  useEffect(() => {
    if (
      !active ||
      liveRef.current?.mode !== "approximate" ||
      liveRef.current.state.phase !== "between" ||
      !visible ||
      !token
    )
      return
    if (!navigator.geolocation) {
      setGuard("Location is unavailable. Sharing check-ins only.")

      return
    }
    let last = 0
    // eslint-disable-next-line sonarjs/no-intrusive-permissions -- The crew explicitly chooses approximate mode before starting.
    const watch = navigator.geolocation.watchPosition(
      (fix) => {
        if (
          liveRef.current?.state.phase !== "between" ||
          Date.now() - last < 25_000
        )
          return
        last = Date.now()
        liveRequest<{ positionStatus: string }>(
          `/api/mobile/live/${liveRef.current.id}/position`,
          { lat: fix.coords.latitude, lng: fix.coords.longitude },
          token
        )
          .then((result) =>
            setGuard(
              result.positionStatus === "far_from_route"
                ? "Position hidden: you’re not near today’s route. Check-ins still work."
                : ""
            )
          )
          .catch((e) => {
            if ((e as Error).message === "confirmation_required")
              setConfirm(true)
          })
      },
      () => setGuard("Location is off. Sharing check-ins only."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    )

    return () => navigator.geolocation.clearWatch(watch)
  }, [active, live?.mode, live?.id, live?.state.phase, visible, token])

  async function start() {
    if (!confirmed) {
      setConfirm(true)

      return
    }
    setBusy(true)
    setError("")
    try {
      const result = await liveRequest<{
        session: ConsoleSession
        token: string
      }>(`/api/mobile/live/${startedElsewhere ? "takeover" : "start"}`, {
        libraryDocumentId: id,
        mode,
        routeDate,
      })
      setLive(result.session)
      setToken(result.token)
      sessionStorage.setItem(
        storageKey(id),
        JSON.stringify({ id: result.session.id, token: result.token })
      )
      setStartedElsewhere(false)
      setGuard("")
    } catch (e) {
      if ((e as Error).message === "confirmation_required") {
        setConfirm(true)
        setConfirmed(false)
      } else
        setError(
          (e as Error).message === "already_live"
            ? "Someone else has started this route. Reload to take over."
            : "The route could not start. Check that sharing is enabled and that the route has stops remaining today."
        )
    } finally {
      setBusy(false)
    }
  }
  async function checkin(
    type: ConsoleEvent["type"],
    stopId?: string,
    delayMin?: number,
    reasonText?: string
  ) {
    if (!live || !token || busy) return
    if ((live.state.eventCount ?? 1) + queued >= 199) {
      setError(
        "This route has reached its check-in limit. End the route to stop sharing."
      )

      return
    }
    setBusy(true)
    setError("")
    const event: ConsoleEvent = {
      id: crypto.randomUUID(),
      type,
      stopId,
      delayMin,
      reason: reasonText,
      clientAt: new Date().toISOString(),
    }
    try {
      await pruneOldQueues(live.id)
      await enqueueCheckin(live.id, event)
      setQueued((await queuedCheckins(live.id)).length)
      setLive(applyQueuedCheckin(live, event, initial.library.timezone))
      await flush()
      setSheet(null)
      setReason("")
      setMessage("")
    } catch {
      setError(
        "This phone could not save the check-in. Keep the console open and try again."
      )
    } finally {
      setBusy(false)
    }
  }
  async function endRoute() {
    if (!live || !token) return
    setBusy(true)
    try {
      await flush()
      const result = await liveRequest<{ session: ConsoleSession }>(
        `/api/mobile/live/${live.id}/end`,
        {},
        token
      )
      setLive(result.session)
      sessionStorage.removeItem(storageKey(id))
      setToken(null)
      setConfirmed(false)
      setSheet(null)
      await clearSessionQueue(live.id)
    } catch {
      setError("Sharing could not be stopped. Try again when connected.")
    } finally {
      setBusy(false)
    }
  }
  const clockOf = (iso: string | null | undefined) =>
    iso ? clock(new Date(iso)) : null
  const screenStops: ScreenStop[] = route.map((v) => {
    const skipped = live?.state.skipped.some((s) =>
      s.visitId ? s.visitId === v.visitId : s.stopId === v.stopId
    )
    const done =
      !!live?.state.completedVisitIds?.includes(v.visitId) && !skipped
    const here =
      !!live &&
      live.state.phase === "at_stop" &&
      (live.state.currentVisitId
        ? live.state.currentVisitId === v.visitId
        : live.state.currentStopId === v.stopId)

    return {
      visitId: v.visitId,
      name: stopName(v.stopId),
      arrive: v.arrive,
      depart: v.depart,
      state: skipped ? "skipped" : done ? "done" : here ? "here" : "todo",
      expected: live ? expected(v.arrive) : undefined,
    }
  })
  const routeLabel = `${routeDate ? weekdayName(routeDate) : "Today"}${tt && tt.cycle.weeks > 1 && routeDate ? `, Week ${live?.cycleWeek ?? cycleWeekOf(tt, routeDate)}` : ""} · ${route.length} ${route.length === 1 ? "stop" : "stops"}`
  const routeTimes = route.length
    ? `${route[0]!.arrive}–${route.at(-1)!.depart}`
    : "No stops"

  return (
    <>
      <header
        className="mb-6 flex items-center justify-between gap-4 border-b pb-4"
        style={{ borderColor: T.border.line }}
      >
        <div className="min-w-0">
          <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
            Libraries Global Live
          </p>
          <h1
            className="m-0 text-[22px] leading-tight break-words"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {initial.library.name}
          </h1>
        </div>
        <details ref={menu} className="relative shrink-0">
          <summary
            className="flex min-h-14 cursor-pointer list-none items-center gap-1 rounded-full border px-4 text-[14px] font-semibold"
            style={{ borderColor: T.border.hi, background: T.bg.deep }}
          >
            Menu
          </summary>
          <nav
            aria-label="Console menu"
            className="absolute right-0 z-10 mt-2 w-56 rounded-[16px] border p-2"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            <ul className="m-0 flex list-none flex-col p-0">
              <li>
                <Link
                  className="flex min-h-11 items-center rounded-[10px] px-3 py-2 no-underline hover:bg-(--t-bg-surface)"
                  href="/live"
                >
                  Switch library
                </Link>
              </li>
              {role === "owner" && (
                <li>
                  <Link
                    className="flex min-h-11 items-center rounded-[10px] px-3 py-2 no-underline hover:bg-(--t-bg-surface)"
                    href={staffHref("/live")}
                  >
                    Live sharing settings
                  </Link>
                </li>
              )}
              <li>
                <Link
                  className="flex min-h-11 items-center rounded-[10px] px-3 py-2 no-underline hover:bg-(--t-bg-surface)"
                  href={staffHref()}
                >
                  Staff area
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center rounded-[10px] px-3 py-2 text-left hover:bg-(--t-bg-surface)"
                  onClick={() => {
                    sessionStorage.removeItem(storageKey(id))
                    clearLiveQueue().catch(() => {})
                    authClient.signOut().then(() => {
                      window.location.href = `/${locale}/live`
                    })
                  }}
                >
                  Sign out
                </button>
              </li>
            </ul>
          </nav>
        </details>
      </header>
      {error && <ConsoleLine tone="alert">{error}</ConsoleLine>}
      {guard && <ConsoleLine tone="status">{guard}</ConsoleLine>}
      {!canGoLive ||
      !initial.settings.enabled ||
      !initial.liveEnabled ||
      !tt ? (
        <section>
          <h2
            className="text-2xl"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            You’re not set up to go live
          </h2>
          <p className="my-4">
            {!initial.liveEnabled
              ? "Live sharing is temporarily unavailable."
              : !canGoLive
                ? "The owner can turn on your permission to go live."
                : !tt
                  ? "Add a timetable before starting a route."
                  : "The owner needs to allow live updates for this service."}
          </p>
          <Link className="live-button rounded-full" href={staffHref("/live")}>
            Live sharing settings
          </Link>
        </section>
      ) : finished ? (
        <FinishedScreen
          title={
            live?.endReason === "breakdown" ? "Service stopped" : "Finished"
          }
          summary={
            live?.endReason === "breakdown"
              ? "A notice has been posted for the rest of today."
              : `${live?.state.arrivals?.length ?? 0} of ${live?.route.length ?? 0} stops · ${live?.state.averageDelayMin ?? 0} minutes late on average · sharing stopped at ${clockOf(live?.endedAt) ?? "now"}`
          }
          note="Location points are deleted after 24 hours. Check-ins are kept for 90 days."
          backHref={staffHref()}
          backLabel="Back to the Staff area"
        >
          <button
            type="button"
            className="live-button mt-3 w-auto rounded-full px-6"
            onClick={() => {
              setLive(null)
              setConfirm(true)
            }}
          >
            Restart with confirmation
          </button>
        </FinishedScreen>
      ) : active ? (
        <section>
          <LiveStatusStrip
            tone={!online || !visible ? "warn" : "ok"}
            icon={
              !online
                ? "mdi:cloud-off-outline"
                : !visible
                  ? "mdi:lock-outline"
                  : "mdi:check-circle"
            }
          >
            {!online
              ? `Offline. ${queued} check-ins are saved on this phone.`
              : !visible
                ? "Paused: the screen locked. Check-ins still work."
                : live.mode === "approximate"
                  ? "Live · position shared · keep screen on"
                  : "Live · check-ins only"}
          </LiveStatusStrip>
          {!online && (
            <p className="mb-4 text-sm" style={{ color: T.ink.dim }}>
              {queued} check-ins will send when you’re back online. Position
              updates pause while offline.
            </p>
          )}
          <CurrentStopCard
            eyebrow={
              live.state.phase === "at_stop" ? "You’re at" : "On the way to"
            }
            name={stopName(
              live.state.phase === "at_stop" ? current?.stopId : next?.stopId
            )}
            meta={
              live.state.phase === "at_stop"
                ? `${live.state.currentSince ? `Since ${clockOf(live.state.currentSince)} · ` : ""}due to leave ${current?.depart ?? ""}${live.state.delayMin >= 5 && current ? ` · now ${expected(current.depart)}` : ""}`
                : `Due ${next?.arrive ?? ""}${next && live.state.delayMin ? ` · expected ${expected(next.arrive)}` : ""}`
            }
            primaryLabel={
              live.state.phase === "at_stop"
                ? next
                  ? "Leaving now"
                  : "Leaving: last stop"
                : next
                  ? "Arrived"
                  : "End route"
            }
            busy={busy}
            onPrimary={() => {
              if (live.state.phase === "at_stop") {
                if (!next) setSheet("end")
                else void checkin("left", current?.stopId)
              } else if (next) void checkin("arrived", next.stopId)
              else setSheet("end")
            }}
          />
          {live.state.phase === "at_stop" && next && (
            <NextStopCard
              name={stopName(next.stopId)}
              time={expected(next.arrive)}
              actionLabel="Arrived"
              busy={busy}
              onAction={() => checkin("arrived", next.stopId)}
            />
          )}
          <DelayButtons
            delayMin={live.state.delayMin}
            busy={busy}
            onDelay={(minutes) => checkin("delay", undefined, minutes)}
          />
          <ExceptionButtons
            onSkip={() => {
              setReason("")
              setSheet("skip")
            }}
            onBreakdown={() => {
              setReason("")
              setSheet("breakdown")
            }}
          />
          <StopList stops={screenStops} />
          <button
            type="button"
            className="live-button mt-5 rounded-full"
            onClick={() => setSheet("end")}
          >
            End route
          </button>
        </section>
      ) : (
        <BeforeYouStartScreen
          intro={
            startedElsewhere
              ? `This route is live on another phone${initial.activeSession ? `, started by ${initial.activeSession.startedByName ?? "a staff member"} at ${clockOf(initial.activeSession.startedAt)}` : ""}. Taking over stops updates from that phone.`
              : "Share check-ins from the crew. Your name is never shown to the public."
          }
          routeLabel={routeLabel}
          routeTimes={routeTimes}
          onChangeRoute={() => setSheet("route")}
          mode={mode}
          onMode={setMode}
          allowApproximate={initial.settings.precision === "approximate"}
          preview={
            preview
              ? { label: preview.label, sentence: preview.sentence }
              : null
          }
          checklist={[
            `Sharing stops automatically${autoStopAt ? ` at ${autoStopAt}` : ""}, ${initial.settings.autoStopMinutes} minutes after the last stop`,
            "Your name is never shown",
            "Location points are deleted after 24 hours",
          ]}
          startLabel={
            startedElsewhere ? "Take over this route" : "Start today’s route"
          }
          startDisabled={!route.length}
          busy={busy}
          onStart={start}
          extra={
            <>
              {mode === "approximate" && (
                <p className="my-4 text-[14px]" style={{ color: T.ink.dim }}>
                  Location is shared only between stops, rounded to about 250 m
                  and a minute behind. Keep this screen on. Your browser will
                  ask to use location after starting.
                </p>
              )}
              <p className="my-4 text-[13.5px]" style={{ color: T.ink.dim }}>
                On iPhone, an installed app has its own sign-in. Sign in once
                inside it.
              </p>
              {confirmed && (
                <button
                  type="button"
                  className="live-button mt-1 rounded-full"
                  onClick={() => {
                    authClient.passkey
                      .addPasskey({ name: "Live console" })
                      .then((r) => {
                        if (r.error) setError("The passkey could not be added.")
                        else setError("")
                      })
                  }}
                >
                  Add a passkey
                </button>
              )}
            </>
          }
        />
      )}
      <ConfirmIdentity
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirmed={() => {
          setConfirmed(true)
          setConfirm(false)
          if (resumeRef.current) void resume(resumeRef.current)
        }}
      />
      <Sheet
        open={Boolean(sheet)}
        onClose={() => setSheet(null)}
        side="bottom"
        title={
          sheet === "end"
            ? "End route?"
            : sheet === "route"
              ? "Choose a day’s route"
              : sheet === "skip"
                ? "Skip this stop"
                : "Not running for the rest of today"
        }
      >
        <div className="live-controls space-y-4">
          {sheet === "end" ? (
            <>
              <p>
                Sharing stops now. To restart today you’ll confirm it’s you
                again.
              </p>
              <button
                type="button"
                className="live-button live-primary rounded-full"
                disabled={busy || !online}
                onClick={endRoute}
              >
                Stop sharing
              </button>
            </>
          ) : sheet === "route" ? (
            <div className="space-y-2">
              {tt &&
                today &&
                Array.from({ length: tt.cycle.weeks * 7 }, (_, i) =>
                  addDays(today, i)
                ).map((date) => {
                  const visits = dayRoute(tt!, [], date)

                  return visits.length ? (
                    <button
                      type="button"
                      key={date}
                      className="live-button justify-between rounded-full px-5"
                      onClick={() => {
                        setRouteDate(date)
                        setSheet(null)
                      }}
                    >
                      <span>{shortDate(date)}</span>
                      <span style={{ color: T.ink.dim }}>
                        {visits.length} stops · {visits[0]!.arrive}
                      </span>
                    </button>
                  ) : null
                })}
            </div>
          ) : (
            <>
              <label className="block text-[15px] font-semibold">
                Reason
                <select
                  className="live-input mt-2 font-normal"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Choose a reason</option>
                  {(sheet === "skip"
                    ? [
                        "Road closed",
                        "Nobody waiting",
                        "Running too late",
                        "Other",
                      ]
                    : ["Breakdown", "Weather", "Staffing", "Other"]
                  ).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              {sheet === "breakdown" && (
                <label className="block text-[15px] font-semibold">
                  Message for the public (optional)
                  <textarea
                    className="live-input mt-2 font-normal"
                    maxLength={240}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </label>
              )}
              <button
                type="button"
                className="live-button live-primary rounded-full"
                disabled={busy || !reason}
                onClick={() =>
                  checkin(
                    sheet === "skip" ? "skip" : "not_running",
                    sheet === "skip"
                      ? (next?.stopId ?? current?.stopId)
                      : undefined,
                    undefined,
                    message ? `${reason}: ${message}` : reason
                  )
                }
              >
                {sheet === "skip"
                  ? "Skip stop"
                  : "Post notice and stop sharing"}
              </button>
            </>
          )}
        </div>
      </Sheet>
    </>
  )
}
