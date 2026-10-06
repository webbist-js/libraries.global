"use client"

import { Icon } from "@iconify/react"
import { findUnsafeContent } from "@repo/shared-data"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { useCapabilities } from "@/lib/access-client"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { actionFor } from "./actions"
import {
  type CorrectionRecord,
  describeChanges,
  editorFor,
  hasRecordChange,
  recordChanges,
} from "./correction.logic"
import { CorrectionEditor } from "./CorrectionEditor"
import { LibraryPicker, type LibrarySuggestion } from "./LibraryPicker"
import { PhotoUpload } from "./PhotoUpload"
import { FIELD, Label, PRIMARY, SECONDARY } from "./wizard-ui"
import {
  type ActionId,
  blockerFor,
  buildSubmission,
  CATEGORIES,
  CATEGORY_OPTIONS,
  categoryOption,
  DRAWER_STEPS,
  draftKey,
  EMPTY_DRAFT,
  isHandoff,
  PHOTO_LICENCE,
  STEP_HINTS,
  STEP_LABELS,
  STEP_TITLES,
  type Step,
  type WizardDraft,
  type WizardLibrary,
} from "./wizard.logic"

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
  !d.text.trim() &&
  !d.source.trim() &&
  !d.photo &&
  !d.credit.trim() &&
  (!d.record || Object.keys(d.record).length === 0)

function Progress({
  labels,
  step,
}: {
  readonly labels: readonly string[]
  readonly step: Step
}) {
  return (
    <ol
      aria-label="Progress"
      className="m-0 grid list-none grid-cols-3 gap-2 p-0"
    >
      {labels.map((label, i) => {
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

/**
 * The left rail: where you are in the three steps, and a tip. In the hub
 * panel it also names the action; in the drawer the header does that.
 */
function StepRail({
  action,
  step,
  done,
  titleId,
  labels,
  hints,
  drawer = false,
}: {
  readonly action: ActionId
  readonly step: Step
  /** Every step is complete (the submission was sent). */
  readonly done: boolean
  readonly titleId: string
  readonly labels: readonly string[]
  readonly hints: readonly string[]
  readonly drawer?: boolean
}) {
  const { has } = useCapabilities()
  const meta = actionFor(action, has)
  // The panel collapses below lg, so it shows hints and lines only there;
  // the drawer's rail is hidden on phones and always shows them.
  const wide = drawer ? "block" : "hidden lg:block"

  return (
    <div
      className={`flex h-full flex-col ${drawer ? "gap-5" : "gap-5 lg:gap-7"}`}
    >
      {drawer ? (
        <p
          className="m-0 text-[15px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          {done ? "Sent for review" : `Step ${step} of 3`}
        </p>
      ) : (
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: meta.tintBg, color: meta.tintFg }}
          >
            <Icon height={21} icon={meta.icon} width={21} />
          </span>
          <span className="flex min-w-0 flex-col">
            <h2
              id={titleId}
              className="m-0"
              style={{
                fontFamily: T.font.serif,
                fontSize: "24px",
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                color: T.ink.base,
              }}
            >
              {meta.title}
            </h2>
            <span className="mt-0.5 text-[15px]" style={{ color: T.ink.dim }}>
              {meta.handoff
                ? (meta.note ?? "Opens a full editor")
                : done
                  ? "Sent for review"
                  : `Step ${step} of 3`}
            </span>
          </span>
        </div>
      )}

      <ol aria-label="Progress" className="m-0 flex list-none flex-col p-0">
        {labels.map((label, i) => {
          const n = (i + 1) as Step
          const complete = done || n < step
          const current = !done && !meta.handoff && n === step
          const last = i === 2

          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={
                drawer
                  ? "relative flex items-start gap-3.5 pb-5 last:pb-0"
                  : "relative flex items-center gap-3.5 pb-3 last:pb-0 lg:items-start lg:pb-6"
              }
            >
              {!last ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-9 bottom-0 left-[17px] w-[2px] rounded-full ${wide}`}
                  style={{
                    background: complete ? T.accent.primary : T.border.line,
                  }}
                />
              ) : null}
              <span
                aria-hidden="true"
                className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold"
                style={
                  current || complete
                    ? { background: T.accent.primary, color: "#fff" }
                    : {
                        background: T.bg.deep,
                        color: T.ink.dim,
                        border: `1.5px solid ${T.border.hi}`,
                      }
                }
              >
                {complete ? (
                  <Icon height={17} icon="mdi:check" width={17} />
                ) : (
                  n
                )}
              </span>
              <span
                className={`flex min-w-0 flex-col ${drawer ? "pt-1" : "lg:pt-1"}`}
              >
                <span
                  className="text-[16px] font-semibold"
                  style={{
                    color: current || complete ? T.ink.base : T.ink.dim,
                  }}
                >
                  {label}
                  <span className="sr-only">
                    {complete ? " (done)" : current ? " (current step)" : ""}
                  </span>
                </span>
                <span
                  className={`text-[14.5px] ${wide === "block" ? "" : "hidden lg:block"}`}
                  style={{ color: T.ink.dim }}
                >
                  {hints[i]}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <p
        className={`m-0 mt-auto items-start gap-2.5 rounded-[16px] px-4 py-3.5 text-[15px] leading-[1.5] ${drawer ? "flex" : "hidden lg:flex"}`}
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          color: T.ink.base,
        }}
      >
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          height={18}
          icon="mdi:lightbulb-outline"
          style={{ color: T.accent.primary }}
          width={18}
        />
        {meta.tip}
      </p>
    </div>
  )
}

/**
 * The drawer's first step: one radio card per part of the record. Native
 * radios, so arrow keys move between cards; the ring shows on the card.
 */
function CategoryCards({
  name,
  value,
  onChange,
  labelledBy,
}: {
  readonly name: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly labelledBy: string
}) {
  return (
    <fieldset
      aria-labelledby={labelledBy}
      className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 min-[420px]:grid-cols-2"
    >
      {CATEGORY_OPTIONS.map((c) => {
        const checked = value === c.value
        // The catch-all closes the grid at full width.
        const wide = c.value === "Something else"

        return (
          <label
            key={c.value}
            className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3 outline-offset-2 outline-(--t-accent-primary) transition-colors has-[:focus-visible]:outline-[3px] ${
              checked ? "" : "hover:border-(--t-border-hi)"
            } ${wide ? "min-[420px]:col-span-2" : ""}`}
            style={{
              background: checked ? T.accent.chip : T.bg.deep,
              border: `2px solid ${checked ? T.accent.primary : T.border.line}`,
              color: T.ink.base,
            }}
          >
            <input
              checked={checked}
              className="sr-only"
              name={name}
              onChange={() => onChange(c.value)}
              type="radio"
              value={c.value}
            />
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: checked ? T.bg.deep : T.bg.muted,
                color: checked ? T.accent.primary : T.ink.dim,
              }}
            >
              <Icon height={18} icon={c.icon} width={18} />
            </span>
            <span className="text-[16px] leading-[1.25] font-semibold">
              {c.value}
            </span>
          </label>
        )
      })}
    </fieldset>
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
  layout = "stacked",
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
  /**
   * `stacked` (default): title, progress bar and form in one column.
   * `panel`: the hub's two-column panel, a step rail on the left and the
   * form on the right. `drawer`: the library page's correction drawer, with
   * the library locked, step 1 picking the part of the record, and the
   * buttons in a bar along the bottom. The drawer's own header names it,
   * so pass that heading's id as `headingId`.
   */
  readonly layout?: "stacked" | "panel" | "drawer"
}) {
  const panel = layout === "panel"
  const drawer = layout === "drawer"
  const locked = drawer || lockLibrary
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const { has } = useCapabilities()
  const meta = actionFor(action, has)
  const fallbackId = useId()
  const titleId = headingId ?? `${fallbackId}-title`
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const [library, setLibrary] = useState<WizardLibrary | null>(initialLibrary)
  const [step, setStep] = useState<Step>(
    initialLibrary && !meta.handoff && !drawer ? 2 : 1
  )
  // The drawer asks for the category first, so nothing is picked for the
  // user unless a link on the page chose one.
  const emptyDraft: WizardDraft = drawer
    ? { ...EMPTY_DRAFT, category: "" }
    : EMPTY_DRAFT
  const [draft, setDraft] = useState<WizardDraft>(() => ({
    ...emptyDraft,
    ...(initialCategory &&
    (CATEGORIES as readonly string[]).includes(initialCategory)
      ? { category: initialCategory }
      : {}),
  }))
  const [restored, setRestored] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  // The step last rendered, so focus moves only when the step changes (and
  // never on mount, even when React runs effects twice in development).
  const shownStep = useRef(step)

  const key = library ? draftKey(action, library.slug) : null

  // Corrections start from the library's published values, so structured
  // editors (hours, options, address...) can show what's there now.
  const [current, setCurrent] = useState<{
    slug: string
    record: CorrectionRecord | null
  } | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const slug = action === "correction" ? (library?.slug ?? null) : null
  useEffect(() => {
    if (!slug) return
    let live = true
    fetch(`/api/contribute/library/${encodeURIComponent(slug)}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((json: { data?: CorrectionRecord }) => {
        if (live) setCurrent({ slug, record: json.data ?? null })
      })
      .catch(() => live && setCurrent({ slug, record: null }))

    return () => {
      live = false
    }
  }, [slug])
  const record = current && current.slug === slug ? current.record : null
  const addNames = useCallback(
    (more: Record<string, string>) => setNames((n) => ({ ...n, ...more })),
    []
  )
  const recordLoading = Boolean(slug) && (!current || current.slug !== slug)

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

  // Move focus to the new step's heading when the step changes.
  useEffect(() => {
    if (shownStep.current !== step) stepHeading.current?.focus()
    shownStep.current = step
  }, [step])

  const patch = (next: Partial<WizardDraft>) =>
    setDraft((d) => ({ ...d, ...next }))
  const structured =
    action === "correction" && editorFor(draft.category) !== "text"
  // With no record to start from, a structured category falls back to text.
  const changes =
    structured && record
      ? recordChanges(draft.category, record, draft.record ?? {})
      : null
  const unsafe = findUnsafeContent(
    {
      text: draft.text,
      source: draft.source,
      credit: draft.credit,
      record: changes ? changes.changes : undefined,
      suggestedOptions: changes ? changes.suggestedOptions : undefined,
    },
    library ? [library.name] : []
  )
  const blocker =
    (step === 2 && structured && recordLoading
      ? "Loading the record…"
      : blockerFor(
          action,
          step,
          library,
          draft,
          drawer,
          changes ? { changed: hasRecordChange(changes) } : undefined
        )) ?? (step > 1 ? (unsafe?.message ?? null) : null)
  const firstStep: Step = lockLibrary && !drawer ? 2 : 1
  const labels = drawer ? DRAWER_STEPS.labels : STEP_LABELS[action]

  const send = async () => {
    if (!library || isHandoff(action)) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildSubmission(action, library, draft, changes ?? undefined)
        ),
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
    if (meta.handoff) {
      router.push(meta.handoff.href)

      return
    }
    if (blocker) return
    if (step < 3) setStep((step + 1) as Step)
    else void send()
  }

  const startOver = () => {
    if (key) writeDraft(key, null)
    setDraft(emptyDraft)
    setRestored(false)
  }

  const sentView = sent ? (
    <div role="status" className="flex flex-col items-start gap-3">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full"
        style={{ background: "var(--tint-public-bg)", color: T.accent.ok }}
      >
        <Icon height={24} icon="mdi:check" width={24} />
      </span>
      <h3
        id={panel || drawer ? undefined : titleId}
        className="m-0 text-[22px] font-bold"
        style={{ color: T.ink.base }}
      >
        Thanks, it’s in review
      </h3>
      <p
        className="m-0 max-w-[56ch] text-[16px] leading-normal"
        style={{ color: T.ink.dim }}
      >
        A reviewer will check your {action === "photo" ? "photo" : "suggestion"}{" "}
        for {library?.name}, usually within a few days. You can follow it in
        your submissions.
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
            setDraft(emptyDraft)
            setStep(firstStep)
          }}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          Suggest something else
        </button>
      </div>
    </div>
  ) : null
  if (sentView && layout === "stacked") return sentView

  const signInReturn =
    typeof returnTo === "function" ? returnTo(library) : returnTo
  const needsSignIn =
    !isPending &&
    !signedIn &&
    (step === 3 || (action === "photo" && step === 2))

  const actionsView = (
    <div
      className={
        drawer
          ? "flex flex-wrap items-center gap-3"
          : "flex flex-wrap items-center gap-3 border-t pt-6"
      }
      style={drawer ? undefined : { borderColor: T.border.divider }}
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
          {meta.handoff
            ? meta.handoff.cta
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
  )

  const stepTitleId = `${titleId}-step`
  const leadId = `${titleId}-lead`

  const restoredNotice = restored ? (
    <p
      className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]"
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
  ) : null

  const chosen = categoryOption(draft.category)

  // A structured category: the Index editor's own fields for this part of
  // the record, then an optional note for the reviewer.
  const editorView =
    changes && record ? (
      <>
        <CorrectionEditor
          category={draft.category}
          changedKeys={Object.keys(changes.changes)}
          current={record}
          edit={draft.record ?? {}}
          onChange={(next) => patch({ record: next })}
          onNames={addNames}
        />
        <div>
          <Label htmlFor={`${titleId}-text`} hint="Optional">
            Anything a reviewer should know?
          </Label>
          <textarea
            className={`${FIELD} min-h-[88px] resize-y`}
            id={`${titleId}-text`}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder="e.g. The council changed the Thursday hours in September"
            style={{ color: T.ink.base }}
            value={draft.text}
          />
        </div>
      </>
    ) : structured && recordLoading ? (
      <p className="m-0 text-[15px]" role="status" style={{ color: T.ink.dim }}>
        Loading the record…
      </p>
    ) : null

  const formView = (
    <>
      <div>
        {/* A focus target for each step; the step's own heading follows. */}
        {drawer ? (
          <div className="mb-6">
            <h3
              ref={stepHeading}
              id={stepTitleId}
              className="m-0"
              tabIndex={-1}
              style={{
                // A focus target for screen readers, not a control: no ring.
                outline: "none",
                fontFamily: T.font.serif,
                fontSize: "clamp(28px,4vw,36px)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
                color: T.ink.base,
              }}
            >
              <span className="sr-only">Step {step}: </span>
              {DRAWER_STEPS.titles[step - 1]}
            </h3>
            <p
              id={leadId}
              className="m-0 mt-2 max-w-[56ch] text-[16px] leading-normal"
              style={{ color: T.ink.dim }}
            >
              {step === 2 && changes
                ? "Change what’s wrong. Everything else stays as it is."
                : DRAWER_STEPS.leads[step - 1]}
            </p>
          </div>
        ) : panel && (step > 1 || meta.handoff) ? (
          <h3
            ref={stepHeading}
            className={meta.handoff ? "m-0 mb-3" : "m-0 mb-6"}
            tabIndex={-1}
            style={{
              // A focus target for screen readers, not a control: no ring.
              outline: "none",
              fontFamily: T.font.serif,
              fontSize: "clamp(28px,3vw,36px)",
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              color: T.ink.base,
            }}
          >
            <span className="sr-only">Step {step}: </span>
            {meta.handoff?.heading ?? STEP_TITLES[action][step - 1]}
          </h3>
        ) : (
          <h3 ref={stepHeading} className="sr-only" tabIndex={-1}>
            Step {step}: {STEP_LABELS[action][step - 1]}
          </h3>
        )}

        {meta.handoff ? (
          <p
            className="m-0 max-w-[60ch] text-[16px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            {meta.handoff.blurb}
          </p>
        ) : drawer && step === 1 ? (
          <div className="flex flex-col gap-5">
            {restoredNotice}
            <CategoryCards
              labelledBy={stepTitleId}
              name={`${titleId}-category`}
              onChange={(category) => patch({ category })}
              value={draft.category}
            />
          </div>
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
            {library && !drawer ? (
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
                {!locked ? (
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

            {drawer ? null : restoredNotice}

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

            {step === 2 && action !== "photo" && drawer ? (
              <>
                <p
                  className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px]"
                  style={{ color: T.ink.dim }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full"
                    style={{
                      background: T.accent.chip,
                      color: T.accent.primary,
                    }}
                  >
                    <Icon
                      height={16}
                      icon={chosen?.icon ?? "mdi:pencil-outline"}
                      width={16}
                    />
                  </span>
                  <span className="font-semibold" style={{ color: T.ink.base }}>
                    {draft.category}
                  </span>
                  <button
                    type="button"
                    className="font-semibold underline underline-offset-[3px]"
                    onClick={() => setStep(1)}
                    style={{ color: T.accent.primary }}
                  >
                    Change<span className="sr-only"> what needs changing</span>
                  </button>
                </p>
                {editorView ?? (
                  <textarea
                    aria-describedby={leadId}
                    aria-labelledby={stepTitleId}
                    className={`${FIELD} min-h-[180px] resize-y`}
                    id={`${titleId}-text`}
                    onChange={(e) => patch({ text: e.target.value })}
                    placeholder={chosen?.placeholder}
                    style={{ color: T.ink.base }}
                    value={draft.text}
                  />
                )}
              </>
            ) : null}

            {step === 2 && action !== "photo" && !drawer ? (
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
                {(action === "correction" ? editorView : null) ?? (
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
                          ? (chosen?.placeholder ??
                            "e.g. Open until 8pm on Thursdays since September")
                          : "e.g. The opening hours on the council website"
                      }
                      style={{ color: T.ink.base }}
                      value={draft.text}
                    />
                  </div>
                )}
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
                          : drawer
                            ? "Optional"
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
                      {changes ? (
                        <>
                          <dt style={{ color: T.ink.dim }}>Changes</dt>
                          <dd className="m-0">
                            <ul className="m-0 list-none p-0">
                              {describeChanges(changes, names).map((line) => (
                                <li key={line} className="break-words">
                                  {line}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      ) : null}
                      {draft.text.trim() ? (
                        <>
                          <dt style={{ color: T.ink.dim }}>
                            {changes
                              ? "Note"
                              : action === "correction"
                                ? "Correct"
                                : "Confirms"}
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

      {drawer ? null : actionsView}
    </>
  )

  if (drawer)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid min-h-full grid-cols-1 sm:grid-cols-[232px_minmax(0,1fr)] md:grid-cols-[256px_minmax(0,1fr)]">
            <div
              className="hidden border-r px-6 py-7 sm:block"
              style={{ background: T.bg.space, borderColor: T.border.line }}
            >
              <StepRail
                action={action}
                done={sent}
                drawer
                hints={DRAWER_STEPS.hints}
                labels={labels}
                step={step}
                titleId={titleId}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-6 px-5 py-7 sm:px-8">
              {/* Phones get the rail as a progress bar instead. */}
              <div className="sm:hidden">
                <p
                  className="m-0 mb-3 text-[15px] font-semibold"
                  style={{ color: T.ink.dim }}
                >
                  {sent ? "Sent for review" : `Step ${step} of 3`}
                </p>
                <Progress labels={labels} step={sent ? 3 : step} />
              </div>
              {sentView ?? formView}
            </div>
          </div>
        </div>
        {sent ? null : (
          <div
            className="shrink-0 border-t px-5 py-4 sm:px-6"
            style={{ background: T.bg.deep, borderColor: T.border.line }}
          >
            {actionsView}
          </div>
        )}
      </div>
    )

  if (panel)
    return (
      <div
        className="grid grid-cols-1 overflow-hidden rounded-[24px] lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <div
          className="border-b p-6 sm:p-8 lg:border-r lg:border-b-0"
          style={{ background: T.bg.void, borderColor: T.border.line }}
        >
          <StepRail
            action={action}
            done={sent}
            hints={STEP_HINTS[action]}
            labels={labels}
            step={step}
            titleId={titleId}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-7 p-6 sm:p-8 lg:p-10">
          {sentView ?? formView}
        </div>
      </div>
    )

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

      <Progress labels={labels} step={step} />

      {formView}
    </div>
  )
}
