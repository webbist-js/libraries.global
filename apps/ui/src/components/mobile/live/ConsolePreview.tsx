"use client"

import { Icon } from "@iconify/react"
import {
  cycleWeekOf,
  fromMinutes,
  localDateTime,
  publicLiveState,
  toMinutes,
  type PublicLiveState,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { StatusBadge } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { Link } from "@/lib/navigation"
import { greetingFor, shortDate, weekdayName } from "@/lib/staff/format"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { registerLiveIcons } from "./icons"
import { consolePreviewRoute } from "./preview-route"
import { publicLiveCopy } from "../live-copy"
import { useMobileClock } from "../useMobileClock"
import {
  BeforeYouStartScreen,
  ConfirmIdentityLook,
  ConsoleLine,
  CurrentStopCard,
  DelayButtons,
  EntryCard,
  ExceptionButtons,
  FinishedScreen,
  LiveStatusStrip,
  NextStopCard,
  type ScreenStop,
  StopList,
} from "./LiveConsoleScreens"

const SCREENS = [
  { key: "entry", label: "Entry" },
  { key: "confirm", label: "Confirm it’s you" },
  { key: "before", label: "Before you start" },
  { key: "live", label: "Live" },
  { key: "finished", label: "Finished" },
] as const
const SIMULATIONS = [
  { key: "locked", label: "Screen locked" },
  { key: "location", label: "Location denied" },
  { key: "far", label: "Far from route" },
  { key: "offline", label: "Offline" },
  { key: "expired", label: "Sign-in expired" },
] as const
type Screen = (typeof SCREENS)[number]["key"]
type Simulation = (typeof SIMULATIONS)[number]["key"] | null
const CHIP =
  "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface)"

/**
 * The Go live tab's phone frame: the real console screens rendered with a
 * fake session built from the library's own timetable, so every stop name
 * resolves. Chips jump between screens and simulate what can go wrong on
 * the road. Inside a "Preview the console" expander, open by default:
 * the phone is what explains the tab. The frame keeps a phone's aspect
 * and the screen scrolls inside it, so nothing is clipped by the bezel.
 */
registerLiveIcons()

export function ConsolePreview({
  initial,
  live,
  publicPath,
  firstName,
}: {
  readonly initial: LiveSettingsResponse
  readonly live: PublicLiveState | null
  readonly publicPath: string
  readonly firstName: string
}) {
  const tUi = useUiTranslations("ui")

  const staffHref = useStaffLibraryHref(initial.library.id)
  const [screen, setScreen] = useState<Screen>("live")
  const [simulate, setSimulate] = useState<Simulation>(null)
  const [mode, setMode] = useState<"checkins" | "approximate">("checkins")
  const [position, setPosition] = useState(1)
  const [between, setBetween] = useState(false)
  const [delay, setDelay] = useState(0)
  const [skipped, setSkipped] = useState<string[]>([])
  const [action, setAction] = useState<"skip" | "breakdown" | "end" | null>(
    null
  )
  const phoneScreen = useRef<HTMLDivElement>(null)
  const previewSheet = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (phoneScreen.current) phoneScreen.current.scrollTop = 0
  }, [screen])
  useEffect(() => {
    if (screen !== "confirm" && !action) return
    const trigger = document.activeElement
    previewSheet.current?.querySelector<HTMLButtonElement>("button")?.focus()

    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus()
    }
  }, [screen, action])
  const tt = initial.library.timetable
  // The phone's clock, greeting and public line wait for the real clock:
  // the server's render shows "--:--" so nothing has to match a time.
  const now = useMobileClock()
  const local = now ? localDateTime(now, initial.library.timezone) : null
  const route = consolePreviewRoute(initial.route, tt, local?.date)
  const stopName = (stopId: string) =>
    tt?.stops.find((s) => s.id === stopId)?.name ?? "Stop"
  // The fake session: first stop done, second "here now", the rest to come.
  const hereAt = Math.min(position, Math.max(0, route.length - 1))
  const stops: ScreenStop[] = route.map((v, i) => ({
    visitId: v.visitId,
    name: stopName(v.stopId),
    arrive: v.arrive,
    depart: v.depart,
    state: skipped.includes(v.visitId)
      ? "skipped"
      : i < hereAt || (i === hereAt && between)
        ? "done"
        : i === hereAt
          ? "here"
          : "todo",
  }))
  const current = stops[hereAt],
    next = stops[hereAt + 1]
  const expected = (time: string) =>
    fromMinutes(Math.min(1439, toMinutes(time) + delay))
  const advance = () => {
    if (next) {
      setPosition(hereAt + 1)
      setBetween(false)
    } else setScreen("finished")
  }
  const publicNow =
    tt &&
    now &&
    local &&
    publicLiveCopy(
      live ??
        publicLiveState({
          libraryDocumentId: initial.library.id,
          tt,
          notices: [],
          session: null,
          sharesLive: initial.settings.enabled,
          now,
          tz: initial.library.timezone,
        }),
      tt,
      { today: local.date, now }
    )
  const previewHere = current
    ? {
        label: "Here now",
        sentence: `At ${current.name} until ${current.depart}.`,
      }
    : null
  const routeDate = route[0]?.date
  const routeLabel = `${routeDate ? weekdayName(routeDate) : "Today"}${tt && routeDate && tt.cycle.weeks > 1 ? `, Week ${cycleWeekOf(tt, routeDate)}` : ""} · ${route.length} ${route.length === 1 ? "stop" : "stops"}`
  const routeTimes = route.length
    ? `${route[0]!.arrive}–${route.at(-1)!.depart}`
    : "No stops today"
  const strip =
    simulate === "offline"
      ? {
          tone: "warn" as const,
          icon: "mdi:cloud-off-outline",
          text: "Offline. 2 check-ins are saved on this phone.",
        }
      : simulate === "locked"
        ? {
            tone: "warn" as const,
            icon: "mdi:lock-outline",
            text: "Screen locked. Reopen the console to check in.",
          }
        : {
            tone: "ok" as const,
            icon: "mdi:check-circle",
            text:
              mode === "approximate"
                ? "Live · position shared · keep screen on"
                : "Live · check-ins only",
          }
  const guard =
    simulate === "location"
      ? "Location is off. Sharing check-ins only."
      : simulate === "far"
        ? "Position hidden: you’re not near today’s route. Check-ins still work."
        : simulate === "expired"
          ? "Your sign-in expired. Confirm it’s you to keep sharing."
          : null

  return (
    <details
      open
      className="group rounded-[28px] border [--spacing:0.25rem]"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <summary
        className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-5 text-[24px] sm:px-6"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        <span className="flex items-center gap-2">
          <Icon
            aria-hidden="true"
            icon="mdi:cellphone-play"
            width={20}
            style={{ color: T.accent.primary }}
          />
          Preview the console
        </span>
        <Icon
          aria-hidden="true"
          icon="mdi:chevron-down"
          width={22}
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          style={{ color: T.ink.dim }}
        />
      </summary>
      <div
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 border-t px-3 py-6 sm:px-6 lg:grid-cols-[410px_minmax(0,1fr)] lg:gap-8"
        style={{ borderColor: T.border.divider }}
      >
        {/* The phone */}
        <div
          className="relative mx-auto flex aspect-[410/864] w-[410px] max-w-full min-w-0 flex-col overflow-hidden rounded-[44px] border-[10px]"
          style={{ background: T.bg.void, borderColor: T.ink.base }}
          aria-label={tUi("console_preview")}
          role="group"
        >
          <div
            className="flex h-11 shrink-0 items-center justify-between px-5 text-[13px] font-semibold tabular-nums"
            style={{ color: T.ink.dim }}
            aria-hidden="true"
          >
            <span>
              {simulate === "locked"
                ? "10:22"
                : local
                  ? `${String(Math.floor(local.minute / 60)).padStart(2, "0")}:${String(local.minute % 60).padStart(2, "0")}`
                  : "--:--"}
            </span>
            <span
              className="h-6 w-24 rounded-full"
              style={{ background: T.ink.base }}
            />
            <span>82%</span>
          </div>
          <div
            ref={phoneScreen}
            className="live-console min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-6"
            inert={screen === "confirm" || Boolean(action)}
          >
            {screen === "entry" || screen === "confirm" ? (
              <div className="relative">
                <p className="m-0 text-[12.5px]" style={{ color: T.ink.dim }}>
                  Staff area · Your libraries
                </p>
                <p
                  className="my-2 text-[28px]"
                  style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                >
                  {local ? greetingFor(Math.floor(local.minute / 60)) : "Hello"}
                  , {firstName}.
                </p>
                <EntryCard
                  heading="p"
                  name={initial.library.name}
                  meta={`${routeLabel} · ${routeTimes}`}
                  action={
                    <button
                      type="button"
                      className="live-button live-primary rounded-full"
                      onClick={() => setScreen("confirm")}
                    >
                      <Icon
                        aria-hidden="true"
                        icon="mdi:circle"
                        width={10}
                        className="mr-2"
                      />
                      {tUi("go_live")}
                    </button>
                  }
                />
                <p className="mt-3 text-[13px]" style={{ color: T.ink.dim }}>
                  Also on the library page, in the “You run this mobile library”
                  card.
                </p>
              </div>
            ) : screen === "before" ? (
              <BeforeYouStartScreen
                heading="p"
                routeLabel={routeLabel}
                routeTimes={routeTimes}
                onChangeRoute={() => setScreen("entry")}
                mode={mode}
                onMode={setMode}
                allowApproximate={initial.settings.precision === "approximate"}
                preview={previewHere}
                checklist={[
                  `Sharing stops automatically ${initial.settings.autoStopMinutes} minutes after the last stop`,
                  "Your name is never shown",
                  "Location points are deleted after 24 hours",
                ]}
                startLabel="Start today’s route"
                startDisabled={!route.length}
                onStart={() => {
                  setPosition(0)
                  setBetween(false)
                  setSkipped([])
                  setDelay(0)
                  setScreen("live")
                }}
              />
            ) : screen === "live" ? (
              <section>
                {!current ? (
                  <ConsoleLine tone="status">
                    {now
                      ? "No route in the saved timetable to preview."
                      : "Loading timetable preview…"}
                  </ConsoleLine>
                ) : simulate === "expired" ? (
                  <ConsoleLine tone="alert">{guard}</ConsoleLine>
                ) : (
                  <LiveStatusStrip tone={strip.tone} icon={strip.icon}>
                    {strip.text}
                  </LiveStatusStrip>
                )}
                {guard && simulate !== "expired" ? (
                  <ConsoleLine tone="status">{guard}</ConsoleLine>
                ) : null}
                {current ? (
                  <CurrentStopCard
                    heading="p"
                    eyebrow={between ? "On the way to" : "You’re at"}
                    name={between && next ? next.name : current.name}
                    meta={
                      between && next
                        ? `Due ${expected(next.arrive)}`
                        : `Since ${current.arrive} · due to leave ${current.depart}${delay ? ` · now ${expected(current.depart)}` : ""}`
                    }
                    primaryLabel={
                      between
                        ? "Arrived"
                        : next
                          ? "Leaving now"
                          : "Leaving: last stop"
                    }
                    onPrimary={() => {
                      if (between) advance()
                      else if (next) setBetween(true)
                      else setScreen("finished")
                    }}
                  />
                ) : null}
                {next && !between ? (
                  <NextStopCard
                    name={next.name}
                    time={expected(next.arrive)}
                    actionLabel="Arrived"
                    onAction={advance}
                  />
                ) : null}
                {current ? (
                  <>
                    <DelayButtons delayMin={delay} onDelay={setDelay} />
                    <ExceptionButtons
                      onSkip={() => setAction("skip")}
                      onBreakdown={() => setAction("breakdown")}
                    />
                    <StopList heading="p" stops={stops} />
                    <button
                      type="button"
                      className="live-button mt-4 rounded-full"
                      onClick={() => setAction("end")}
                    >
                      End route
                    </button>
                  </>
                ) : null}
              </section>
            ) : (
              <FinishedScreen
                heading="p"
                title={tUi("finished")}
                summary="This is the finished screen. No live session was started or published."
                note="In a real session, this shows the route’s check-ins and when sharing stopped."
                backHref={staffHref()}
                backLabel="Back to the Staff area"
              />
            )}
          </div>
          {screen === "confirm" || action ? (
            <div
              className="absolute inset-0 flex flex-col justify-end"
              style={{ background: T.overlay.scrim }}
            >
              <div
                ref={previewSheet}
                className="live-controls max-h-full overflow-y-auto overscroll-contain rounded-t-[28px] p-5"
                style={{ background: T.bg.deep }}
                role="group"
                aria-label={
                  action
                    ? "Preview route action"
                    : "Preview identity confirmation"
                }
              >
                <span
                  aria-hidden="true"
                  className="mx-auto mb-4 block h-1.5 w-11 rounded-full"
                  style={{ background: T.border.hi }}
                />
                {action ? (
                  <div className="space-y-4">
                    <p
                      className="m-0 text-[28px] leading-tight"
                      style={{ fontFamily: T.font.serif }}
                    >
                      {action === "skip"
                        ? "Skip this stop?"
                        : action === "breakdown"
                          ? "Not running?"
                          : "End route?"}
                    </p>
                    <p className="text-[15px]" style={{ color: T.ink.dim }}>
                      This only changes the preview. No public update is sent.
                    </p>
                    <button
                      type="button"
                      className="live-button live-primary rounded-full"
                      onClick={() => {
                        if (action === "skip") {
                          const skippedStop = between ? next : current
                          if (skippedStop)
                            setSkipped([...skipped, skippedStop.visitId])
                          const following = hereAt + (between ? 2 : 1)
                          if (following < route.length) {
                            setPosition(following)
                            setBetween(false)
                          } else setScreen("finished")
                        } else setScreen("finished")
                        setAction(null)
                      }}
                    >
                      {action === "skip" ? "Skip in preview" : "Finish preview"}
                    </button>
                    <button
                      type="button"
                      className="live-button rounded-full"
                      onClick={() => setAction(null)}
                    >
                      {tUi("cancel")}{" "}
                    </button>
                  </div>
                ) : (
                  <ConfirmIdentityLook heading="p">
                    <label className="block text-[15px] font-semibold">
                      {tUi("password")}{" "}
                      <span
                        className="font-normal"
                        style={{ color: T.ink.dim }}
                      >
                        (preview)
                      </span>
                      <input
                        className="live-input mt-2 font-normal"
                        type="password"
                        autoComplete="off"
                        readOnly
                        value="example"
                        aria-label={tUi("password_preview")}
                      />
                    </label>
                    <button
                      type="button"
                      className="live-button live-primary rounded-full"
                      onClick={() => setScreen("before")}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="live-button rounded-full"
                      onClick={() => setScreen("before")}
                    >
                      Use a passkey
                    </button>
                    <button
                      type="button"
                      className="mx-auto block min-h-14 text-[15px] font-semibold"
                      style={{ color: T.ink.dim }}
                      onClick={() => setScreen("entry")}
                    >
                      {tUi("cancel")}{" "}
                    </button>
                  </ConfirmIdentityLook>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* The controls */}
        <div className="flex min-w-0 flex-col gap-4">
          <section
            className="rounded-[24px] border p-5 sm:p-6"
            style={{ borderColor: T.border.line }}
          >
            <h3
              className="m-0 text-[28px]"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              Try the console
            </h3>
            <p className="m-0 mt-1 text-[14px]" style={{ color: T.ink.dim }}>
              Interactive preview. Nothing here starts a live session or changes
              the public page.
            </p>
            <p className="mt-2 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
              {routeDate
                ? `Using the saved timetable for ${shortDate(routeDate)}${!initial.route.length ? "; there are no scheduled stops today" : ""}.`
                : "Add a timetable to preview the route screens."}
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label={tUi("screen")}
            >
              {SCREENS.map((s) => {
                const active = screen === s.key

                return (
                  <button
                    key={s.key}
                    type="button"
                    className={CHIP}
                    style={
                      active
                        ? {
                            background: T.ink.base,
                            color: T.bg.deep,
                            borderColor: T.ink.base,
                          }
                        : {
                            borderColor: T.border.hi,
                            background: T.bg.deep,
                            color: T.ink.base,
                          }
                    }
                    aria-pressed={active}
                    onClick={() => {
                      setScreen(s.key)
                      setAction(null)
                      setSimulate(null)
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 mb-2 text-[14px] font-semibold">
              {tUi("simulate")}
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={tUi("simulate")}
            >
              {SIMULATIONS.map((s) => {
                const active = simulate === s.key

                return (
                  <button
                    key={s.key}
                    type="button"
                    className={CHIP}
                    style={
                      active
                        ? {
                            background: T.ink.base,
                            color: T.bg.deep,
                            borderColor: T.ink.base,
                          }
                        : {
                            borderColor: T.border.hi,
                            background: T.bg.deep,
                            color: T.ink.base,
                          }
                    }
                    aria-pressed={active}
                    onClick={() => {
                      setSimulate(active ? null : s.key)
                      setAction(null)
                      setScreen("live")
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </section>
          <section
            className="rounded-[24px] border p-5 sm:p-6"
            style={{ borderColor: T.border.line }}
            aria-live="polite"
          >
            <p className="m-0 text-[14px] font-semibold">
              What the public sees right now
            </p>
            <p className="mt-1 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
              The actual public page. Trying the preview doesn’t change this.
            </p>
            {publicNow ? (
              <>
                <p className="m-0 mt-2">
                  <StatusBadge
                    tone={publicNow.tone}
                    icon={publicNow.icon}
                    pulse={publicNow.pulse}
                  >
                    {publicNow.label}
                  </StatusBadge>
                </p>
                <p
                  className="my-2 text-[22px] leading-snug"
                  style={{ fontFamily: T.font.serif }}
                >
                  {publicNow.sentence}
                </p>
              </>
            ) : (
              <p className="my-2 text-[15px]" style={{ color: T.ink.dim }}>
                {tt
                  ? "Checking the public line…"
                  : "Add a timetable to see the public line."}
              </p>
            )}
            <Link
              href={publicPath}
              className="text-[14px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Open the public library page
            </Link>
          </section>
          <p
            className="m-0 rounded-[24px] border px-5 py-4 text-[15px] leading-relaxed"
            style={{
              borderColor: T.border.line,
              color: T.ink.dim,
              background: T.bg.surface,
            }}
          >
            Built for a parked vehicle and cold hands: one primary button at a
            time, targets of 56 px or more, and the stop name in large type.
            Reopen the console to tap at each stop. Sharing position needs the
            page open with the screen on.
          </p>
        </div>
      </div>
    </details>
  )
}
