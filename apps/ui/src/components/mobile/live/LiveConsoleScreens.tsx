"use client"
import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { registerLiveIcons } from "./icons"

/**
 * The live console's screens as plain presentational pieces. `LiveConsole`
 * drives them with a real session; `ConsolePreview` on the Go live tab
 * renders the same pieces with a fake one, so the preview is the console.
 * Built for a parked vehicle and cold hands: one primary action at a time,
 * targets of 56 px or more, the stop name in large type.
 */

/** The element a screen's title renders as: a real heading in the console,
 * a `p` inside the Go live tab's preview (which already has its headings). */
registerLiveIcons()

export type HeadingTag = "h2" | "h3" | "p"
export type StopRowState = "done" | "here" | "skipped" | "todo"
export type ScreenStop = {
  visitId: string
  name: string
  arrive: string
  depart: string
  state: StopRowState
  /** Expected arrival after any delay, when it differs. */
  expected?: string
}

const panel = { background: T.bg.deep, borderColor: T.border.line }

/** The green / amber strip at the top of the live screen. */
export function LiveStatusStrip({
  tone,
  icon,
  children,
}: {
  readonly tone: "ok" | "warn" | "neutral"
  readonly icon: string
  readonly children: ReactNode
}) {
  const tint =
    tone === "ok"
      ? TYPE_TINT.public
      : tone === "warn"
        ? { bg: T.bg.muted, fg: T.accent.warn }
        : TYPE_TINT.neutral

  return (
    <p
      role="status"
      className="m-0 mb-3.5 flex items-center gap-2 rounded-[16px] border px-3 py-2.5 text-[14px] font-semibold"
      style={{ background: tint.bg, color: tint.fg }}
    >
      <Icon aria-hidden="true" icon={icon} width={18} className="shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** A guard or error line under the strip. */
export function ConsoleLine({
  tone,
  children,
}: {
  readonly tone: "alert" | "status"
  readonly children: ReactNode
}) {
  return (
    <p
      role={tone}
      className="m-0 mb-4 flex items-start gap-2 rounded-[14px] border px-4 py-3 text-[15px]"
      style={{
        ...panel,
        borderColor: tone === "alert" ? T.edge.danger : T.border.line,
        color: tone === "alert" ? T.accent.danger : T.ink.base,
      }}
    >
      <Icon
        aria-hidden="true"
        icon={
          tone === "alert"
            ? "mdi:alert-circle-outline"
            : "mdi:information-outline"
        }
        width={18}
        className="mt-0.5 shrink-0"
      />
      <span>{children}</span>
    </p>
  )
}

/** "You're at / Ford Cross / Since 10:14 · due to leave 10:45 / [Leaving now]". */
export function CurrentStopCard({
  eyebrow,
  name,
  meta,
  primaryLabel,
  onPrimary,
  busy,
  heading: Heading = "h2",
}: {
  readonly eyebrow: string
  readonly name: string
  readonly meta: string
  readonly primaryLabel: string
  readonly onPrimary: () => void
  readonly busy?: boolean
  readonly heading?: HeadingTag
}) {
  return (
    <div
      className="rounded-[24px] border-2 p-[18px]"
      style={{ background: T.bg.deep, borderColor: T.ink.base }}
    >
      <p className="m-0 text-[14px] font-semibold" style={{ color: T.ink.dim }}>
        {eyebrow}
      </p>
      <Heading
        className="my-3 text-[34px] leading-[1.05] break-words"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        {name}
      </Heading>
      <p className="mt-0 mb-3 text-[16px]" style={{ color: T.ink.dim }}>
        {meta}
      </p>
      <button
        type="button"
        className="live-button live-primary rounded-full text-[18px]"
        style={{ minHeight: 64 }}
        disabled={busy}
        onClick={onPrimary}
      >
        {primaryLabel}
      </button>
    </div>
  )
}

/** "Next / Hilton St Mary / 11:00 [Arrived]". */
export function NextStopCard({
  name,
  time,
  actionLabel,
  onAction,
  busy,
}: {
  readonly name: string
  readonly time: string
  readonly actionLabel: string
  readonly onAction: () => void
  readonly busy?: boolean
}) {
  return (
    <div
      className="my-3.5 flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3.5"
      style={panel}
    >
      <div className="min-w-0 flex-1">
        <p
          className="m-0 text-[13px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          Next
        </p>
        <p className="m-0 text-[18px] font-semibold break-words">{name}</p>
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          {time}
        </p>
      </div>
      <button
        type="button"
        className="live-button w-auto shrink-0 rounded-full px-5"
        disabled={busy}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  )
}

/** "Running late?" with +5 +10 +15 +30. */
export function DelayButtons({
  delayMin,
  onDelay,
  busy,
}: {
  readonly delayMin: number
  readonly onDelay: (minutes: number) => void
  readonly busy?: boolean
}) {
  return (
    <fieldset className="m-0 my-5 border-0 p-0">
      <legend className="mb-2 text-[15px] font-semibold">Running late?</legend>
      <div className="grid grid-cols-4 gap-1.5">
        {[5, 10, 15, 30].map((delay) => (
          <button
            key={delay}
            type="button"
            className="live-button rounded-[16px] text-[17px]"
            style={
              delayMin === delay
                ? {
                    background: T.accent.chip,
                    borderColor: T.accent.primary,
                    color: T.accent.primary,
                  }
                : undefined
            }
            aria-pressed={delayMin === delay}
            disabled={busy}
            onClick={() => onDelay(delayMin === delay ? 0 : delay)}
          >
            +{delay}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * "Skip stop" and the rust "Not running": short enough to sit side by side
 * on a phone without wrapping. Each opens a sheet that spells the action
 * out, so the accessible names carry the longer wording.
 */
export function ExceptionButtons({
  onSkip,
  onBreakdown,
}: {
  readonly onSkip: () => void
  readonly onBreakdown: () => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className="live-button rounded-[18px] py-0 text-[15px]"
        aria-label="Skip stop: skip this stop"
        onClick={onSkip}
      >
        Skip this stop
      </button>
      <button
        type="button"
        className="live-button rounded-[18px] border-2 py-0 text-[15px]"
        style={{
          background: TYPE_TINT.special.bg,
          borderColor: T.accent.danger,
          color: T.accent.danger,
        }}
        aria-label="Not running: breakdown or not running for the rest of today"
        onClick={onBreakdown}
      >
        Not running / breakdown
      </button>
    </div>
  )
}

/** The ordered stop list with Done / Here now / Not stopping today states. */
export function StopList({
  stops,
  title = "Today’s stops",
  heading: Heading = "h3",
}: {
  readonly stops: readonly ScreenStop[]
  readonly title?: string
  readonly heading?: HeadingTag
}) {
  return (
    <>
      <Heading className="mt-6 mb-3 text-[17px] font-semibold">{title}</Heading>
      <ol
        className="m-0 overflow-hidden rounded-[20px] border p-0"
        style={panel}
      >
        {stops.map((s, i) => {
          const here = s.state === "here"

          return (
            <li
              key={s.visitId}
              className="flex list-none items-center gap-3 border-t px-3.5 py-3 first:border-t-0"
              style={{
                ...panel,
                background: here ? T.accent.chip : T.bg.deep,
                borderColor: T.border.divider,
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[14px] font-bold"
                style={{
                  background:
                    s.state === "done"
                      ? TYPE_TINT.public.bg
                      : here
                        ? T.accent.primary
                        : T.bg.muted2,
                  color:
                    s.state === "done"
                      ? TYPE_TINT.public.fg
                      : here
                        ? T.bg.deep
                        : T.ink.base,
                }}
              >
                <span className="sr-only">
                  {s.state === "done"
                    ? "Done"
                    : s.state === "skipped"
                      ? "Skipped"
                      : `Stop ${i + 1}`}
                </span>
                <span aria-hidden="true">
                  {s.state === "done" ? (
                    <Icon icon="mdi:check" width={18} />
                  ) : s.state === "skipped" ? (
                    "–"
                  ) : (
                    i + 1
                  )}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <strong
                  className={`block text-[16px] break-words ${s.state === "skipped" ? "line-through" : ""}`}
                >
                  {s.name}
                </strong>
              </span>
              <span
                className="shrink-0 text-right text-[13px] tabular-nums"
                style={{ color: here ? T.accent.primary : T.ink.dim }}
              >
                <span className="block whitespace-nowrap">
                  {s.arrive}–{s.depart}
                </span>
                <span className="block font-semibold">
                  {s.state === "skipped"
                    ? "Not stopping today"
                    : s.state === "done"
                      ? "Done"
                      : here
                        ? "Here now"
                        : s.expected && s.expected !== s.arrive
                          ? `Expected ${s.expected}`
                          : ""}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

/** The entry card: one library, its route summary and the Go live pill. */
export function EntryCard({
  name,
  meta,
  action,
  heading: Heading = "h2",
}: {
  readonly name: string
  readonly meta: string
  readonly action: ReactNode
  readonly heading?: HeadingTag
}) {
  return (
    <section className="rounded-[20px] border p-5" style={panel}>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
        style={{ background: TYPE_TINT.public.bg, color: TYPE_TINT.public.fg }}
      >
        <Icon aria-hidden="true" icon="mdi:bus-side" width={14} />
        Mobile library
      </span>
      <Heading
        className="my-2 text-[26px] leading-tight"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        {name}
      </Heading>
      <p className="my-3 text-[15px]" style={{ color: T.ink.dim }}>
        {meta}
      </p>
      {action}
    </section>
  )
}

/** The "Confirm it's you" sheet's body, shared by the real sheet and the preview. */
export function ConfirmIdentityLook({
  children,
  heading: Heading = "h2",
  showTitle = true,
}: {
  readonly children?: ReactNode
  readonly heading?: HeadingTag
  /** False when the sheet around it already carries the title. */
  readonly showTitle?: boolean
}) {
  return (
    <div className="live-controls space-y-4">
      {showTitle ? (
        <Heading
          className="m-0 text-[26px]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          Confirm it’s you
        </Heading>
      ) : null}
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        Needed each day before you share live updates.
      </p>
      {children}
    </div>
  )
}

/** "Before you start": route summary, mode choice, public preview, checklist, start. */
export function BeforeYouStartScreen({
  intro,
  routeLabel,
  routeTimes,
  onChangeRoute,
  mode,
  onMode,
  allowApproximate,
  preview,
  checklist,
  startLabel,
  onStart,
  startDisabled,
  busy,
  extra,
  heading: Heading = "h2",
}: {
  readonly intro?: ReactNode
  readonly routeLabel: string
  readonly routeTimes: string
  readonly onChangeRoute: () => void
  readonly mode: "checkins" | "approximate"
  readonly onMode: (mode: "checkins" | "approximate") => void
  /** False when the library shares stops only. */
  readonly allowApproximate: boolean
  readonly preview: { label: string; sentence: string } | null
  readonly checklist: readonly string[]
  readonly startLabel: string
  readonly onStart: () => void
  readonly startDisabled?: boolean
  readonly busy?: boolean
  readonly extra?: ReactNode
  readonly heading?: HeadingTag
}) {
  const choice = (
    value: "checkins" | "approximate",
    title: string,
    hint: string
  ) => {
    const checked = mode === value

    return (
      <label
        className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[16px] p-4 transition-colors has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary) has-focus-visible:outline-solid"
        style={{
          border: `1.5px solid ${checked ? T.accent.primary : T.border.line}`,
          background: checked
            ? "color-mix(in srgb, var(--t-accent-chip) 45%, var(--t-bg-deep))"
            : T.bg.deep,
        }}
      >
        <input
          type="radio"
          name="mode"
          className="sr-only"
          checked={checked}
          onChange={() => onMode(value)}
        />
        <Icon
          aria-hidden="true"
          icon={checked ? "mdi:check-circle" : "mdi:circle-outline"}
          width={22}
          className="mt-0.5 shrink-0"
          style={{ color: checked ? T.accent.primary : T.border.hi }}
        />
        <span>
          <span className="block text-[15.5px] font-semibold">{title}</span>
          <span className="block text-[14px]" style={{ color: T.ink.dim }}>
            {hint}
          </span>
        </span>
      </label>
    )
  }

  return (
    <section>
      <Heading
        className="m-0 text-[30px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        Before you start
      </Heading>
      {intro ? (
        <p className="my-3 text-[15px]" style={{ color: T.ink.dim }}>
          {intro}
        </p>
      ) : null}
      <div
        className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border p-4"
        style={panel}
      >
        <div className="min-w-0 flex-1">
          <p
            className="m-0 text-[12.5px] font-semibold tracking-wide uppercase"
            style={{ color: T.ink.dim }}
          >
            Today’s route
          </p>
          <p className="m-0 text-[16px] font-semibold">{routeLabel}</p>
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            {routeTimes}
          </p>
        </div>
        {/* Keep the route summary readable at phone width. */}
        <button
          type="button"
          className="live-button w-full shrink-0 rounded-full px-4 sm:w-auto"
          onClick={onChangeRoute}
        >
          Change route
        </button>
      </div>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="sr-only">What to share</legend>
        {choice(
          "checkins",
          "Check-ins only",
          "We only update when you tap Arrived or Leaving."
        )}
        {allowApproximate ? (
          choice(
            "approximate",
            "Check-ins and live position",
            "Keep this page open with the screen on. Mount the phone and plug it in. Position between stops is shown roughly, about 250 m, a minute behind."
          )
        ) : (
          <p
            className="m-0 flex items-start gap-2 text-[14px]"
            style={{ color: T.ink.dim }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:map-marker-off-outline"
              width={16}
              className="mt-0.5 shrink-0"
            />
            Your library shares stops only. An owner can allow approximate
            position in the Go live settings.
          </p>
        )}
      </fieldset>
      {preview ? (
        <div className="my-4 rounded-[16px] border p-4" style={panel}>
          <p
            className="m-0 text-[12.5px] font-semibold tracking-wide uppercase"
            style={{ color: T.ink.dim }}
          >
            What the public sees
          </p>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-[15px]">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
              style={{
                background: TYPE_TINT.public.bg,
                color: TYPE_TINT.public.fg,
              }}
            >
              <Icon aria-hidden="true" icon="mdi:check" width={14} />
              {preview.label}
            </span>
            {preview.sentence}
          </p>
        </div>
      ) : null}
      <ul className="my-4 flex list-none flex-col gap-2 p-0 text-[14.5px]">
        {checklist.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Icon
              aria-hidden="true"
              icon="mdi:check"
              width={18}
              className="mt-0.5 shrink-0"
              style={{ color: T.ink.dim }}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="live-button live-primary rounded-full text-[17px]"
        style={{ minHeight: 64 }}
        disabled={busy || startDisabled}
        onClick={onStart}
      >
        {startLabel}
      </button>
      {extra}
    </section>
  )
}

/** The calm end-of-day screen. */
export function FinishedScreen({
  title,
  summary,
  note,
  backHref,
  backLabel,
  children,
  heading: Heading = "h2",
}: {
  readonly title: string
  readonly summary: string
  readonly note: string
  readonly backHref: string
  readonly backLabel: string
  readonly children?: ReactNode
  readonly heading?: HeadingTag
}) {
  return (
    <section className="flex flex-col items-center py-6 text-center">
      <span
        aria-hidden="true"
        className="flex size-20 items-center justify-center rounded-full"
        style={{ background: TYPE_TINT.public.bg, color: TYPE_TINT.public.fg }}
      >
        <Icon icon="mdi:check" width={40} />
      </span>
      <Heading
        className="mt-4 mb-2 text-[30px]"
        style={{ fontFamily: T.font.serif, fontWeight: 500 }}
      >
        {title}
      </Heading>
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        {summary}
      </p>
      <p className="mt-2 mb-5 text-[13.5px]" style={{ color: T.ink.dim }}>
        {note}
      </p>
      <Link className="live-button w-auto rounded-full px-6" href={backHref}>
        {backLabel}
      </Link>
      {children}
    </section>
  )
}
