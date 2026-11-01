"use client"

import { Icon } from "@iconify/react"
import {
  checkText,
  DRIVE_MAX_LIBRARIES,
  type DriveStatus,
  type DriveUnit,
  type GapKey,
  PANEL_GAPS,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import {
  type FormEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

import { ChoiceCard, Notice } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
import { SECTION_LABELS } from "@/components/library/verify.logic"
import { T, TYPE_TINT, tintForLibraryType } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { LIBRARY_TYPES } from "@/lib/meilisearch"
import { Link, useRouter } from "@/lib/navigation"

import {
  card,
  cardStyle,
  cardTitle,
  CharCount,
  CheckChip,
  chosenBackground,
  Disclosure,
  Divider,
  Field,
  FieldMessage,
  hintClass,
  input,
  invalidInput,
  legendClass,
  linkStyle,
  PRIMARY,
  RING,
  SECONDARY,
  SECONDARY_LINK,
  secondaryStyle,
  Segments,
  Step,
  Tag,
} from "./builder-ui"
import {
  type BuilderField,
  builderErrors,
  type BuilderMode,
  type BuilderPlace,
  type BuilderState,
  CLEAN_WORDS,
  type DraftField,
  dirtyOf,
  draftStorageKey,
  emptyBuilderState,
  endsOnFor,
  errorsFromResponse,
  type FieldError,
  fieldId,
  type FocusKind,
  GOAL_CHOICES,
  goalCount,
  parseLibraryList,
  parseSavedDraft,
  previewDriveView,
  previewRequest,
  PROPOSAL_NOTE_MAX,
  RECORD_TARGET_CHOICES,
  RUN_CHOICES,
  runDaysOf,
  serializeDraft,
  stepsDone,
  textOnlyInput,
  todayDay,
  toDriveInput,
  type WhereKind,
  whereFieldsFor,
  withDraftedWords,
  withStartsOn,
  type WordsDirty,
} from "./builder.logic"
import {
  BoardCard,
  PreviewCard,
  type PreviewPlaceCount,
  type ProposalStanding,
  ScopeCard,
  type ScopeCounts,
  StandingCard,
} from "./DriveBuilderRail"
import { DriveDiscussionOptions } from "./DriveDiscussionOptions"
import { FOCUS_META, longDate, unitNoun } from "./focus-meta"
import { LEVEL_WORD, PlaceSearch } from "./PlaceSearch"

export type { ProposalStanding } from "./DriveBuilderRail"

const TITLE_MAX = 120
const SUMMARY_MAX = 280
const STEPS_MAX = 5
const PREVIEW_DEBOUNCE_MS = 400
const fmt = (n: number) => n.toLocaleString("en-GB")

const UNITS: { value: DriveUnit; label: string }[] = [
  { value: "library", label: "Libraries" },
  { value: "branch", label: "Branches" },
  { value: "record", label: "Records" },
]

/** The three jobs a drive can do, as "What's the job?" offers them. */
const FOCUS_CHOICES: {
  kind: FocusKind
  title: string
  hint: string
  icon: string
  tint: { bg: string; fg: string }
}[] = [
  {
    kind: "gaps",
    title: "Fill gaps",
    hint: "Add what’s missing, like opening hours or a photo.",
    icon: "mdi:plus",
    tint: { bg: T.accent.chip, fg: T.accent.primaryHover },
  },
  {
    kind: "verify",
    title: "Confirm details",
    hint: "Check details nobody has confirmed in a while.",
    icon: "mdi:check-decagram-outline",
    tint: TYPE_TINT.public,
  },
  {
    kind: "record",
    title: "Complete records",
    hint: "Fill whatever each record lacks until it reaches the goal.",
    icon: "mdi:file-document-outline",
    tint: TYPE_TINT.academic,
  },
]

/** "Where should helpers look?", as three radio rows. */
const WHERE_CHOICES: { kind: WhereKind; title: string; hint: string }[] = [
  {
    kind: "website",
    title: "Each library’s own website",
    hint: "Helpers follow the link on each record.",
  },
  {
    kind: "dataset",
    title: "A public dataset",
    hint: "For example a council list or national survey.",
  },
  {
    kind: "other",
    title: "Another source",
    hint: "A link everyone can open.",
  },
]

const SOURCE_PLACEHOLDER: Record<Exclude<WhereKind, "website">, string> = {
  dataset: "For example, the council’s list of libraries",
  other: "The source’s name",
}

const SECTION_ICONS: Record<VerifySection, string> = {
  hours: "mdi:clock-outline",
  status: "mdi:door-open",
  address: "mdi:map-marker-outline",
  contact: "mdi:card-account-phone-outline",
}

/** Once a drive has opened, only its words and where to look change. */
const LOCKED_STATUSES: ReadonlySet<DriveStatus> = new Set([
  "open",
  "closed",
  "cancelled",
])

/** The fields under "Narrow it further". */
const NARROW_FIELDS: readonly BuilderField[] = [
  "source",
  "completenessBelow",
  "libraries",
]

const hasNarrowing = (s: BuilderState) =>
  Boolean(s.source.trim() || s.completenessBelow.trim() || s.libraryList.trim())

type Preview = {
  /** The request these numbers answer. */
  key: string
  /** Its scope alone: the gap and place chips' counts only need this. */
  scopeKey: string
  status: "ready" | "error"
  total?: number
  todo?: number | null
  gaps?: Partial<Record<GapKey, number>>
  places?: PreviewPlaceCount[]
  unknown?: string[]
}

type PreviewJson = {
  total?: number
  todo?: number | null
  gaps?: Partial<Record<GapKey, number>>
  places?: PreviewPlaceCount[]
  unknown?: string[]
}

/** The errors before sending, each linking to its field. */
function ErrorSummary({
  errors,
  summaryRef,
  verb,
}: {
  readonly errors: readonly FieldError[]
  readonly summaryRef: React.RefObject<HTMLDivElement | null>
  /** "saving" for the board, "sending" for a proposal. */
  readonly verb: string
}) {
  if (errors.length === 0) return null
  const focusField = (field: BuilderField) => (e: React.MouseEvent) => {
    const el = document.getElementById(fieldId(field))
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ block: "center" })
    el.focus({ preventScroll: true })
  }

  return (
    <div
      ref={summaryRef}
      id="drive-errors"
      tabIndex={-1}
      role="alert"
      aria-labelledby="drive-errors-title"
      className="flex flex-col gap-2 rounded-[16px] px-4 py-3.5"
      style={{ background: "var(--tint-special-bg)", outlineOffset: 2 }}
    >
      <p
        id="drive-errors-title"
        className="m-0 flex items-center gap-1.5 text-base font-semibold"
        style={{ color: T.accent.danger }}
      >
        <Icon aria-hidden="true" icon="mdi:alert-circle-outline" width={18} />
        {errors.length === 1
          ? `Fix this before ${verb}`
          : `Fix these ${errors.length} things before ${verb}`}
      </p>
      <ul className="m-0 flex flex-col gap-1 pl-5 text-base">
        {errors.map((e, i) => (
          <li key={`${e.field ?? "drive"}-${i}`} style={{ color: T.ink.base }}>
            {e.field ? (
              <a
                href={`#${fieldId(e.field)}`}
                onClick={focusField(e.field)}
                className="font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.danger }}
              >
                {e.message}
              </a>
            ) : (
              e.message
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const PROPOSAL_FAILED = "The proposal couldn’t be sent. Try again."

/** Why a proposal was refused (403, 429, or a lapsed session), as one line. */
function refusalMessage(json: unknown, status: number): string {
  const error = (json as { error?: unknown } | null)?.error
  const message =
    error && typeof error === "object"
      ? (error as { message?: unknown }).message
      : null
  if (typeof message === "string" && message) return message
  if (status === 401) return "Your session has ended. Sign in again to send it."
  if (status === 429) {
    return typeof error === "string" && error
      ? error
      : "Too many tries. Wait a minute, then send it again."
  }

  return "You can’t propose a drive right now."
}

/**
 * "Proposal sent", as the role application form's sent card: the ok
 * notice, a heading focused on arrival, and where to go next.
 */
function ProposalSent() {
  const tUi = useUiTranslations("ui")

  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <section
      aria-labelledby="drive-sent"
      className={`${card} flex flex-col items-start gap-3`}
      style={cardStyle}
    >
      <Notice
        icon="mdi:check-circle-outline"
        tone="ok"
        title={tUi("proposal_sent")}
      />
      <h2
        id="drive-sent"
        ref={ref}
        tabIndex={-1}
        className="type-h2 m-0 outline-none"
        style={cardTitle}
      >
        Thanks. We’ve got your proposal.
      </h2>
      <p className="m-0 text-base leading-[1.6]" style={{ color: T.ink.dim }}>
        A moderator will review it. You’ll get an email when it’s decided.
      </p>
      <div className="mt-1 flex flex-wrap gap-2.5">
        <Link
          href="/community"
          className={SECONDARY_LINK}
          style={secondaryStyle}
        >
          <Icon aria-hidden="true" icon="mdi:arrow-left" width={16} />
          Back to the Noticeboard
        </Link>
        <Link
          href="/contribute/submissions"
          className={SECONDARY_LINK}
          style={secondaryStyle}
        >
          {tUi("my_submissions")}{" "}
        </Link>
      </div>
    </section>
  )
}

/** The submit button's words: sending, saving, or what it will do. */
function submitLabel(saving: boolean, proposing: boolean, editing: boolean) {
  if (proposing) return saving ? "Sending…" : "Send proposal"
  if (editing) return saving ? "Saving…" : "Save changes"

  return saving ? "Creating…" : "Create drive"
}

/** The footer's "ready" line, by mode. */
function readyLine(proposing: boolean, editing: boolean) {
  if (proposing) return "Ready to send. A moderator reviews it first."
  if (editing) return "Ready to save. Changes show straight away."

  return "Ready to create. It’s saved as scheduled."
}

/** "Closes early once 12 of 40 are done", from the live counts. */
function goalHint(goalText: string, counts: ScopeCounts): string {
  const goal = Number(goalText)
  if (counts.status !== "ready" || counts.todo == null || !goal) {
    return "Closes early once the goal is done."
  }
  if (counts.todo === 0) return "Nothing in this scope needs it yet."
  const needed = goalCount({ total: counts.total, todo: counts.todo }, goal)
  if (needed === 0) {
    return "Already met in this scope, so it would close as soon as it opens."
  }

  return `Closes early once ${fmt(needed)} of ${fmt(counts.todo)} are done.`
}

/** The live counts as the side column and hints read them. */
function scopeCountsOf(key: string, current: Preview | null): ScopeCounts {
  if (!key) return { status: "none" }
  if (!current) return { status: "loading" }
  if (current.status === "error") return { status: "error" }

  return {
    status: "ready",
    total: current.total ?? 0,
    todo: current.todo ?? null,
    places: current.places ?? [],
  }
}

/** The first state and which words were written by hand: everything else is drafted. */
function startOf(initial?: BuilderState): {
  state: BuilderState
  dirty: WordsDirty
} {
  const base = initial ?? emptyBuilderState()
  const dirty = dirtyOf(base)

  return { state: withDraftedWords(base, dirty), dirty }
}

/** Runs `fn` on browser storage, ignoring a browser that refuses it. */
function withStorage<R>(fn: (storage: Storage) => R): R | null {
  try {
    return fn(window.localStorage)
  } catch {
    return null
  }
}

/**
 * The drive builder (spec §5.7), laid out like the role application form:
 * five step cards in the main column (the job, where, where helpers look,
 * the words, and when and what counts as done) with a footer bar, and a
 * sticky side column with the live Noticeboard card, the scope's counts
 * and the user's standing (or the board's card). Each card shows a green
 * check once it's complete. The words are drafted from the choices until
 * the user writes their own; "Redraft from my choices" starts again.
 *
 * - **Board mode** (the editorial board): a new drive saves as scheduled;
 *   the board pins it or opens it from its page. Once a drive has opened
 *   only its words and where to look change.
 * - **Propose mode** (anyone else): the same steps plus a note for the
 *   moderator, sent as a Drive Proposal (`POST /api/drives/proposals`).
 *   `blocked` disables "Send proposal" and says why; `standing` fills the
 *   side column's "Who can propose" card.
 *
 * `userId` turns on "Save draft" (browser storage, one per user and mode);
 * `restoreDraft` brings a saved draft back on load, for a page opened
 * without a prefill.
 */
export function DriveBuilder({
  initial,
  locale,
  drive,
  mode = "board",
  blocked = null,
  standing = null,
  userId = null,
  restoreDraft = false,
}: {
  readonly initial?: BuilderState
  readonly locale: string
  /** The drive being edited; omitted for a new drive. */
  readonly drive?: { documentId: string; slug: string; status: DriveStatus }
  readonly mode?: BuilderMode
  /** Why a proposal can't be sent yet, shown in the footer. */
  readonly blocked?: string | null
  /** Propose mode: accepted changes and any proposal in review. */
  readonly standing?: ProposalStanding | null
  /** The signed-in user, for "Save draft"; null hides it. */
  readonly userId?: string | null
  readonly restoreDraft?: boolean
}) {
  const [libraryTypeChoices, setLibraryTypeChoices] =
    useState<readonly string[]>(LIBRARY_TYPES)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/relations/library-types", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data?.length && !controller.signal.aborted)
          setLibraryTypeChoices(
            json.data.map((item: { name: string }) => item.name)
          )
      })
      .catch(() => {})

    return () => controller.abort()
  }, [])
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const proposing = mode === "propose"
  const editing = Boolean(drive)
  const draftKey = userId && !editing ? draftStorageKey(mode, userId) : null
  const [start] = useState(() => startOf(initial))
  const [state, setState] = useState(start.state)
  const [dirty, setDirty] = useState(start.dirty)
  const [errors, setErrors] = useState<FieldError[] | null>(null)
  const [serverErrors, setServerErrors] = useState<FieldError[]>([])
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [note, setNote] = useState("")
  const [refusal, setRefusal] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [restored, setRestored] = useState(false)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)
  const [narrowOpen, setNarrowOpen] = useState(() => hasNarrowing(state))
  const [noteOpen, setNoteOpen] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const refusalRef = useRef<HTMLDivElement>(null)
  const locked =
    !proposing && Boolean(drive && LOCKED_STATUSES.has(drive.status))

  const request = locked ? null : previewRequest(state)
  const key = request ? JSON.stringify(request) : ""
  const scopeKey = request ? JSON.stringify(request.scope) : ""
  const current = preview && preview.key === key ? preview : null
  const sameScope =
    preview?.status === "ready" && preview.scopeKey === scopeKey
      ? preview
      : null
  const unknownLibraries = current?.unknown ?? []
  const counts = scopeCountsOf(key, current)

  useEffect(() => {
    if (!key) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/drives/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: ctrl.signal,
        })
        const json = (await res.json().catch(() => null)) as PreviewJson | null
        if (!res.ok || !json) {
          setPreview({ key, scopeKey, status: "error" })

          return
        }
        setPreview({
          key,
          scopeKey,
          status: "ready",
          total: json.total ?? 0,
          todo: json.todo ?? null,
          gaps: json.gaps ?? {},
          places: json.places ?? [],
          unknown: json.unknown ?? [],
        })
      } catch {
        if (!ctrl.signal.aborted) {
          setPreview({ key, scopeKey, status: "error" })
        }
      }
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key, scopeKey])

  // A draft saved in this browser comes back once, after hydration.
  useEffect(() => {
    if (!draftKey || !restoreDraft) return
    const timer = setTimeout(() => {
      const saved = withStorage((s) => parseSavedDraft(s.getItem(draftKey)))
      if (!saved) return
      setDirty(saved.dirty)
      setState(withDraftedWords(saved.state, saved.dirty))
      setNote(saved.note)
      setRestored(true)
      if (hasNarrowing(saved.state)) setNarrowOpen(true)
      if (saved.note) setNoteOpen(true)
    }, 0)

    return () => clearTimeout(timer)
  }, [draftKey, restoreDraft])

  const shownErrors = [...(errors ?? []), ...serverErrors]
  const errorOf = (field: BuilderField) =>
    shownErrors.find((e) => e.field === field)?.message
  const describedBy = (field: BuilderField, hint?: string) =>
    [hint, errorOf(field) ? `${fieldId(field)}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined
  const styleOf = (field: BuilderField) =>
    errorOf(field) ? invalidInput : input

  /** The note's content-safety problem, as an error for the whole drive. */
  const noteErrors = (text: string): FieldError[] => {
    const issue = proposing ? checkText(text) : null

    return issue ? [{ field: null, message: issue }] : []
  }

  /** Every problem with the form as it stands, the note's included. */
  const problemsOf = (next: BuilderState, nextNote: string) => [
    ...builderErrors(next, new Date(), { unknownLibraries }),
    ...noteErrors(nextNote),
  ]

  const problems = problemsOf(state, note)
  const done = stepsDone(state, problems)

  /** Shows a changed form; once sending was tried, the errors follow it. */
  const show = (next: BuilderState, nextNote: string = note) => {
    setState(next)
    setServerErrors([])
    setRefusal(null)
    setDraftMessage(null)
    if (errors !== null) setErrors(problemsOf(next, nextNote))
  }

  /** Applies a change and redrafts every word not written by hand. */
  const update = (
    patch: Partial<BuilderState>,
    nextDirty: WordsDirty = dirty
  ) => show(withDraftedWords({ ...state, ...patch }, nextDirty))

  /** The user's own words: drafting leaves that field alone from now on. */
  const write = (field: DraftField, patch: Partial<BuilderState>) => {
    const nextDirty = { ...dirty, [field]: true }
    setDirty(nextDirty)
    update(patch, nextDirty)
  }

  const redraft = () => {
    setDirty(CLEAN_WORDS)
    update({}, CLEAN_WORDS)
  }

  const updateNote = (text: string) => {
    setNote(text)
    show(state, text)
  }

  const focusSummary = () =>
    requestAnimationFrame(() => summaryRef.current?.focus())

  /** "3 things to fix": shows the summary and goes to it. */
  const showProblems = () => {
    setErrors(problems)
    focusSummary()
  }

  const clearDraft = () => {
    if (draftKey) withStorage((s) => s.removeItem(draftKey))
  }

  const saveDraft = () => {
    if (!draftKey) return
    const ok = withStorage((s) => {
      s.setItem(draftKey, serializeDraft({ state, note, dirty }))

      return true
    })
    setDraftMessage(
      ok
        ? "Draft saved in this browser."
        : "This browser won’t keep a draft. Send it when you’re ready."
    )
  }

  const startAgain = () => {
    clearDraft()
    setRestored(false)
    setDirty(start.dirty)
    setNote("")
    setNarrowOpen(hasNarrowing(start.state))
    show(start.state, "")
  }

  /** Sends the proposal; Strapi's verdict comes back as it is. */
  const propose = async () => {
    try {
      const res = await fetch("/api/drives/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...toDriveInput(state),
          ...(state.discussions ? { discussions: state.discussions } : {}),
          note: note.trim(),
        }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (res.ok) {
        clearDraft()
        setSent(true)

        return
      }
      setSaving(false)
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        setRefusal(refusalMessage(json, res.status))
        requestAnimationFrame(() => refusalRef.current?.focus())

        return
      }
      setServerErrors(errorsFromResponse(json, PROPOSAL_FAILED))
      focusSummary()
    } catch {
      setServerErrors(errorsFromResponse(null, PROPOSAL_FAILED))
      setSaving(false)
      focusSummary()
    }
  }

  /** The board's create or update. */
  const saveBoard = async () => {
    const body = toDriveInput(state)
    try {
      const res = await fetch(
        drive ? `/api/drives/${drive.documentId}` : "/api/drives",
        {
          method: drive ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(locked ? textOnlyInput(body) : body),
            ...(state.discussions ? { discussions: state.discussions } : {}),
          }),
        }
      )
      const json = (await res.json().catch(() => null)) as {
        data?: { slug?: string }
      } | null
      if (!res.ok) {
        setServerErrors(errorsFromResponse(json))
        setSaving(false)
        focusSummary()

        return
      }
      clearDraft()
      const slug = json?.data?.slug ?? drive?.slug
      router.push(slug ? driveHref(slug) : "/community")
      router.refresh()
    } catch {
      setServerErrors(errorsFromResponse(null))
      setSaving(false)
      focusSummary()
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (saving || (proposing && blocked)) return
    setErrors(problems)
    setServerErrors([])
    setRefusal(null)
    if (problems.length > 0) {
      focusSummary()

      return
    }
    setSaving(true)
    await (proposing ? propose() : saveBoard())
  }

  const toggleGap = (gap: GapKey) =>
    update({
      gaps: state.gaps.includes(gap)
        ? state.gaps.filter((g) => g !== gap)
        : [...state.gaps, gap],
    })
  const toggleSection = (section: VerifySection) =>
    update({
      verifySections: state.verifySections.includes(section)
        ? state.verifySections.filter((s) => s !== section)
        : VERIFY_SECTIONS.filter(
            (s) => s === section || state.verifySections.includes(s)
          ),
    })
  const toggleType = (type: string) =>
    update({
      libraryTypes: state.libraryTypes.includes(type)
        ? state.libraryTypes.filter((t) => t !== type)
        : [...state.libraryTypes, type],
    })
  const removePlace = (p: BuilderPlace) =>
    update({
      places: state.places.filter(
        (q) => !(q.level === p.level && q.slug === p.slug)
      ),
    })
  const setStep = (i: number, text: string) =>
    write("steps", { steps: state.steps.map((s, j) => (j === i ? text : s)) })

  const list = parseLibraryList(state.libraryList)
  const listCount = list.refs.length
  const today = todayDay()
  const sectionsError = errorOf("verifySections")
  const beforeInvalid =
    Boolean(sectionsError) &&
    (!state.verifyBefore || state.verifyBefore > today)
  const gapCounts = sameScope?.gaps ?? null
  const placeTotal = (p: BuilderPlace) =>
    sameScope?.places?.find((q) => q.level === p.level && q.slug === p.slug)
      ?.total
  const runDays = runDaysOf(state)
  const closes = longDate(state.endsOn ? `${state.endsOn}T00:00:00Z` : "")
  const todo = counts.status === "ready" ? counts.todo : null
  const narrowShown =
    narrowOpen || NARROW_FIELDS.some((f) => Boolean(errorOf(f)))
  const view = previewDriveView(state, todo)

  // Announces the send; it stays mounted while the form gives way.
  const announcement = proposing ? (
    <p aria-live="polite" className="sr-only">
      {sent ? tUi("proposal_sent") : ""}
    </p>
  ) : null

  let status: ReactNode
  if (proposing && blocked) {
    status = (
      <span
        id="drive-blocked-reason"
        className="flex items-center gap-2"
        style={{ color: T.ink.dim }}
      >
        <Icon aria-hidden="true" icon="mdi:lock-outline" width={18} />
        {blocked}
      </span>
    )
  } else if (problems.length > 0) {
    status = (
      <span className="flex items-center gap-2" style={{ color: T.ink.base }}>
        <Icon
          aria-hidden="true"
          icon="mdi:alert-outline"
          width={18}
          style={{ color: T.accent.warn }}
        />
        <button
          type="button"
          onClick={showProblems}
          aria-controls={shownErrors.length > 0 ? "drive-errors" : undefined}
          className="cursor-pointer font-semibold underline underline-offset-[3px]"
          style={{
            color: T.ink.base,
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: T.font.sans,
            fontSize: "var(--type-body-size)",
          }}
        >
          {problems.length === 1
            ? "1 thing to fix"
            : `${problems.length} things to fix`}
        </button>
      </span>
    )
  } else {
    status = (
      <span className="flex items-center gap-2" style={{ color: T.ink.base }}>
        <Icon
          aria-hidden="true"
          icon="mdi:check"
          width={18}
          style={{ color: T.accent.ok }}
        />
        {readyLine(proposing, editing)}
      </span>
    )
  }

  const form = (
    <form noValidate onSubmit={save} className="flex min-w-0 flex-col gap-5">
      {restored ? (
        <div className="relative">
          <Notice
            icon="mdi:content-save-outline"
            tone="info"
            title={tUi("we_restored_your_draft")}
          >
            <p className="m-0" style={{ color: T.ink.base }}>
              <button
                type="button"
                onClick={startAgain}
                className="cursor-pointer font-semibold underline underline-offset-[3px]"
                style={{
                  ...linkStyle,
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: T.font.sans,
                  fontSize: "var(--type-body-size)",
                }}
              >
                Start again instead
              </button>
            </p>
          </Notice>
          <button
            type="button"
            aria-label={tUi("dismiss")}
            onClick={() => setRestored(false)}
            className="absolute top-2 right-2 flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-deep)"
            style={{
              color: T.accent.primaryHover,
              background: "none",
              border: "none",
            }}
          >
            <Icon aria-hidden="true" icon="mdi:close" width={18} />
          </button>
        </div>
      ) : null}

      {locked ? (
        <Notice
          icon="mdi:lock-outline"
          tone="info"
          title={`This drive is ${drive?.status}`}
        >
          <p className="m-0" style={{ color: T.ink.base }}>
            Only its words and where to look can change now. What it’s for,
            where it runs and its dates are fixed.
          </p>
        </Notice>
      ) : null}

      <Step
        n={1}
        id={fieldId("focus")}
        title="What’s the job?"
        hint="One job per drive keeps it quick for helpers."
        done={done[0]!}
        disabled={locked}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {FOCUS_CHOICES.map((c) => (
            <ChoiceCard
              key={c.kind}
              name="drive-focus-kind"
              value={c.kind}
              checked={state.focusKind === c.kind}
              onChange={() => update({ focusKind: c.kind })}
              icon={c.icon}
              tint={c.tint}
              title={c.title}
              hint={c.hint}
            />
          ))}
        </div>

        <Divider />

        {state.focusKind === "gaps" ? (
          <div
            role="group"
            aria-labelledby="drive-gaps-label"
            aria-describedby="drive-gaps-hint"
            className="flex flex-col"
          >
            <p
              id="drive-gaps-label"
              className={legendClass}
              style={{ color: T.ink.base }}
            >
              Which gaps?<Tag>Pick up to three</Tag>
            </p>
            <p
              id="drive-gaps-hint"
              className={hintClass}
              style={{ color: T.ink.dim }}
            >
              Each library’s task asks for all of them in one go. Numbers show
              how many libraries in your scope are missing each one.
            </p>
            <div className="flex flex-wrap gap-2">
              {PANEL_GAPS.map((gap) => {
                const checked = state.gaps.includes(gap)

                return (
                  <CheckChip
                    key={gap}
                    checked={checked}
                    disabled={!checked && state.gaps.length >= 3}
                    onChange={() => toggleGap(gap)}
                    icon={FOCUS_META[gap].icon}
                    count={gapCounts ? (gapCounts[gap] ?? 0) : null}
                    countNoun="in scope missing it"
                  >
                    {FOCUS_META[gap].label}
                  </CheckChip>
                )
              })}
            </div>
          </div>
        ) : null}

        {state.focusKind === "verify" ? (
          <>
            <fieldset
              id={fieldId("verifySections")}
              tabIndex={-1}
              className="m-0 min-w-0 border-0 p-0"
              aria-describedby={describedBy("verifySections")}
            >
              <legend
                className={`${legendClass} mb-3`}
                style={{ color: T.ink.base }}
              >
                Which details?<Tag>Pick one or more</Tag>
              </legend>
              <div className="flex flex-wrap gap-2">
                {VERIFY_SECTIONS.map((section) => (
                  <CheckChip
                    key={section}
                    checked={state.verifySections.includes(section)}
                    onChange={() => toggleSection(section)}
                    icon={SECTION_ICONS[section]}
                  >
                    {SECTION_LABELS[section]}
                  </CheckChip>
                ))}
              </div>
            </fieldset>
            <Field
              id={fieldId("verifyBefore")}
              label={tUi("not_confirmed_since")}
              tag="Required"
              hint="Details nobody has ever confirmed count too."
              hintId="drive-verify-before-hint"
            >
              <input
                id={fieldId("verifyBefore")}
                type="date"
                max={today}
                value={state.verifyBefore}
                onChange={(e) => update({ verifyBefore: e.target.value })}
                style={{
                  ...(beforeInvalid ? invalidInput : input),
                  maxWidth: 240,
                }}
                aria-describedby={
                  [
                    "drive-verify-before-hint",
                    sectionsError ? `${fieldId("verifySections")}-error` : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                aria-invalid={beforeInvalid || undefined}
              />
              <FieldMessage field="verifySections" message={sectionsError} />
            </Field>
          </>
        ) : null}

        {state.focusKind === "record" ? (
          <Segments
            id={fieldId("recordTarget")}
            name="drive-record-target"
            legend="Done at this completeness"
            options={RECORD_TARGET_CHOICES.map((n) => ({
              value: String(n),
              label: `${n}%`,
            }))}
            value={state.recordTarget}
            onChange={(v) => update({ recordTarget: v })}
            describedBy={describedBy("recordTarget", "drive-record-hint")}
          >
            <p
              id="drive-record-hint"
              className="mt-2 mb-0 text-sm"
              style={{ color: T.ink.dim }}
            >
              A record is done once it reaches this.
            </p>
            <FieldMessage
              field="recordTarget"
              message={errorOf("recordTarget")}
            />
          </Segments>
        ) : null}

        <FieldMessage field="focus" message={errorOf("focus")} />
      </Step>

      <section className="grid gap-4 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-6">
        <h2 className="type-h2 m-0">{tUi("drive_conversations")}</h2>
        <DriveDiscussionOptions
          driveId={drive?.documentId}
          value={state.discussions}
          onChange={(discussions) =>
            setState((before) => ({ ...before, discussions }))
          }
          proposing={proposing}
          disabled={saving}
        />
      </section>
      <Step
        n={2}
        title={tUi("where")}
        hint="Add one or more places at any level. Closed libraries are always left out."
        done={done[1]!}
        disabled={locked}
      >
        <div className="flex flex-col gap-3">
          <PlaceSearch
            id={fieldId("places")}
            locale={locale}
            chosen={state.places}
            invalid={Boolean(errorOf("places"))}
            describedBy={describedBy("places")}
            onAdd={(p) => update({ places: [...state.places, p] })}
          />
          {state.places.length > 0 ? (
            <ul
              aria-label={tUi("places_in_this_drive")}
              className="m-0 flex list-none flex-wrap gap-2 p-0"
            >
              {state.places.map((p) => {
                const total = placeTotal(p)

                return (
                  <li
                    key={`${p.level}:${p.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3.5 text-sm"
                    style={{ background: T.accent.chip }}
                  >
                    <span
                      className="font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {p.name}
                    </span>
                    <span style={{ color: T.ink.dim }}>
                      {p.kind ?? LEVEL_WORD[p.level]}
                      {total == null ? null : (
                        <>
                          {" "}
                          · {fmt(total)}
                          <span className="sr-only">
                            {total === 1 ? " library" : " libraries"}
                          </span>
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${p.name}`}
                      onClick={() => removePlace(p)}
                      className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-deep)"
                      style={{
                        color: T.accent.primaryHover,
                        background: "none",
                        border: "none",
                      }}
                    >
                      <Icon aria-hidden="true" icon="mdi:close" width={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
              No places yet. A library in any place you add is in the drive.
            </p>
          )}
          {listCount > 0 && state.places.length > 0 ? (
            <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
              Your list of libraries replaces these places.
            </p>
          ) : null}
          <FieldMessage field="places" message={errorOf("places")} />
        </div>

        <Divider />

        <fieldset
          id={fieldId("libraryTypes")}
          tabIndex={-1}
          className="m-0 min-w-0 border-0 p-0"
        >
          <legend
            className={`${legendClass} mb-3`}
            style={{ color: T.ink.base }}
          >
            Library types<Tag>None chosen means every type</Tag>
          </legend>
          <div className="flex flex-wrap gap-2">
            {libraryTypeChoices.map((type) => (
              <CheckChip
                key={type}
                checked={state.libraryTypes.includes(type)}
                onChange={() => toggleType(type)}
                dot={tintForLibraryType(type).fg}
              >
                {type}
              </CheckChip>
            ))}
          </div>
        </fieldset>

        <Disclosure
          id="drive-narrow"
          open={narrowShown}
          onToggle={() => setNarrowOpen(!narrowShown)}
          icon="mdi:filter-variant"
          title={tUi("narrow_it_further")}
          hint="Dataset, completeness or a list"
          tinted
        >
          <Field
            id={fieldId("source")}
            label={tUi("dataset")}
            tag="Optional"
            hint={
              <>
                A dataset key, such as <code>imls-pls</code>: only records
                imported from it count. Leave it blank for every source.
              </>
            }
            hintId="drive-source-hint"
          >
            <input
              id={fieldId("source")}
              type="text"
              value={state.source}
              onChange={(e) => update({ source: e.target.value })}
              autoComplete="off"
              spellCheck={false}
              style={styleOf("source")}
              aria-describedby={describedBy("source", "drive-source-hint")}
            />
            <FieldMessage field="source" message={errorOf("source")} />
          </Field>

          <Field
            id={fieldId("completenessBelow")}
            label="Only libraries below N% complete"
            tag="Optional"
            hint="Leave it blank to include every record."
            hintId="drive-completeness-hint"
          >
            <span className="flex items-center gap-2">
              <input
                id={fieldId("completenessBelow")}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={state.completenessBelow}
                onChange={(e) => update({ completenessBelow: e.target.value })}
                style={{ ...styleOf("completenessBelow"), maxWidth: 140 }}
                aria-describedby={describedBy(
                  "completenessBelow",
                  "drive-completeness-hint"
                )}
                aria-invalid={
                  Boolean(errorOf("completenessBelow")) || undefined
                }
              />
              <span aria-hidden="true" style={{ color: T.ink.dim }}>
                %
              </span>
            </span>
            <FieldMessage
              field="completenessBelow"
              message={errorOf("completenessBelow")}
            />
          </Field>

          <Field
            id={fieldId("libraries")}
            label={tUi("or_list_the_libraries")}
            tag="Optional"
            hint={
              <>
                Slugs or documentIds, one per line, up to{" "}
                {fmt(DRIVE_MAX_LIBRARIES)}. Links to library pages work too. A
                list replaces the places above.
                {listCount > 0 ? ` ${fmt(listCount)} listed.` : ""}
              </>
            }
            hintId="drive-libraries-hint"
          >
            <textarea
              id={fieldId("libraries")}
              rows={5}
              value={state.libraryList}
              onChange={(e) => update({ libraryList: e.target.value })}
              spellCheck={false}
              style={{
                ...styleOf("libraries"),
                minHeight: 132,
                resize: "vertical",
                lineHeight: 1.6,
              }}
              aria-describedby={describedBy(
                "libraries",
                "drive-libraries-hint"
              )}
              aria-invalid={Boolean(errorOf("libraries")) || undefined}
            />
            {unknownLibraries.length > 0 && !errorOf("libraries") ? (
              <p
                className="mt-2 mb-0 text-sm"
                style={{ color: T.accent.danger }}
              >
                Not found: {unknownLibraries.join(", ")}.
              </p>
            ) : null}
            <FieldMessage field="libraries" message={errorOf("libraries")} />
          </Field>
        </Disclosure>
      </Step>

      <Step
        n={3}
        title="Where should helpers look?"
        hint="Facts from a library’s own website are fine. Data copied from map services isn’t."
        done={done[2]!}
      >
        <div className="flex flex-col gap-3">
          {WHERE_CHOICES.map((c) => {
            const chosen = state.whereKind === c.kind

            return (
              <Fragment key={c.kind}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-[16px] px-4 py-3.5 transition-colors ${RING}`}
                  style={{
                    border: `1.5px solid ${chosen ? T.accent.primary : T.border.line}`,
                    background: chosen ? chosenBackground : T.bg.deep,
                  }}
                >
                  <input
                    type="radio"
                    name="drive-where"
                    value={c.kind}
                    checked={chosen}
                    onChange={() => update(whereFieldsFor(state, c.kind))}
                    className="sr-only"
                  />
                  <Icon
                    aria-hidden="true"
                    icon={chosen ? "mdi:radiobox-marked" : "mdi:radiobox-blank"}
                    width={22}
                    height={22}
                    className="shrink-0"
                    style={{ color: chosen ? T.accent.primary : T.border.hi }}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span
                      className="text-base font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {c.title}
                    </span>
                    <span className="text-sm" style={{ color: T.ink.dim }}>
                      {c.hint}
                    </span>
                  </span>
                </label>
                {chosen && c.kind !== "website" ? (
                  <div className="flex flex-col gap-6 px-1 pt-2 pb-3">
                    <Field
                      id={fieldId("whereName")}
                      label={tUi("source_name")}
                      tag="Required"
                    >
                      <input
                        id={fieldId("whereName")}
                        type="text"
                        value={state.whereName}
                        onChange={(e) => update({ whereName: e.target.value })}
                        style={styleOf("whereName")}
                        aria-describedby={describedBy("whereName")}
                        aria-invalid={
                          Boolean(errorOf("whereName")) || undefined
                        }
                        placeholder={SOURCE_PLACEHOLDER[c.kind]}
                      />
                      <FieldMessage
                        field="whereName"
                        message={errorOf("whereName")}
                      />
                    </Field>
                    <Field
                      id={fieldId("whereUrl")}
                      label={tUi("link")}
                      tag="Optional"
                    >
                      <input
                        id={fieldId("whereUrl")}
                        type="url"
                        inputMode="url"
                        value={state.whereUrl}
                        onChange={(e) => update({ whereUrl: e.target.value })}
                        style={styleOf("whereUrl")}
                        aria-describedby={describedBy("whereUrl")}
                        aria-invalid={Boolean(errorOf("whereUrl")) || undefined}
                        placeholder="https://"
                      />
                      <FieldMessage
                        field="whereUrl"
                        message={errorOf("whereUrl")}
                      />
                    </Field>
                    <Field
                      id={fieldId("whereLicence")}
                      label={tUi("licence_note")}
                      tag="Optional"
                      hint="On what terms the answers can be used, as helpers will read it."
                      hintId="drive-licence-hint"
                    >
                      <textarea
                        id={fieldId("whereLicence")}
                        rows={2}
                        value={state.whereLicence}
                        onChange={(e) =>
                          update({ whereLicence: e.target.value })
                        }
                        style={{
                          ...styleOf("whereLicence"),
                          resize: "vertical",
                          lineHeight: 1.6,
                        }}
                        aria-describedby={describedBy(
                          "whereLicence",
                          "drive-licence-hint"
                        )}
                        aria-invalid={
                          Boolean(errorOf("whereLicence")) || undefined
                        }
                      />
                      <FieldMessage
                        field="whereLicence"
                        message={errorOf("whereLicence")}
                      />
                    </Field>
                  </div>
                ) : null}
              </Fragment>
            )
          })}
        </div>
      </Step>

      <Step
        n={4}
        title="Words for the card"
        hint="We’ve drafted these from your choices. Change anything."
        done={done[3]!}
      >
        <Field
          id={fieldId("title")}
          label={tUi("title")}
          tag="Required"
          count={
            <CharCount
              id="drive-title-count"
              length={state.title.length}
              max={TITLE_MAX}
            />
          }
          hint="Put *asterisks* around a word to show it in italics on the card."
          hintId="drive-title-hint"
          hintBelow
        >
          <input
            id={fieldId("title")}
            type="text"
            value={state.title}
            maxLength={TITLE_MAX}
            onChange={(e) => write("title", { title: e.target.value })}
            style={{
              ...styleOf("title"),
              fontFamily: T.font.sans,
              fontSize: "var(--type-body-large-size)",
            }}
            aria-describedby={describedBy(
              "title",
              "drive-title-count drive-title-hint"
            )}
            aria-invalid={Boolean(errorOf("title")) || undefined}
          />
          <FieldMessage field="title" message={errorOf("title")} />
        </Field>
        <Field
          id={fieldId("summary")}
          label={tUi("summary")}
          tag="Required"
          count={
            <CharCount
              id="drive-summary-count"
              length={state.summary.length}
              max={SUMMARY_MAX}
            />
          }
        >
          <textarea
            id={fieldId("summary")}
            rows={3}
            value={state.summary}
            onChange={(e) => write("summary", { summary: e.target.value })}
            style={{
              ...styleOf("summary"),
              resize: "vertical",
              lineHeight: 1.6,
            }}
            aria-describedby={describedBy("summary", "drive-summary-count")}
            aria-invalid={Boolean(errorOf("summary")) || undefined}
          />
          <FieldMessage field="summary" message={errorOf("summary")} />
        </Field>
        <div
          id={fieldId("steps")}
          tabIndex={-1}
          role="group"
          aria-labelledby="drive-steps-label"
          aria-describedby={describedBy("steps")}
          className="flex flex-col"
        >
          <p
            id="drive-steps-label"
            className={`${legendClass} mb-2`}
            style={{ color: T.ink.base }}
          >
            How to help<Tag>One to five short steps</Tag>
          </p>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {state.steps.map((step, i) => (
              // Steps have no ids of their own; the order is the identity.
              // eslint-disable-next-line react/no-array-index-key
              <li key={i} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    background: T.accent.chip,
                    color: T.accent.primaryHover,
                  }}
                >
                  {i + 1}
                </span>
                <input
                  type="text"
                  aria-label={`Step ${i + 1}`}
                  value={step}
                  maxLength={200}
                  onChange={(e) => setStep(i, e.target.value)}
                  style={{ ...styleOf("steps"), minWidth: 0 }}
                />
                {state.steps.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove step ${i + 1}`}
                    onClick={() =>
                      write("steps", {
                        steps: state.steps.filter((_, j) => j !== i),
                      })
                    }
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-muted)"
                    style={{
                      color: T.ink.dim,
                      background: T.bg.deep,
                      border: `1px solid ${T.border.line}`,
                    }}
                  >
                    <Icon aria-hidden="true" icon="mdi:close" width={18} />
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              className={SECONDARY}
              style={secondaryStyle}
              disabled={state.steps.length >= STEPS_MAX}
              onClick={() => write("steps", { steps: [...state.steps, ""] })}
            >
              <Icon aria-hidden="true" icon="mdi:plus" width={16} />
              Add a step
            </button>
            <button
              type="button"
              onClick={redraft}
              className="cursor-pointer text-sm font-semibold underline underline-offset-[3px]"
              style={{
                ...linkStyle,
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: T.font.sans,
              }}
            >
              Redraft from my choices
            </button>
          </div>
          <FieldMessage field="steps" message={errorOf("steps")} />
        </div>
      </Step>

      <Step
        n={5}
        title="When, and what counts as done?"
        hint="Drives run up to 90 days, midnight to midnight UTC."
        done={done[4]!}
        disabled={locked}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <Field
            id={fieldId("startsOn")}
            label={tUi("opens_on")}
            hint={
              proposing
                ? "At least a week away, for review."
                : "Today or later."
            }
            hintId="drive-starts-hint"
            hintBelow
          >
            <input
              id={fieldId("startsOn")}
              type="date"
              min={today}
              value={state.startsOn}
              onChange={(e) => update(withStartsOn(state, e.target.value))}
              style={styleOf("startsOn")}
              aria-describedby={describedBy("startsOn", "drive-starts-hint")}
              aria-invalid={Boolean(errorOf("startsOn")) || undefined}
            />
            <FieldMessage field="startsOn" message={errorOf("startsOn")} />
          </Field>
          <Segments
            id={fieldId("endsOn")}
            name="drive-runs-for"
            legend="Runs for"
            options={RUN_CHOICES.map((c) => ({
              value: c.days,
              label: c.label,
            }))}
            value={runDays}
            onChange={(days) =>
              update({
                endsOn: endsOnFor(state.startsOn, days) || state.endsOn,
              })
            }
            describedBy={describedBy("endsOn", "drive-runs-hint")}
          >
            <p
              id="drive-runs-hint"
              className="mt-2 mb-0 text-sm"
              style={{ color: T.ink.dim }}
            >
              {closes ? (
                <>
                  Closes on{" "}
                  <strong style={{ color: T.ink.base }}>{closes}</strong>
                </>
              ) : (
                "Choose when it opens first."
              )}
            </p>
            <FieldMessage field="endsOn" message={errorOf("endsOn")} />
          </Segments>
        </div>

        <Divider />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Segments
            id={fieldId("goalPercent")}
            name="drive-goal"
            legend="Goal"
            options={GOAL_CHOICES.map((g) => ({
              value: String(g.percent),
              label: g.label,
            }))}
            value={state.goalPercent}
            onChange={(v) => update({ goalPercent: v })}
            describedBy={describedBy("goalPercent", "drive-goal-hint")}
          >
            <p
              id="drive-goal-hint"
              className="mt-2 mb-0 text-sm"
              style={{ color: T.ink.dim }}
            >
              {goalHint(state.goalPercent, counts)}
            </p>
            <FieldMessage
              field="goalPercent"
              message={errorOf("goalPercent")}
            />
          </Segments>
          <Field
            id={fieldId("unit")}
            label={tUi("count_progress_in")}
            hint={
              todo == null
                ? `Shown on the card as “4 of 25 ${unitNoun(state.unit, 25)}”.`
                : `Shown as “4 of ${fmt(todo)} ${unitNoun(state.unit, todo)}”.`
            }
            hintId="drive-unit-hint"
            hintBelow
          >
            <SelectField
              id={fieldId("unit")}
              value={String(state.unit ?? "")}
              onValueChange={(selectedValue) =>
                update({ unit: selectedValue as DriveUnit })
              }
              className="cursor-pointer"
              style={styleOf("unit")}
              aria-describedby={describedBy("unit", "drive-unit-hint")}
              options={UNITS.map((u) => ({
                value: String(u.value),
                label: String(u.label),
              }))}
            />
            <FieldMessage field="unit" message={errorOf("unit")} />
          </Field>
        </div>

        {proposing ? (
          <>
            <Divider />
            <Disclosure
              id="drive-note-panel"
              open={noteOpen}
              onToggle={() => setNoteOpen(!noteOpen)}
              title={tUi("anything_the_moderator_should_know")}
              hint={tUi("optional_59be71")}
            >
              <Field
                id="drive-note"
                label={tUi("note_for_the_moderator")}
                tag="Optional"
                count={
                  <CharCount
                    id="drive-note-count"
                    length={note.length}
                    max={PROPOSAL_NOTE_MAX}
                  />
                }
              >
                <textarea
                  id="drive-note"
                  rows={4}
                  value={note}
                  maxLength={PROPOSAL_NOTE_MAX}
                  onChange={(e) => updateNote(e.target.value)}
                  style={{ ...input, resize: "vertical", lineHeight: 1.6 }}
                  aria-describedby="drive-note-count"
                />
              </Field>
            </Disclosure>
          </>
        ) : null}
      </Step>

      <ErrorSummary
        errors={shownErrors}
        summaryRef={summaryRef}
        verb={proposing ? "sending" : "saving"}
      />

      {refusal ? (
        <div ref={refusalRef} tabIndex={-1} role="alert">
          <Notice
            icon="mdi:alert-outline"
            tone="warn"
            title={tUi("the_proposal_wasnt_sent")}
          >
            <p className="m-0" style={{ color: T.ink.base }}>
              {refusal}
            </p>
          </Notice>
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-[24px] px-5 py-4 sm:px-6"
        style={cardStyle}
      >
        <div className="flex min-w-0 flex-col gap-1 text-base">
          {status}
          <p
            aria-live="polite"
            className="m-0 text-sm"
            style={{ color: T.ink.dim }}
          >
            {draftMessage ?? ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {draftKey ? (
            <button
              type="button"
              onClick={saveDraft}
              className="inline-flex cursor-pointer items-center rounded-full px-5 py-3 text-base font-semibold transition-colors hover:bg-(--t-bg-surface)"
              style={{ ...secondaryStyle, fontFamily: T.font.sans }}
            >
              Save draft
            </button>
          ) : null}
          <button
            type="submit"
            className={PRIMARY}
            disabled={saving || (proposing && Boolean(blocked))}
            aria-describedby={
              proposing && blocked ? "drive-blocked-reason" : undefined
            }
            style={{ border: "none", fontFamily: T.font.sans }}
          >
            {submitLabel(saving, proposing, editing)}
            {saving ? null : (
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
            )}
          </button>
        </div>
      </div>
    </form>
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:gap-6">
      <div className="flex min-w-0 flex-col gap-5">
        {announcement}
        {sent ? <ProposalSent /> : form}
      </div>

      <aside
        aria-label={tUi("about_this_drive")}
        className="flex min-w-0 flex-col gap-4 self-start lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
      >
        {sent ? null : <PreviewCard view={view} />}
        {sent ? null : (
          <ScopeCard
            counts={counts}
            focusKind={state.focusKind}
            locked={locked}
          />
        )}
        {proposing ? (
          standing ? (
            <StandingCard standing={standing} />
          ) : null
        ) : (
          <BoardCard editing={editing} />
        )}
      </aside>
    </div>
  )
}
