"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { actionMeta } from "./actions"
import { LibraryPicker, type LibrarySuggestion } from "./LibraryPicker"
import {
  type ActionId,
  blockerFor,
  buildSubmission,
  CATEGORIES,
  draftKey,
  EMPTY_DRAFT,
  PHOTO_LICENCE,
  STEP_LABELS,
  type Step,
  type WizardDraft,
  type WizardLibrary,
} from "./wizard.logic"

const FIELD =
  "w-full rounded-[14px] border border-(--t-border-hi) bg-white px-4 py-3 text-[16px] outline-none transition-colors focus:border-(--t-accent-primary)"
const PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[16px] font-semibold transition-colors"
const SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border bg-white px-5 text-[16px] font-semibold transition-colors hover:bg-(--t-bg-surface)"

function readDraft(key: string): WizardDraft | null {
  try {
    const raw = globalThis.localStorage?.getItem(key)

    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as WizardDraft) } : null
  } catch {
    return null
  }
}

function writeDraft(key: string, draft: WizardDraft | null) {
  try {
    if (draft) globalThis.localStorage?.setItem(key, JSON.stringify(draft))
    else globalThis.localStorage?.removeItem(key)
  } catch {
    // storage unavailable: the draft lasts for this visit only
  }
}

const isBlank = (d: WizardDraft) =>
  !d.text.trim() && !d.source.trim() && !d.photo && !d.credit.trim()

function Progress({
  action,
  step,
}: {
  readonly action: ActionId
  readonly step: Step
}) {
  return (
    <ol
      aria-label="Progress"
      className="m-0 grid list-none grid-cols-3 gap-2 p-0"
    >
      {STEP_LABELS[action].map((label, i) => {
        const n = (i + 1) as Step
        const reached = n <= step

        return (
          <li key={label} aria-current={n === step ? "step" : undefined}>
            <span
              aria-hidden="true"
              className="block h-[5px] rounded-full"
              style={{ background: reached ? T.accent.primary : T.bg.muted2 }}
            />
            <span
              className="mt-2 block text-[14px] sm:text-[15px]"
              style={{
                color: n === step ? T.ink.base : T.ink.dim,
                fontWeight: n === step ? 600 : 500,
              }}
            >
              <span
                className="font-semibold"
                style={{ color: reached ? T.accent.primary : T.ink.dim }}
              >
                {n}
              </span>{" "}
              {label}
              <span className="sr-only">
                {n < step ? " (done)" : n === step ? " (current step)" : ""}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function Label({
  htmlFor,
  children,
  hint,
}: {
  readonly htmlFor: string
  readonly children: React.ReactNode
  readonly hint?: string
}) {
  return (
    <label
      className="mb-2 block text-[15px] font-semibold"
      htmlFor={htmlFor}
      style={{ color: T.ink.base }}
    >
      {children}
      {hint ? (
        <span className="font-normal" style={{ color: T.ink.dim }}>
          {" "}
          {hint}
        </span>
      ) : null}
    </label>
  )
}

function SignInPrompt({ returnTo }: { readonly returnTo: string }) {
  const callback = encodeURIComponent(returnTo)

  return (
    <div
      className="flex flex-col gap-3 rounded-[16px] p-5"
      style={{ background: T.accent.chip }}
    >
      <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
        <strong>Sign in to send it for review.</strong> Your draft is saved on
        this device, so it’ll be here when you come back.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          className={`${PRIMARY} h-10 bg-(--t-accent-primary) px-5 text-[15px] text-white no-underline hover:bg-(--t-accent-primary-hover)`}
          href={`/auth/signin?callbackUrl=${callback}`}
        >
          Sign in
        </Link>
        <Link
          className={`${SECONDARY} h-10 px-5 text-[15px] no-underline`}
          href={`/auth/register?callbackUrl=${callback}`}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          Create an account
        </Link>
      </div>
    </div>
  )
}

function PhotoUpload({
  photo,
  onChange,
}: {
  readonly photo: WizardDraft["photo"]
  readonly onChange: (photo: WizardDraft["photo"]) => void
}) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/submissions/upload-image", {
        method: "POST",
        body: form,
      })
      const json = (await res.json()) as {
        id?: number
        url?: string
        error?: string
      }
      if (!res.ok || !json.id || !json.url)
        setError(json.error ?? "Upload failed.")
      else onChange({ id: json.id, url: json.url })
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Label htmlFor={id} hint="JPEG, PNG or WebP, up to 10 MB">
        Photo
      </Label>
      {photo ? (
        <div className="flex flex-wrap items-end gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview */}
          <img
            alt="Your photo"
            className="h-40 w-auto max-w-full rounded-[14px] border object-cover"
            src={photo.url}
            style={{ borderColor: T.border.line }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`${SECONDARY} h-10 px-4 text-[15px]`}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Replace
          </button>
        </div>
      ) : (
        <label
          className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border-2 border-dashed px-6 py-8 text-center focus-within:border-(--t-accent-primary)"
          htmlFor={id}
          style={{ borderColor: T.border.hi, background: T.bg.surface }}
        >
          <Icon
            aria-hidden="true"
            height={26}
            icon={busy ? "mdi:loading" : "mdi:camera-outline"}
            className={
              busy ? "animate-spin motion-reduce:animate-none" : undefined
            }
            style={{ color: T.accent.primary }}
            width={26}
          />
          <span
            className="text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {busy ? "Uploading…" : "Choose a photo"}
          </span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            id={id}
            onChange={(e) => void upload(e.target.files?.[0])}
            type="file"
          />
        </label>
      )}
      {error ? (
        <p
          className="mt-2 mb-0 text-[14px] font-semibold"
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The three-step contribution form: pick a library, give the details, add a
 * source and send. Used inline on the /contribute hub and in the library
 * page's correction drawer (library locked, starting at Details). Drafts
 * save on this device per action and library.
 */
export function ContributionWizard({
  action,
  initialLibrary = null,
  initialCategory = null,
  lockLibrary = false,
  publishedCount,
  suggestions,
  returnTo,
  headingId,
}: {
  readonly action: ActionId
  readonly initialLibrary?: WizardLibrary | null
  readonly initialCategory?: string | null
  /** The drawer: the library can't be changed, so step 1 is skipped. */
  readonly lockLibrary?: boolean
  readonly publishedCount?: number
  readonly suggestions?: readonly LibrarySuggestion[]
  /** Where sign-in should bring the user back to (given the chosen library). */
  readonly returnTo: string | ((library: WizardLibrary | null) => string)
  readonly headingId?: string
}) {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const meta = actionMeta(action)
  const fallbackId = useId()
  const titleId = headingId ?? `${fallbackId}-title`
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const [library, setLibrary] = useState<WizardLibrary | null>(initialLibrary)
  const [step, setStep] = useState<Step>(
    initialLibrary && action !== "add" ? 2 : 1
  )
  const [draft, setDraft] = useState<WizardDraft>(() => ({
    ...EMPTY_DRAFT,
    ...(initialCategory &&
    (CATEGORIES as readonly string[]).includes(initialCategory)
      ? { category: initialCategory }
      : {}),
  }))
  const [restored, setRestored] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const moved = useRef(false)

  const key = library ? draftKey(action, library.slug) : null

  // Restore a saved draft once a library is known.
  useEffect(() => {
    if (!key) return
    const saved = readDraft(key)
    if (saved && !isBlank(saved)) {
      setDraft(saved)
      setRestored(true)
    }
  }, [key])

  // Save as the user types.
  useEffect(() => {
    if (key && !sent) writeDraft(key, isBlank(draft) ? null : draft)
  }, [key, draft, sent])

  // Move focus to the new step's heading, not on first render.
  useEffect(() => {
    if (moved.current) stepHeading.current?.focus()
    moved.current = true
  }, [step])

  const patch = (next: Partial<WizardDraft>) =>
    setDraft((d) => ({ ...d, ...next }))
  const blocker = blockerFor(action, step, library, draft)
  const firstStep: Step = lockLibrary ? 2 : 1

  const send = async () => {
    if (!library || action === "add") return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSubmission(action, library, draft)),
      })
      if (res.ok) {
        if (key) writeDraft(key, null)
        setSent(true)
      } else {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string | { message?: string }
        }
        const message =
          typeof json.error === "string" ? json.error : json.error?.message
        setError(message ?? "We couldn’t send that. Please try again.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const next = () => {
    if (action === "add") {
      router.push("/contribute/add")

      return
    }
    if (blocker) return
    if (step < 3) setStep((step + 1) as Step)
    else void send()
  }

  const startOver = () => {
    if (key) writeDraft(key, null)
    setDraft(EMPTY_DRAFT)
    setRestored(false)
  }

  if (sent)
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full"
          style={{ background: "var(--tint-public-bg)", color: T.accent.ok }}
        >
          <Icon height={24} icon="mdi:check" width={24} />
        </span>
        <h3
          id={titleId}
          className="m-0 text-[22px] font-bold"
          style={{ color: T.ink.base }}
        >
          Thanks, it’s in review
        </h3>
        <p
          className="m-0 max-w-[56ch] text-[16px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          A reviewer will check your{" "}
          {action === "photo" ? "photo" : "suggestion"} for {library?.name},
          usually within a few days. You can follow it in your submissions.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            className={`${PRIMARY} bg-(--t-accent-primary) text-white no-underline hover:bg-(--t-accent-primary-hover)`}
            href="/contribute/submissions"
          >
            See my submissions
          </Link>
          <button
            type="button"
            className={SECONDARY}
            onClick={() => {
              setSent(false)
              setDraft(EMPTY_DRAFT)
              setStep(firstStep)
            }}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Suggest something else
          </button>
        </div>
      </div>
    )

  const signInReturn =
    typeof returnTo === "function" ? returnTo(library) : returnTo
  const needsSignIn =
    !isPending &&
    !signedIn &&
    (step === 3 || (action === "photo" && step === 2))

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between gap-4">
        <h2
          id={titleId}
          className="m-0 flex items-center gap-3 text-[18px] font-bold"
          style={{ color: T.ink.base }}
        >
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full"
            style={{ background: meta.tintBg, color: meta.tintFg }}
          >
            <Icon height={19} icon={meta.icon} width={19} />
          </span>
          {meta.title}
        </h2>
        <p
          className="m-0 shrink-0 text-[15px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          Step {step} of 3
        </p>
      </div>

      <Progress action={action} step={step} />

      <div>
        {/* A focus target for each step; the step's own heading follows. */}
        <h3 ref={stepHeading} className="sr-only" tabIndex={-1}>
          Step {step}: {STEP_LABELS[action][step - 1]}
        </h3>

        {action === "add" ? (
          <p
            className="m-0 max-w-[60ch] text-[16px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            A new record starts in the guided form: name and place, opening
            hours, then your sources. It saves as you go.
          </p>
        ) : step === 1 ? (
          <LibraryPicker
            onSelect={(lib) => {
              setLibrary(lib)
              setRestored(false)
              if (!lib) setDraft(EMPTY_DRAFT)
            }}
            publishedCount={publishedCount}
            selected={library}
            suggestions={suggestions}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {library ? (
              <p
                className="m-0 flex flex-wrap items-center gap-x-2 text-[15px]"
                style={{ color: T.ink.dim }}
              >
                <Icon
                  aria-hidden="true"
                  height={17}
                  icon="mdi:bookshelf"
                  width={17}
                />
                <span className="font-semibold" style={{ color: T.ink.base }}>
                  {library.name}
                </span>
                {library.place ? <span>· {library.place}</span> : null}
                {!lockLibrary ? (
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-[3px]"
                    onClick={() => setStep(1)}
                    style={{ color: T.accent.primary }}
                  >
                    Change
                  </button>
                ) : null}
              </p>
            ) : null}

            {restored ? (
              <p
                className="m-0 flex items-center gap-2 text-[14px]"
                role="status"
                style={{ color: T.ink.dim }}
              >
                <Icon
                  aria-hidden="true"
                  height={16}
                  icon="mdi:content-save-outline"
                  width={16}
                />
                We restored your draft from this device.
                <button
                  type="button"
                  className="font-semibold underline underline-offset-[3px]"
                  onClick={startOver}
                  style={{ color: T.accent.primary }}
                >
                  Start over
                </button>
              </p>
            ) : null}

            {step === 2 && action === "photo" ? (
              needsSignIn ? (
                <SignInPrompt returnTo={signInReturn} />
              ) : (
                <>
                  <PhotoUpload
                    photo={draft.photo}
                    onChange={(photo) => patch({ photo })}
                  />
                  <div>
                    <Label htmlFor={`${titleId}-caption`} hint="Optional">
                      What does it show?
                    </Label>
                    <input
                      className={FIELD}
                      id={`${titleId}-caption`}
                      onChange={(e) => patch({ text: e.target.value })}
                      placeholder="e.g. The main entrance from the high street"
                      style={{ color: T.ink.base }}
                      value={draft.text}
                    />
                  </div>
                </>
              )
            ) : null}

            {step === 2 && action !== "photo" ? (
              <>
                <div>
                  <Label htmlFor={`${titleId}-category`}>
                    {action === "source"
                      ? "Which detail does it back up?"
                      : "What needs changing?"}
                  </Label>
                  <select
                    className={FIELD}
                    id={`${titleId}-category`}
                    onChange={(e) => patch({ category: e.target.value })}
                    style={{ color: T.ink.base }}
                    value={draft.category}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label
                    htmlFor={`${titleId}-text`}
                    hint={action === "correction" ? "Required" : "Optional"}
                  >
                    {action === "correction"
                      ? "What’s correct?"
                      : "What does the source confirm?"}
                  </Label>
                  <textarea
                    className={`${FIELD} min-h-[112px] resize-y`}
                    id={`${titleId}-text`}
                    onChange={(e) => patch({ text: e.target.value })}
                    placeholder={
                      action === "correction"
                        ? "e.g. Open until 8pm on Thursdays since September"
                        : "e.g. The opening hours on the council website"
                    }
                    style={{ color: T.ink.base }}
                    value={draft.text}
                  />
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                {action === "photo" ? (
                  <>
                    <div>
                      <Label
                        htmlFor={`${titleId}-credit`}
                        hint="Optional, as you’d like to be credited"
                      >
                        Photo credit
                      </Label>
                      <input
                        className={FIELD}
                        id={`${titleId}-credit`}
                        onChange={(e) => patch({ credit: e.target.value })}
                        style={{ color: T.ink.base }}
                        value={draft.credit}
                      />
                    </div>
                    <label
                      className="flex cursor-pointer items-start gap-3 text-[15px]"
                      style={{ color: T.ink.base }}
                    >
                      <input
                        checked={draft.licence}
                        className="mt-0.5 size-5 shrink-0"
                        onChange={(e) => patch({ licence: e.target.checked })}
                        style={{ accentColor: "var(--t-accent-primary)" }}
                        type="checkbox"
                      />
                      <span>
                        I took this photo, or have permission to share it, and
                        I’m happy for it to be published under {PHOTO_LICENCE}.
                      </span>
                    </label>
                  </>
                ) : (
                  <div>
                    <Label
                      htmlFor={`${titleId}-source`}
                      hint={
                        action === "source"
                          ? "Required"
                          : "Optional, but it helps reviewers accept changes faster"
                      }
                    >
                      Source
                    </Label>
                    <input
                      className={FIELD}
                      id={`${titleId}-source`}
                      onChange={(e) => patch({ source: e.target.value })}
                      placeholder="A link, or where you saw it"
                      style={{ color: T.ink.base }}
                      value={draft.source}
                    />
                  </div>
                )}

                <dl
                  className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[16px] p-4 text-[14.5px]"
                  style={{
                    background: T.bg.surface,
                    border: `1px solid ${T.border.line}`,
                  }}
                >
                  <dt style={{ color: T.ink.dim }}>Library</dt>
                  <dd className="m-0 font-semibold">{library?.name}</dd>
                  {action === "photo" ? (
                    <>
                      <dt style={{ color: T.ink.dim }}>Photo</dt>
                      <dd className="m-0">
                        {draft.photo ? "Uploaded" : "None yet"}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt style={{ color: T.ink.dim }}>Detail</dt>
                      <dd className="m-0">{draft.category}</dd>
                      {draft.text.trim() ? (
                        <>
                          <dt style={{ color: T.ink.dim }}>
                            {action === "correction" ? "Correct" : "Confirms"}
                          </dt>
                          <dd className="m-0 break-words">
                            {draft.text.trim()}
                          </dd>
                        </>
                      ) : null}
                    </>
                  )}
                </dl>

                {needsSignIn ? <SignInPrompt returnTo={signInReturn} /> : null}
              </>
            ) : null}
          </div>
        )}
      </div>

      {error ? (
        <p
          className="m-0 text-[15px] font-semibold"
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-3 border-t pt-6"
        style={{ borderColor: T.border.divider }}
      >
        {step > firstStep ? (
          <button
            type="button"
            className={SECONDARY}
            onClick={() => setStep((step - 1) as Step)}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Back
          </button>
        ) : null}
        {needsSignIn ? null : (
          <button
            type="button"
            aria-describedby={blocker ? `${titleId}-blocker` : undefined}
            aria-disabled={Boolean(blocker) || sending}
            className={`${PRIMARY} ${
              blocker || sending
                ? "cursor-not-allowed"
                : "bg-(--t-accent-primary) text-white hover:bg-(--t-accent-primary-hover)"
            }`}
            onClick={next}
            style={
              blocker || sending
                ? { background: T.bg.muted2, color: T.ink.dim }
                : undefined
            }
          >
            {action === "add"
              ? "Open the full form"
              : step === 3
                ? sending
                  ? "Sending…"
                  : "Send for review"
                : "Continue"}
          </button>
        )}
        {blocker && !needsSignIn ? (
          <p
            aria-live="polite"
            className="m-0 text-[15px]"
            id={`${titleId}-blocker`}
            style={{ color: T.ink.dim }}
          >
            {blocker}
          </p>
        ) : null}
      </div>
    </div>
  )
}
