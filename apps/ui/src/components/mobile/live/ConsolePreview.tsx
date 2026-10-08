"use client"
import { Icon } from "@iconify/react"
import {
  localDateTime,
  publicLiveState,
  type PublicLiveState,
} from "@repo/shared-data"
import { useState } from "react"

import { StatusBadge } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { Link } from "@/lib/navigation"
import { greetingFor, weekdayName } from "@/lib/staff/format"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { registerLiveIcons } from "./icons"
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
const noop = () => {}

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
  const staffHref = useStaffLibraryHref(initial.library.id)
  const [screen, setScreen] = useState<Screen>("live")
  const [simulate, setSimulate] = useState<Simulation>(null)
  const [mode, setMode] = useState<"checkins" | "approximate">("checkins")
  const tt = initial.library.timetable
  // The phone's clock, greeting and public line wait for the real clock:
  // the server's render shows "--:--" so nothing has to match a time.
  const now = useMobileClock()
  const local = now ? localDateTime(now, initial.library.timezone) : null
  const route = initial.route
  const stopName = (stopId: string) =>
    tt?.stops.find((s) => s.id === stopId)?.name ?? "Stop"
  // The fake session: first stop done, second "here now", the rest to come.
  const hereAt = Math.min(1, Math.max(0, route.length - 1))
  const stops: ScreenStop[] = route.map((v, i) => ({
    visitId: v.visitId,
    name: stopName(v.stopId),
    arrive: v.arrive,
    depart: v.depart,
    state: i < hereAt ? "done" : i === hereAt ? "here" : "todo",
  }))
  const current = stops[hereAt],
    next = stops[hereAt + 1]
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
  const routeLabel = `${local ? weekdayName(local.date) : "Today"}${tt && tt.cycle.weeks > 1 ? ", Week 1" : ""} · ${route.length} ${route.length === 1 ? "stop" : "stops"}`
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
            text: "Paused: the screen locked. Check-ins still work.",
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
      className="group rounded-[20px] border"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <summary
        className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-[18px] font-semibold"
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
        className="grid gap-6 border-t px-6 pt-6 pb-6 lg:grid-cols-[320px_minmax(0,1fr)]"
        style={{ borderColor: T.border.divider }}
      >
        {/* The phone */}
        <div
          className="relative mx-auto aspect-[9/19] w-[320px] max-w-full overflow-hidden rounded-[40px] p-3"
          style={{ background: T.ink.base }}
          aria-label="Console preview"
          role="group"
        >
          <div
            className="live-console relative h-full overflow-y-auto overscroll-contain rounded-[30px] p-4 pb-8"
            style={{ background: T.bg.void }}
          >
            <div
              className="mb-3 flex items-center justify-between text-[12px] font-semibold"
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
                className="h-5 w-20 rounded-full"
                style={{ background: T.ink.base }}
              />
              <span>82%</span>
            </div>
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
                      Go live
                    </button>
                  }
                />
                <p className="mt-3 text-[13px]" style={{ color: T.ink.dim }}>
                  Also on the library page, in the “You run this mobile library”
                  card.
                </p>
                {screen === "confirm" ? (
                  <>
                    <div
                      className="absolute inset-0 -m-4 rounded-[30px]"
                      style={{ background: T.overlay.scrim }}
                      aria-hidden="true"
                    />
                    <div
                      className="absolute inset-x-0 -mx-4 rounded-t-[24px] border-t p-5"
                      style={{
                        bottom: "-16px",
                        background: T.bg.deep,
                        borderColor: T.border.line,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="mx-auto mb-3 block h-1.5 w-10 rounded-full"
                        style={{ background: T.border.hi }}
                      />
                      <ConfirmIdentityLook heading="p">
                        <label className="block text-[15px] font-semibold">
                          Password
                          <input
                            className="live-input mt-2 font-normal"
                            type="password"
                            readOnly
                            value="••••••••••"
                            aria-label="Password (preview)"
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
                          className="mx-auto block min-h-11 text-[15px] font-semibold"
                          style={{ color: T.ink.dim }}
                          onClick={() => setScreen("entry")}
                        >
                          Cancel
                        </button>
                      </ConfirmIdentityLook>
                    </div>
                  </>
                ) : null}
              </div>
            ) : screen === "before" ? (
              <BeforeYouStartScreen
                heading="p"
                routeLabel={routeLabel}
                routeTimes={routeTimes}
                onChangeRoute={noop}
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
                onStart={() => setScreen("live")}
              />
            ) : screen === "live" ? (
              <section>
                {simulate === "expired" ? (
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
                    eyebrow="You’re at"
                    name={current.name}
                    meta={`Since ${current.arrive} · due to leave ${current.depart}`}
                    primaryLabel={next ? "Leaving now" : "Leaving: last stop"}
                    onPrimary={() => setScreen(next ? "live" : "finished")}
                  />
                ) : (
                  <p className="text-[15px]" style={{ color: T.ink.dim }}>
                    No stops today, so there is nothing to check in to.
                  </p>
                )}
                {next ? (
                  <NextStopCard
                    name={next.name}
                    time={next.arrive}
                    actionLabel="Arrived"
                    onAction={noop}
                  />
                ) : null}
                <DelayButtons delayMin={0} onDelay={noop} />
                <ExceptionButtons onSkip={noop} onBreakdown={noop} />
                <StopList heading="p" stops={stops} />
              </section>
            ) : (
              <FinishedScreen
                heading="p"
                title="Finished"
                summary={`${route.length} of ${route.length} stops · 8 minutes late on average · sharing stopped at ${route.at(-1)?.depart ?? "16:12"}`}
                note="Location points are deleted after 24 hours."
                backHref={staffHref()}
                backLabel="Back to the Staff area"
              />
            )}
          </div>
        </div>

        {/* The controls */}
        <div className="flex min-w-0 flex-col gap-4">
          <section
            className="rounded-[16px] border p-5"
            style={{ borderColor: T.border.line }}
          >
            <h3
              className="m-0 text-[20px]"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              Try the console
            </h3>
            <p className="m-0 mt-1 text-[14px]" style={{ color: T.ink.dim }}>
              Jump to a screen, or simulate what can go wrong on the road.
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Screen"
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
                    onClick={() => setScreen(s.key)}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-4 mb-2 text-[14px] font-semibold">Simulate</p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Simulate"
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
            className="rounded-[16px] border p-5"
            style={{ borderColor: T.border.line }}
            aria-live="polite"
          >
            <p className="m-0 text-[14px] font-semibold">
              What the public sees right now
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
            className="m-0 rounded-[14px] border px-4 py-3 text-[13.5px]"
            style={{ borderColor: T.border.line, color: T.ink.dim }}
          >
            Built for a parked vehicle and cold hands: one primary button at a
            time, targets of 56 px or more, and the stop name in large type.
            Check-ins work with the screen off; position needs the page open.
          </p>
        </div>
      </div>
    </details>
  )
}
