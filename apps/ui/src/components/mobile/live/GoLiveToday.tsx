"use client"

import { Icon } from "@iconify/react"
import {
  localDateTime,
  toMinutes,
  type Occurrence,
  type PublicLiveState,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import { QrCode } from "@/components/ds/QrCode"
import { useStaff } from "@/lib/access-client"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { LiveSettingsResponse } from "@/lib/mobile-live/types"
import { shortDate } from "@/lib/staff/format"

import { registerLiveIcons } from "./icons"
import { useMobileClock } from "../useMobileClock"
import { liveRequest } from "./ConfirmIdentity"

const OUTLINED =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border bg-white px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"

/**
 * "Today and the way in": today's stops with Done / Here now chips from the
 * public live state, the console link (open, email, copy), the home-screen
 * hint and the QR tile.
 */
registerLiveIcons()

export function GoLiveToday({
  initial,
  live,
  locale,
  consoleUrl,
  today: initialToday,
  learnMoreHref,
}: {
  readonly initial: LiveSettingsResponse
  readonly live: PublicLiveState | null
  readonly locale: string
  readonly consoleUrl: string
  /** The server's date, used until the clock ticks (optional). */
  readonly today?: string
  /** "Going live from your phone" in Knowledge, when the page has it. */
  readonly learnMoreHref?: string
}) {
  const tUi = useUiTranslations("ui")

  const [busy, setBusy] = useState(false),
    [note, setNote] = useState<{ tone: "ok" | "danger"; text: string } | null>(
      null
    )
  const id = initial.library.id
  const route: Occurrence[] = initial.route
  const staff = useStaff()
  const allowed = staff.can("goLive", id)
  // "Done" follows the library's clock: a stop whose departure has passed
  // is over, whether or not anyone checked in from the vehicle.
  const now = useMobileClock()
  const local = now ? localDateTime(now, initial.library.timezone) : null
  const today = local?.date ?? initialToday ?? route[0]?.date ?? null
  const past = (v: Occurrence) =>
    local !== null &&
    v.date === local.date &&
    toMinutes(v.depart) <= local.minute
  const stopName = (stopId: string) =>
    initial.library.timetable?.stops.find((s) => s.id === stopId)?.name ??
    "Stop"
  const hereIndex =
    live && ["here", "late"].includes(live.kind) && live.stopId
      ? route.findIndex((v) => v.stopId === live.stopId)
      : live?.kind === "road" && live.nextStopId
        ? route.findIndex((v) => v.stopId === live.nextStopId) - 0.5
        : live?.kind === "finished"
          ? route.length
          : -1
  const stateOf = (index: number, v: Occurrence) =>
    live?.skippedStopIds.includes(v.stopId)
      ? "skipped"
      : index < hereIndex
        ? "done"
        : index === hereIndex && live?.kind !== "road"
          ? "here"
          : past(v)
            ? "done"
            : "todo"
  const dateLabel = today ? shortDate(today) : "Today"
  const meta = route.length
    ? `${dateLabel} · ${route.length} ${route.length === 1 ? "stop" : "stops"} · ${route[0]!.arrive}–${route.at(-1)!.depart}`
    : `${dateLabel} · no service today`

  return (
    <section
      className="grid gap-6 rounded-[24px] border p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_208px] lg:gap-x-8"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="go-live-today-heading"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col items-start gap-2">
          <h2
            id="go-live-today-heading"
            className="m-0 text-[28px] leading-[1.1] sm:text-[36px]"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            Today and the way in
          </h2>
          <p
            className="m-0 text-[14px] leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            {meta}
          </p>
        </div>
        {initial.activeSession ? (
          <p
            className="m-0 flex items-center gap-2 text-[14.5px] leading-relaxed"
            style={{ color: T.accent.ok }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:circle"
              width={10}
              className="motion-safe:animate-pulse"
            />
            Live now, started by{" "}
            {initial.activeSession.startedByName ?? "library staff"}.
          </p>
        ) : null}
        {route.length ? (
          <ol className="m-0 list-none overflow-hidden rounded-[16px] border border-(--t-border-line) p-0">
            {route.map((v, index) => {
              const state = stateOf(index, v)
              const here = state === "here"

              return (
                <li
                  key={v.visitId}
                  className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-(--t-divider) px-3 py-3 last:border-b-0 sm:grid-cols-[28px_minmax(0,1fr)_auto]"
                  style={{ background: here ? T.accent.chip : undefined }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums"
                    style={{
                      background: here ? T.accent.primary : T.bg.muted2,
                      color: here ? T.bg.deep : T.ink.base,
                    }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px]">
                    <span className="font-semibold">{stopName(v.stopId)}</span>{" "}
                    <span
                      className="block sm:inline"
                      style={{ color: T.ink.dim }}
                    >
                      {v.arrive}–{v.depart}
                    </span>
                  </span>
                  {state === "done" ? (
                    <span
                      className="col-start-2 inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold sm:col-start-auto sm:justify-self-end"
                      style={{
                        background: TYPE_TINT.public.bg,
                        color: TYPE_TINT.public.fg,
                      }}
                    >
                      <Icon
                        aria-hidden="true"
                        icon="mdi:check-circle-outline"
                        width={13}
                      />
                      {tUi("done")}{" "}
                    </span>
                  ) : here ? (
                    <span
                      className="col-start-2 inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold sm:col-start-auto sm:justify-self-end"
                      style={{ background: T.bg.deep, color: T.accent.primary }}
                    >
                      <Icon
                        aria-hidden="true"
                        icon="mdi:map-marker"
                        width={13}
                      />
                      Here now
                    </span>
                  ) : state === "skipped" ? (
                    <span
                      className="col-start-2 inline-flex items-center gap-1 justify-self-start rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold sm:col-start-auto sm:justify-self-end"
                      style={{ background: T.bg.muted, color: T.ink.dim }}
                    >
                      <Icon
                        aria-hidden="true"
                        icon="mdi:close-circle-outline"
                        width={13}
                      />
                      Not stopping today
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <p
            className="m-0 max-w-2xl text-[15px] leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            No scheduled service today. The console can use a swapped day’s
            route.
          </p>
        )}
        {!staff.ready ? (
          // Same height as the action row, so nothing jumps once the
          // session is known.
          <div className="grid gap-2.5 sm:flex sm:flex-wrap" aria-hidden="true">
            <span
              className="h-11 w-full rounded-full sm:w-48"
              style={{ background: T.bg.muted }}
            />
            <span
              className="h-11 w-full rounded-full sm:w-44"
              style={{ background: T.bg.muted }}
            />
            <span
              className="h-11 w-full rounded-full sm:w-28"
              style={{ background: T.bg.muted }}
            />
          </div>
        ) : !allowed ? (
          <p
            className="m-0 flex min-h-11 items-center gap-2 rounded-[14px] px-4 py-3 text-[14.5px]"
            style={{ background: T.bg.muted, color: T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:lock-outline"
              width={18}
              className="shrink-0"
              style={{ color: T.ink.dim }}
            />
            Ask an owner to let you go live. They choose who can, person by
            person.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:items-center">
            <a
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-2 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              href={consoleUrl}
            >
              <Icon aria-hidden="true" icon="mdi:circle" width={10} />
              Open the live console
            </a>
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setNote(null)
                try {
                  await liveRequest(`/api/mobile/${id}/live-link`, { locale })
                  setNote({
                    tone: "ok",
                    text: "The console link has been emailed to you.",
                  })
                } catch {
                  setNote({
                    tone: "danger",
                    text: "The link could not be emailed. Open it with the button or the QR code.",
                  })
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Icon aria-hidden="true" icon="mdi:email-outline" width={16} />
              Email me the link
            </button>
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(consoleUrl)
                  setNote({ tone: "ok", text: "Link copied." })
                } catch {
                  setNote({
                    tone: "danger",
                    text: "Copying is blocked here. Use the QR code or email instead.",
                  })
                }
              }}
            >
              <Icon aria-hidden="true" icon="mdi:content-copy" width={16} />
              {tUi("copy_link")}{" "}
            </button>
          </div>
        )}
        {learnMoreHref ? (
          <p className="m-0 text-[14px] leading-relaxed">
            <a
              href={learnMoreHref}
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Learn more: Going live from your phone
            </a>
          </p>
        ) : null}
        {note ? (
          <p
            role={note.tone === "danger" ? "alert" : "status"}
            className="m-0 flex items-start gap-2 text-[14px] leading-relaxed"
            style={{
              color: note.tone === "danger" ? T.accent.danger : T.accent.ok,
            }}
          >
            <Icon
              aria-hidden="true"
              icon={
                note.tone === "danger"
                  ? "mdi:alert-circle-outline"
                  : "mdi:check-circle-outline"
              }
              width={16}
              className="mt-0.5 shrink-0"
            />
            {note.text}
          </p>
        ) : null}
      </div>
      <div
        className="hidden flex-col items-center gap-3 self-start border-l pl-6 lg:flex"
        style={{ borderColor: T.border.divider }}
      >
        <div
          className="rounded-[16px] border p-2"
          style={{ borderColor: T.border.line, background: T.bg.deep }}
        >
          <QrCode
            value={consoleUrl}
            label={tUi("open_your_live_console_on_your_phone")}
            size={144}
          />
        </div>
        <p
          className="m-0 text-center text-[13px] leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          Scan to open the console on your phone. Staff sign-in required.
        </p>
      </div>
      <div
        className="flex items-start gap-3 rounded-[16px] p-4 lg:col-span-2"
        style={{ background: T.bg.surface }}
      >
        <Icon
          aria-hidden="true"
          icon="mdi:cellphone"
          width={20}
          className="mt-0.5 shrink-0"
          style={{ color: T.ink.dim }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p
            className="m-0 text-[14px] leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            <strong className="font-semibold" style={{ color: T.ink.base }}>
              Add the console to your phone’s home screen.
            </strong>{" "}
            Sign in once inside the installed app.
          </p>
          <dl className="m-0 grid gap-3 text-[14px] leading-relaxed sm:grid-cols-2 sm:gap-6">
            <div>
              <dt className="font-semibold" style={{ color: T.ink.base }}>
                iPhone
              </dt>
              <dd className="m-0" style={{ color: T.ink.dim }}>
                Safari → Share → Add to Home Screen
              </dd>
            </div>
            <div>
              <dt className="font-semibold" style={{ color: T.ink.base }}>
                Android
              </dt>
              <dd className="m-0" style={{ color: T.ink.dim }}>
                Chrome → menu → Install app
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
