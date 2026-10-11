"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"

import type { WizardLibrary } from "@/components/contribute/wizard.logic"
import {
  availableSections,
  type VerifyRecord,
  type VerifySection,
  verifyPayload,
  verifyProblem,
  verifyProblemField,
} from "@/components/library/verify.logic"
import { VerifyFields } from "@/components/library/VerifyFields"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

/** The library the drawer is open on, with the values a reader confirms. */
export type VerifyLibrary = WizardLibrary & VerifyRecord

// The correction drawer's own button styles (ContributionWizard).
const PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[16px] font-semibold transition-colors"
const SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border bg-white px-5 text-[16px] font-semibold transition-colors hover:bg-(--t-bg-surface)"
const CTA = `${PRIMARY} bg-(--t-accent-primary) text-white no-underline hover:bg-(--t-accent-primary-hover)`

/**
 * "Is this still right?": the correction drawer's confirm panel. A reader
 * ticks the parts of the record they've checked and says where; it goes to
 * the Moderators as a `correction` with `fields.kind: "verify"`.
 */
export function LibraryVerify({
  library,
  initial,
  onDone,
  returnTo,
}: {
  readonly library: VerifyLibrary
  /** The sections ticked to start with (the link the reader followed). */
  readonly initial: readonly VerifySection[]
  readonly onDone: () => void
  /** Where sign-in brings the reader back to; defaults to this page. */
  readonly returnTo?: string
}) {
  const tUi = useUiTranslations("ui")

  const id = useId()
  const { data: session, isPending } = authClient.useSession()
  const available = availableSections(library)
  const [sections, setSections] = useState<VerifySection[]>(() =>
    available.filter((s) => initial.includes(s))
  )
  const [source, setSource] = useState("")
  const [inPerson, setInPerson] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The field the problem is about, so it's announced with that field.
  const [problemOn, setProblemOn] = useState<"sections" | "source" | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [expired, setExpired] = useState(false)
  const thanks = useRef<HTMLHeadingElement>(null)

  // The Send button goes once it's sent, so focus moves to the thanks.
  useEffect(() => {
    if (sent) thanks.current?.focus()
  }, [sent])

  const signedOut = expired || (!isPending && !session?.user)
  const back =
    returnTo ??
    (typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`)
  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(back)}`

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (sending) return
    const input = { sections, source, inPerson }
    const why = verifyProblem(input)
    setProblem(why)
    setProblemOn(why ? verifyProblemField(input) : null)
    if (why) return
    setSending(true)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          verifyPayload({ ...input, slug: library.slug, name: library.name })
        ),
      })
      if (res.ok) {
        setSent(true)

        return
      }
      if (res.status === 401) {
        setExpired(true)
        setProblem("Your session has ended. Sign in to send it.")

        return
      }
      const json = (await res.json().catch(() => ({}))) as {
        error?: string | { message?: string }
      }
      const message =
        typeof json.error === "string" ? json.error : json.error?.message
      setProblem(message ?? "We couldn’t send that. Please try again.")
    } catch {
      setProblem("Network error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  if (sent)
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          role="status"
          className="mx-auto flex w-full max-w-[640px] flex-col items-start gap-3 px-5 py-7 sm:px-8"
        >
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full"
            style={{ background: "var(--tint-public-bg)", color: T.accent.ok }}
          >
            <Icon height={24} icon="mdi:check" width={24} />
          </span>
          <h3
            ref={thanks}
            className="m-0 text-[22px] font-bold outline-none"
            style={{ color: T.ink.base }}
            tabIndex={-1}
          >
            Thanks. A Moderator will check it.
          </h3>
          <p
            className="m-0 max-w-[56ch] text-[16px] leading-normal"
            style={{ color: T.ink.dim }}
          >
            Once it’s approved, {library.name} shows these details as checked
            today. You can follow it in your submissions.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className={SECONDARY}
              onClick={onDone}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              type="button"
            >
              {tUi("close")}{" "}
            </button>
            <Link className={CTA} href="/contribute/submissions">
              See my submissions
            </Link>
          </div>
        </div>
      </div>
    )

  return (
    <form
      aria-labelledby={`${id}-title`}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={send}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-5 py-7 sm:px-8">
          <div>
            <h3
              id={`${id}-title`}
              className="m-0 text-[22px] font-bold"
              style={{ color: T.ink.base }}
            >
              Is this still right?
            </h3>
            <p
              className="m-0 mt-1.5 max-w-[56ch] text-[16px] leading-normal"
              style={{ color: T.ink.dim }}
            >
              Confirm what you’ve checked. A Moderator reviews it, then it shows
              as checked today.
            </p>
          </div>

          <VerifyFields
            available={available}
            idPrefix={id}
            inPerson={inPerson}
            onInPerson={setInPerson}
            onSections={setSections}
            onSource={setSource}
            problem={problem}
            problemField={problemOn}
            record={library}
            sections={sections}
            source={source}
          />
        </div>
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center gap-3 border-t px-5 py-4 sm:px-6"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        {signedOut ? (
          <Link className={CTA} href={signInHref}>
            Sign in to confirm
          </Link>
        ) : (
          <button
            aria-disabled={sending}
            className={`${PRIMARY} ${
              sending
                ? "cursor-not-allowed"
                : "bg-(--t-accent-primary) text-white hover:bg-(--t-accent-primary-hover)"
            }`}
            style={
              sending
                ? { background: T.bg.muted2, color: T.ink.dim }
                : undefined
            }
            type="submit"
          >
            {sending ? tUi("sending") : tUi("send")}
          </button>
        )}
        <button
          className={SECONDARY}
          onClick={onDone}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
          type="button"
        >
          {tUi("cancel")}{" "}
        </button>
      </div>
    </form>
  )
}
