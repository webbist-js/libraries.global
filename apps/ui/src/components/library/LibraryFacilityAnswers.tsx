"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"

import type { FacilityRow } from "@/components/library/facility-rows"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

type Answer = "yes" | "no"

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
  "min-w-[42px] rounded-full border px-2.5 py-1 text-[13px] font-semibold transition-colors disabled:cursor-default"

/**
 * The accessibility grid: documented facilities are marked Yes, confirmed
 * absences No; for the rest, readers tap Yes or No and send their answers together as one
 * correction for a reviewer. Signed-out answers are kept for the session,
 * so they're still there after signing in.
 */
export function LibraryFacilityAnswers({
  rows,
  librarySlug,
  libraryName,
  libraryPath,
}: {
  readonly rows: FacilityRow[]
  readonly librarySlug: string
  readonly libraryName: string
  readonly libraryPath: string
}) {
  const { data: session, isPending } = authClient.useSession()
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)

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
  const pending = Object.entries(answers).filter(([label]) => open.has(label))
  const count = pending.length

  const send = async () => {
    setState("sending")
    setError(null)
    const list = pending
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "correction",
          targetEntityType: "library",
          targetSlug: librarySlug,
          editSummary: `Accessibility: ${list.map(([k, v]) => `${k} ${v}`).join(", ")}`,
          fields: {
            kind: "facilities",
            category: "Accessibility",
            libraryName,
            answers: Object.fromEntries(list),
          },
        }),
      })
      if (res.ok) {
        writeSaved(librarySlug, null)
        setState("sent")

        return
      }
      const json = (await res.json().catch(() => ({}))) as {
        error?: string | { message?: string }
      }
      setError(
        (typeof json.error === "string" ? json.error : json.error?.message) ??
          "We couldn’t send your answers. Please try again."
      )
      setState("error")
    } catch {
      setError("Network error. Please try again.")
      setState("error")
    }
  }

  const locked = state === "sent" || state === "sending"

  return (
    <div>
      <ul className="m-0 grid list-none gap-x-6 p-0 md:grid-cols-2">
        {rows.map(({ label, icon, state: known }) => {
          const picked = answers[label]
          const labelId = `fac-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`

          return (
            <li
              key={label}
              className="flex items-center gap-3 py-2.5"
              style={{ borderTop: `1px solid ${T.border.divider}` }}
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-[10px]"
                style={{
                  background:
                    known === "yes" ? "var(--tint-public-bg)" : T.bg.muted,
                  color: known === "yes" ? "var(--tint-public-fg)" : T.ink.dim,
                }}
              >
                <Icon height={18} icon={icon} width={18} />
              </span>
              <span
                id={labelId}
                className="min-w-0 flex-1 text-[15px] font-medium"
                style={{ color: T.ink.base }}
              >
                {label}
              </span>
              {known !== "unknown" ? (
                <span
                  className="inline-flex items-center gap-1 text-[13.5px] font-semibold"
                  style={{
                    color:
                      known === "yes" ? "var(--tint-public-fg)" : T.ink.dim,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    height={16}
                    icon={known === "yes" ? "mdi:check" : "mdi:close"}
                    width={16}
                  />
                  {known === "yes" ? "Yes" : "No"}
                </span>
              ) : (
                <span
                  role="group"
                  aria-labelledby={labelId}
                  className="flex shrink-0 gap-1.5"
                >
                  {(["yes", "no"] as const).map((a) => {
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
                        {a === "yes" ? "Yes" : "No"}
                      </button>
                    )
                  })}
                </span>
              )}
            </li>
          )
        })}
      </ul>

      <div aria-live="polite" className="mt-3">
        {state === "sent" ? (
          <p
            className="m-0 flex items-center gap-2 rounded-2xl px-4 py-3 text-[14.5px] font-semibold"
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
            <span
              className="flex-1 text-[14.5px]"
              style={{ color: T.ink.base }}
            >
              {count} {count === 1 ? "answer" : "answers"} ready to send.
            </span>
            {isPending ? null : session?.user ? (
              <button
                type="button"
                onClick={send}
                disabled={state === "sending"}
                className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:opacity-70"
              >
                {state === "sending" ? "Sending…" : "Send for review"}
              </button>
            ) : (
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(`${libraryPath}#access`)}`}
                className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              >
                Sign in to send
              </Link>
            )}
          </div>
        ) : null}
        {state === "error" && error ? (
          <p
            className="mt-2 mb-0 text-[14px]"
            style={{ color: T.accent.danger }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
