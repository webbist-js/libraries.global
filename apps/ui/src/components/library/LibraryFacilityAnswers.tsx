"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  facilityAnswersBody,
  type FacilityRow,
} from "@/components/library/facility-rows"
import { LibraryFeatureDetails } from "@/components/library/LibraryFeatureDetails"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

type Answer = "yes" | "no" | "unsure"

const storageKey = (slug: string) => `library.facility-answers.${slug}`

function readSaved(slug: string): Record<string, Answer> {
  try {
    const raw = sessionStorage.getItem(storageKey(slug))

    return raw ? (JSON.parse(raw) as Record<string, Answer>) : {}
  } catch {
    return {}
  }
}

function writeSaved(slug: string, answers: Record<string, Answer> | null) {
  try {
    if (answers && Object.keys(answers).length > 0)
      sessionStorage.setItem(storageKey(slug), JSON.stringify(answers))
    else sessionStorage.removeItem(storageKey(slug))
  } catch {
    // storage unavailable — answers just won't survive sign-in
  }
}

const answerPill =
  "min-h-11 min-w-[42px] rounded-full border px-2.5 py-1 text-sm font-semibold transition-colors disabled:cursor-default"

/**
 * The accessibility grid: documented facilities are marked Yes, confirmed
 * absences No; for the rest, readers tap Yes or No and send their answers together as one
 * correction for a reviewer. Signed-out answers are kept for the session,
 * so they're still there after signing in. A drive's task panel passes
 * `driveDocumentId` to tag the answers with its drive (and `onSent` to move
 * on); when the drive's rules refuse them (422), the reader can send them
 * without the drive instead.
 */
export function LibraryFacilityAnswers({
  rows,
  grouped = false,
  librarySlug,
  libraryName,
  libraryPath,
  libraryDocumentId,
  driveDocumentId,
  onSent,
}: {
  readonly grouped?: boolean
  readonly rows: FacilityRow[]
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryPath: string
  /** Names the library by id too, so a drive can tell it's in review. */
  readonly libraryDocumentId?: string
  /** The drive these answers count toward, sent at the top level. */
  readonly driveDocumentId?: string
  /** Called once the answers are with a reviewer. */
  readonly onSent?: () => void
}) {
  const tUi = useUiTranslations("ui")
  const tPage = useUiTranslations("libraryPage")

  const { data: session, isPending } = authClient.useSession()
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)
  // The drive's rules refused the answers: offer them without the drive.
  const [refused, setRefused] = useState(false)

  useEffect(() => {
    setAnswers(readSaved(librarySlug))
  }, [librarySlug])

  const choose = (label: string, answer: Answer) => {
    if (state === "sent" || state === "sending") return
    setState("idle")
    setAnswers((prev) => {
      const next = { ...prev }
      if (next[label] === answer) delete next[label]
      else next[label] = answer
      writeSaved(librarySlug, next)

      return next
    })
  }

  // Only questions still open count: a saved answer may since have been
  // settled by an approved correction.
  const open = new Set(
    rows.filter((r) => r.state === "unknown").map((r) => r.label)
  )
  const pending = Object.entries(answers).filter(
    (entry): entry is [string, "yes" | "no"] =>
      open.has(entry[0]) && (entry[1] === "yes" || entry[1] === "no")
  )
  const count = pending.length

  const send = async (withDrive = true) => {
    setState("sending")
    setError(null)
    setRefused(false)
    const drive = withDrive ? driveDocumentId : undefined
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          facilityAnswersBody({
            slug: librarySlug,
            name: libraryName,
            answers: pending,
            documentId: libraryDocumentId,
            driveDocumentId: drive,
          })
        ),
      })
      if (res.ok) {
        writeSaved(librarySlug, null)
        setState("sent")
        onSent?.()

        return
      }
      const json = (await res.json().catch(() => ({}))) as {
        error?: string | { message?: string }
      }
      setError(
        (typeof json.error === "string" ? json.error : json.error?.message) ??
          "We couldn’t send your answers. Please try again."
      )
      setRefused(res.status === 422 && Boolean(drive))
      setState("error")
    } catch {
      setError("Network error. Please try again.")
      setState("error")
    }
  }

  const locked = state === "sent" || state === "sending"

  const renderRow = ({
    label,
    icon,
    state: known,
    summary,
    description,
    detailCategory,
  }: FacilityRow) => {
    const picked = answers[label]
    const labelId = `fac-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`

    return (
      <li
        key={label}
        className={
          grouped
            ? known === "unknown"
              ? "my-3 flex flex-wrap items-center gap-3 rounded-xl p-3"
              : "flex items-center gap-3 py-1.5"
            : "flex flex-wrap items-center gap-3 py-2.5"
        }
        style={{
          borderTop: `1px solid ${T.border.divider}`,
          background: grouped && known === "unknown" ? T.bg.surface : undefined,
        }}
      >
        <span
          aria-hidden="true"
          className={
            grouped
              ? "hidden"
              : "flex size-8 shrink-0 items-center justify-center rounded-[10px]"
          }
          style={{
            background: known === "yes" ? "var(--tint-public-bg)" : T.bg.muted,
            color: known === "yes" ? "var(--tint-public-fg)" : T.ink.dim,
          }}
        >
          <Icon height={18} icon={icon} width={18} />
        </span>
        <span
          id={labelId}
          className={
            grouped
              ? "min-w-0 flex-1 text-sm font-medium"
              : "min-w-0 flex-1 text-base font-medium"
          }
          style={{ color: T.ink.base }}
        >
          <LibraryFeatureDetails
            name={label}
            summary={summary}
            description={description}
            detailCategory={detailCategory}
          />
        </span>
        {known !== "unknown" ? (
          <span
            className="inline-flex items-center gap-1 text-sm font-semibold"
            style={{
              color: known === "yes" ? "var(--tint-public-fg)" : T.ink.dim,
            }}
          >
            <Icon
              aria-hidden="true"
              height={16}
              icon={known === "yes" ? "mdi:check" : "mdi:close"}
              width={16}
            />
            {known === "yes" ? tUi("yes") : tUi("no")}
          </span>
        ) : (
          <span
            role="group"
            aria-labelledby={labelId}
            className={
              grouped
                ? "flex w-full shrink-0 flex-wrap gap-1.5"
                : "flex shrink-0 gap-1.5"
            }
          >
            <span className="sr-only">Not recorded. </span>
            {(["yes", "no", "unsure"] as const).map((a) => {
              const on = picked === a

              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  disabled={locked}
                  onClick={() => choose(label, a)}
                  className={answerPill}
                  style={{
                    background: on ? T.ink.base : T.bg.deep,
                    borderColor: on ? T.ink.base : T.border.hi,
                    color: on ? "#fff" : T.ink.base,
                  }}
                >
                  {a === "unsure"
                    ? tPage("notSure")
                    : a === "yes"
                      ? tUi("yes")
                      : tUi("no")}
                </button>
              )
            })}
          </span>
        )}
      </li>
    )
  }

  return (
    <div>
      {grouped ? (
        <div className="grid gap-5">
          {rows.some((row) => row.state !== "unknown") ? (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {(["accessibility", "amenity"] as const).map((category) => {
                const known = rows.filter(
                  (row) => row.category === category && row.state !== "unknown"
                )

                return known.length ? (
                  <div key={category}>
                    <h3 className="type-h3 m-0 mb-2">
                      {tPage(
                        category === "accessibility" ? "access" : "facilities"
                      )}
                    </h3>
                    <ul className="m-0 list-none p-0">
                      {known.map(renderRow)}
                    </ul>
                  </div>
                ) : null
              })}
            </div>
          ) : null}
          {rows.some((row) => row.state === "unknown") ? (
            <div
              className="rounded-2xl border p-4 sm:p-5"
              style={{ borderColor: T.border.line, background: T.bg.space }}
            >
              <h3 className="type-h3 m-0">{tPage("questionsTitle")}</h3>
              <p
                className="mt-1 mb-3 text-sm leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                {tPage("questionsIntro")}
              </p>
              <ul className="m-0 grid list-none gap-x-4 p-0 sm:grid-cols-2">
                {rows
                  .filter((row) => row.state === "unknown")
                  .slice(0, 3)
                  .map(renderRow)}
              </ul>
              {rows.filter((row) => row.state === "unknown").length > 3 ? (
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold underline underline-offset-4">
                    {tPage("moreQuestions", {
                      count:
                        rows.filter((row) => row.state === "unknown").length -
                        3,
                    })}
                  </summary>
                  <ul className="m-0 grid list-none gap-x-4 p-0 sm:grid-cols-2">
                    {rows
                      .filter((row) => row.state === "unknown")
                      .slice(3)
                      .map(renderRow)}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2">
          {rows.map(renderRow)}
        </ul>
      )}

      <div aria-live="polite" className="mt-3">
        {state === "sent" ? (
          <p
            className="m-0 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{ background: "var(--tint-public-bg)", color: T.accent.ok }}
          >
            <Icon
              aria-hidden="true"
              height={18}
              icon="mdi:check-circle-outline"
              width={18}
            />
            Thanks. Your answers are with a reviewer.
          </p>
        ) : count > 0 ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: T.accent.chip }}
          >
            <span className="flex-1 text-sm" style={{ color: T.ink.base }}>
              {count} {count === 1 ? "answer" : "answers"} ready to send.
            </span>
            {isPending ? null : session?.user ? (
              <button
                type="button"
                onClick={() => void send()}
                disabled={state === "sending"}
                className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:opacity-70"
              >
                {state === "sending" ? tUi("sending") : "Send for review"}
              </button>
            ) : (
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(`${libraryPath}#access`)}`}
                className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-sm font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              >
                Sign in to send
              </Link>
            )}
          </div>
        ) : null}
        {state === "error" && error ? (
          <p className="mt-2 mb-0 text-sm" style={{ color: T.accent.danger }}>
            {error}
          </p>
        ) : null}
        {state === "error" && refused ? (
          <button
            type="button"
            onClick={() => void send(false)}
            className="mt-2 rounded-full border border-(--t-border-hi) bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface)"
            style={{ color: T.ink.base }}
          >
            Send without the drive
          </button>
        ) : null}
      </div>
    </div>
  )
}
