"use client"

import { Icon } from "@iconify/react"
import {
  checkText,
  DRIVE_MAX_LIBRARIES,
  DRIVE_MAX_TASKS,
  type DriveStatus,
  type DriveUnit,
  type GapKey,
  PANEL_GAPS,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

import { ChoiceCard, Notice } from "@/components/ds"
import {
  type FindPlace,
  pickPlace,
  placeChoices,
  placeName,
  placePath,
} from "@/components/index-page/find-helpers"
import { placeSelectLabels } from "@/components/index-page/place-select-labels"
import { SECTION_LABELS } from "@/components/library/verify.logic"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { type FindLocation, searchFind } from "@/lib/find-search"
import { LIBRARY_TYPES } from "@/lib/meilisearch"
import { Link, useRouter } from "@/lib/navigation"

import {
  type BuilderField,
  builderErrors,
  type BuilderMode,
  type BuilderPlace,
  type BuilderState,
  countsLine,
  emptyBuilderState,
  errorsFromResponse,
  type FieldError,
  fieldId,
  type FocusKind,
  isTooBig,
  parseLibraryList,
  previewRequest,
  PROPOSAL_NOTE_MAX,
  RECORD_TARGET_MAX,
  RECORD_TARGET_MIN,
  textOnlyInput,
  todayDay,
  toDriveInput,
} from "./builder.logic"
import { FOCUS_FILTER_META, FOCUS_META } from "./focus-meta"

const SUMMARY_MAX = 280
const STEPS_MAX = 5
const PREVIEW_DEBOUNCE_MS = 400
const fmt = (n: number) => n.toLocaleString("en-GB")

const UNITS: { value: DriveUnit; label: string }[] = [
  { value: "library", label: "Libraries" },
  { value: "branch", label: "Branches" },
  { value: "record", label: "Records" },
]

/** The three things a drive can do, as the Focus step offers them. */
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
    hint: "Add what’s missing, such as opening hours or a photo.",
    icon: "mdi:plus-circle-outline",
    tint: TYPE_TINT.public,
  },
  {
    kind: "verify",
    title: "Confirm details are still right",
    hint: "Helpers check sections nobody has confirmed since a date, and send what they checked.",
    icon: FOCUS_FILTER_META.verify.icon,
    tint: TYPE_TINT.academic,
  },
  {
    kind: "record",
    title: "Complete whole records",
    hint: "Helpers fill whatever each record lacks until it reaches the target.",
    icon: FOCUS_FILTER_META.record.icon,
    tint: TYPE_TINT.national,
  },
]

const SECTION_ICONS: Record<VerifySection, string> = {
  hours: "mdi:clock-outline",
  status: "mdi:door-open",
  address: "mdi:map-marker-outline",
  contact: "mdi:card-account-phone-outline",
}

const LEVEL_WORD: Record<BuilderPlace["level"], string> = {
  continent: "Continent",
  country: "Country",
  region: "Region",
  area: "Area",
}

const input: React.CSSProperties = {
  padding: "12px 16px",
  minHeight: 48,
  borderRadius: 14,
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: 16,
  fontFamily: T.font.sans,
  width: "100%",
  boxSizing: "border-box",
}

const invalidInput: React.CSSProperties = {
  ...input,
  borderColor: T.accent.danger,
}

const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: "clamp(20px,2.6vw,28px)",
}

const PRIMARY =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-(--t-accent-primary) px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
const SECONDARY =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-[18px] text-[15px] font-semibold transition-colors hover:border-(--t-accent-primary) disabled:cursor-not-allowed disabled:opacity-60"

const SECONDARY_LINK =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-[18px] text-[15px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"

const labelClass = "flex flex-col gap-1.5 text-[15px] font-semibold"
const hintClass = "m-0 text-[14px] font-normal leading-[1.5]"

/** Once a drive has opened, only its words and where to look change. */
const LOCKED_STATUSES: ReadonlySet<DriveStatus> = new Set([
  "open",
  "closed",
  "cancelled",
])

/** A numbered step of the builder, as a card with a fieldset. */
function Step({
  n,
  title,
  hint,
  id,
  disabled,
  children,
}: {
  readonly n: number
  readonly title: string
  readonly hint?: ReactNode
  readonly id?: string
  readonly disabled?: boolean
  readonly children: ReactNode
}) {
  return (
    <fieldset
      id={id}
      tabIndex={id ? -1 : undefined}
      disabled={disabled}
      className="m-0 flex min-w-0 flex-col gap-4 disabled:opacity-70"
      style={cardStyle}
    >
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
          style={{ background: T.accent.chip, color: T.accent.primaryHover }}
        >
          {n}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(22px,2.2vw,26px)",
              color: T.ink.base,
            }}
          >
            {title}
          </h2>
          {hint ? (
            <p className={hintClass} style={{ color: T.ink.dim }}>
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </fieldset>
  )
}

/** A field's own error line, under it; status as icon and text. */
function FieldMessage({
  field,
  message,
}: {
  readonly field: BuilderField
  readonly message?: string
}) {
  if (!message) return null

  return (
    <p
      id={`${fieldId(field)}-error`}
      className="m-0 flex items-start gap-1.5 text-[14px] font-semibold"
      style={{ color: T.accent.danger }}
    >
      <Icon
        aria-hidden="true"
        icon="mdi:alert-circle-outline"
        width={17}
        className="mt-px shrink-0"
      />
      {message}
    </p>
  )
}

/** A toggle chip: a real checkbox, styled as a pill. */
function CheckChip({
  checked,
  disabled,
  onChange,
  icon,
  children,
}: {
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: () => void
  readonly icon?: string
  readonly children: ReactNode
}) {
  return (
    <label
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[15px] font-medium transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--t-accent-primary) has-[:focus-visible]:outline-solid"
      style={{
        background: checked ? T.accent.chip : T.bg.deep,
        borderColor: checked ? T.accent.primary : T.border.hi,
        color: checked ? T.accent.primaryHover : T.ink.base,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <Icon
        aria-hidden="true"
        icon={checked ? "mdi:check" : (icon ?? "mdi:plus")}
        width={16}
        height={16}
      />
      {children}
    </label>
  )
}

/**
 * Continent, country, region and area selects (Find libraries' cascading
 * Location filter), and an "Add" button that adds the deepest chosen place
 * as a removable chip. A drive can cover places at any level.
 */
function PlacePicker({
  locale,
  places,
  invalid,
  onAdd,
  onRemove,
}: {
  readonly locale: string
  readonly places: readonly BuilderPlace[]
  readonly invalid: boolean
  readonly onAdd: (place: BuilderPlace) => void
  readonly onRemove: (place: BuilderPlace) => void
}) {
  const [place, setPlace] = useState<FindPlace | null>(null)
  const [location, setLocation] = useState<FindLocation | undefined>()
  const [failed, setFailed] = useState(false)
  const level = place?.level
  const slug = place?.slug

  useEffect(() => {
    let live = true
    searchFind({
      query: "",
      place: level && slug ? { level, slug } : undefined,
      locale,
      hitsPerPage: 1,
    })
      .then((res) => {
        if (!live) return
        setLocation(res.location)
        setFailed(false)
      })
      .catch(() => {
        if (live) setFailed(true)
      })

    return () => {
      live = false
    }
  }, [level, slug, locale])

  const path = placePath(place, location)
  const selects = placeSelectLabels(location)
  const chosen: BuilderPlace | null = place
    ? {
        level: place.level,
        slug: place.slug,
        name: placeName(place, location),
        kind: selects.find((s) => s.level === place.level)?.label,
      }
    : null
  const added =
    chosen &&
    places.some((p) => p.level === chosen.level && p.slug === chosen.slug)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {selects.map(({ level: lvl, label, all }, i) => {
          const parent = selects[i - 1]?.level
          if (parent && path[parent] === "") return null

          return (
            <label
              key={lvl}
              className={labelClass}
              style={{ color: T.ink.dim }}
            >
              {label}
              <select
                value={path[lvl]}
                onChange={(e) => setPlace(pickPlace(path, lvl, e.target.value))}
                className="cursor-pointer"
                style={invalid ? invalidInput : input}
                aria-describedby={
                  invalid ? `${fieldId("places")}-error` : undefined
                }
              >
                <option value="">{all}</option>
                {placeChoices(lvl, path, location).map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.count == null ? c.name : `${c.name} (${fmt(c.count)})`}
                  </option>
                ))}
              </select>
            </label>
          )
        })}
      </div>
      {failed ? (
        <p className={hintClass} style={{ color: T.accent.danger }}>
          The places couldn’t be loaded. Try again in a moment.
        </p>
      ) : null}
      <div>
        <button
          type="button"
          className={SECONDARY}
          style={{ color: T.ink.base }}
          disabled={!chosen || Boolean(added)}
          onClick={() => chosen && onAdd(chosen)}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:map-marker-plus-outline"
            width={18}
          />
          {chosen
            ? added
              ? `${chosen.name} is added`
              : `Add ${chosen.name}`
            : "Choose a place to add"}
        </button>
      </div>
      {places.length > 0 ? (
        <ul
          aria-label="Places in this drive"
          className="m-0 flex list-none flex-wrap gap-2 p-0"
        >
          {places.map((p) => (
            <li
              key={`${p.level}:${p.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3.5 text-[15px] font-semibold"
              style={{
                background: T.accent.chip,
                color: T.accent.primaryHover,
              }}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:map-marker-outline"
                width={16}
              />
              {p.name}
              <span className="font-normal" style={{ color: T.ink.dim }}>
                · {p.kind ?? LEVEL_WORD[p.level]}
              </span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => onRemove(p)}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white"
                style={{ color: T.accent.primaryHover }}
              >
                <Icon aria-hidden="true" icon="mdi:close" width={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={hintClass} style={{ color: T.ink.dim }}>
          No places yet. A library in any listed place is in the drive.
        </p>
      )}
    </div>
  )
}

type Preview = {
  /** The request these numbers answer. */
  key: string
  status: "ready" | "error"
  total?: number
  todo?: number
  unknown?: string[]
  message?: string
}

/** What the counts wait for, by Focus. */
const COUNTS_PROMPT: Record<FocusKind, string> = {
  gaps: "Choose a gap and a place (or a list) to see how many libraries it covers.",
  verify:
    "Choose a section, a date and a place (or a list) to see how many libraries it covers.",
  record:
    "Set a target and a place (or a list) to see how many libraries it covers.",
}

/** Why nothing is left to do in scope, by Focus. */
const NOTHING_TO_DO: Record<FocusKind, { why: string; change: string }> = {
  gaps: {
    why: "Every library in scope already has this.",
    change: "Choose another place or gap.",
  },
  verify: {
    why: "Every library in scope has been confirmed since then.",
    change: "Choose another place or an earlier date.",
  },
  record: {
    why: "Every library in scope is already this complete.",
    change: "Choose another place or a higher target.",
  },
}

/** "N in scope, M to do", the too-big warning and an empty drive's note. */
function LiveCounts({
  pending,
  preview,
  locked,
  mode,
  focusKind,
}: {
  readonly pending: boolean
  readonly preview: Preview | null
  readonly locked: boolean
  readonly mode: BuilderMode
  readonly focusKind: FocusKind
}) {
  const proposing = mode === "propose"
  const nothing = NOTHING_TO_DO[focusKind]
  let body: ReactNode
  if (locked) {
    body = "The scope is fixed once a drive opens, so it isn’t counted here."
  } else if (!preview && !pending) {
    body = COUNTS_PROMPT[focusKind]
  } else if (pending) {
    body = "Counting…"
  } else if (preview?.status === "error") {
    body =
      preview.message ??
      (proposing
        ? "The counts couldn’t be loaded. You can still send it."
        : "The counts couldn’t be loaded. You can still save.")
  } else if (preview) {
    const counts = { total: preview.total ?? 0, todo: preview.todo ?? 0 }

    body = (
      <div className="flex flex-col gap-3">
        <p
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(24px,2.4vw,30px)",
            color: T.ink.base,
          }}
        >
          {countsLine(counts)}
        </p>
        {isTooBig(counts) ? (
          <Notice
            icon="mdi:alert-outline"
            tone="warn"
            title="Too big to finish: split it by region"
          >
            <p className="m-0" style={{ color: T.ink.base }}>
              {proposing
                ? `A drive opens with at most ${fmt(DRIVE_MAX_TASKS)} to do. Narrow it before you send it.`
                : `A drive opens with at most ${fmt(DRIVE_MAX_TASKS)} to do. Save it and it stays scheduled.`}
            </p>
          </Notice>
        ) : null}
        {counts.todo === 0 ? (
          <Notice
            icon="mdi:information-outline"
            tone="info"
            title="Nothing to do here"
          >
            <p className="m-0" style={{ color: T.ink.base }}>
              {proposing
                ? `${nothing.why} ${nothing.change}`
                : `${nothing.why} A drive with nothing to do stays scheduled.`}
            </p>
          </Notice>
        ) : null}
      </div>
    )
  }

  return (
    <section
      aria-labelledby="drive-counts-heading"
      className="flex flex-col gap-2"
      style={{ ...cardStyle, background: T.bg.surface }}
    >
      <h2
        id="drive-counts-heading"
        className="m-0 text-[15px] font-semibold"
        style={{ color: T.ink.dim }}
      >
        Live counts
      </h2>
      <div
        aria-live="polite"
        className="text-[15px]"
        style={{ color: T.ink.dim }}
      >
        {body}
      </div>
    </section>
  )
}

/** The errors before Save, each linking to its field. */
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
      tabIndex={-1}
      role="alert"
      aria-labelledby="drive-errors-title"
      className="flex flex-col gap-2 rounded-[16px] px-4 py-3.5"
      style={{ background: "var(--tint-special-bg)", outlineOffset: 2 }}
    >
      <p
        id="drive-errors-title"
        className="m-0 flex items-center gap-1.5 text-[15px] font-semibold"
        style={{ color: T.accent.danger }}
      >
        <Icon aria-hidden="true" icon="mdi:alert-circle-outline" width={18} />
        {errors.length === 1
          ? `Fix this before ${verb}`
          : `Fix these ${errors.length} things before ${verb}`}
      </p>
      <ul className="m-0 flex flex-col gap-1 pl-5 text-[15px]">
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

/** "Proposal sent": the ok notice and where to go next, focused on arrival. */
function ProposalSent() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div
      className="mx-auto flex w-full max-w-[860px] flex-col"
      style={{
        padding:
          "clamp(28px,3.4vw,44px) clamp(16px,3vw,32px) clamp(56px,7vw,88px)",
        gap: "clamp(18px,2.4vw,24px)",
      }}
    >
      <div ref={ref} tabIndex={-1} style={{ outlineOffset: 4 }}>
        <Notice icon="mdi:check-circle-outline" tone="ok" title="Proposal sent">
          <p className="m-0" style={{ color: T.ink.base }}>
            A Moderator will review it. You’ll get an email when it’s decided.
          </p>
        </Notice>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link
          href="/community"
          className={SECONDARY_LINK}
          style={{ color: T.ink.base }}
        >
          <Icon aria-hidden="true" icon="mdi:arrow-left" width={18} />
          Back to the Noticeboard
        </Link>
        <Link
          href="/contribute/submissions"
          className={SECONDARY_LINK}
          style={{ color: T.ink.base }}
        >
          My submissions
        </Link>
      </div>
    </div>
  )
}

/**
 * The drive builder (spec §5.7): Focus, Scope with live counts, where to
 * look, the words, then dates and goal.
 *
 * - **Board mode** (the editorial board): a new drive saves as scheduled;
 *   the board pins it or opens it from its page. Once a drive has opened
 *   only its words and where to look change.
 * - **Propose mode** (anyone else): the same steps plus a note for the
 *   Moderator, sent as a Drive Proposal (`POST /api/drives/proposals`).
 *   `blocked` disables "Send proposal" and says why.
 */
export function DriveBuilder({
  initial,
  locale,
  drive,
  mode = "board",
  blocked = null,
}: {
  readonly initial?: BuilderState
  readonly locale: string
  /** The drive being edited; omitted for a new drive. */
  readonly drive?: { documentId: string; slug: string; status: DriveStatus }
  readonly mode?: BuilderMode
  /** Why a proposal can't be sent yet, shown by the disabled button. */
  readonly blocked?: string | null
}) {
  const router = useRouter()
  const proposing = mode === "propose"
  const [state, setState] = useState(() => initial ?? emptyBuilderState())
  const [errors, setErrors] = useState<FieldError[] | null>(null)
  const [serverErrors, setServerErrors] = useState<FieldError[]>([])
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [note, setNote] = useState("")
  const [refusal, setRefusal] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)
  const refusalRef = useRef<HTMLDivElement>(null)
  const locked =
    !proposing && Boolean(drive && LOCKED_STATUSES.has(drive.status))

  const request = locked ? null : previewRequest(state)
  const key = request ? JSON.stringify(request) : ""
  const current = preview && preview.key === key ? preview : null
  const unknownLibraries = current?.unknown ?? []

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
        const json = (await res.json().catch(() => null)) as {
          total?: number
          todo?: number
          unknown?: string[]
        } | null
        if (!res.ok || !json) {
          setPreview({
            key,
            status: "error",
            message: json ? errorsFromResponse(json)[0]?.message : undefined,
          })

          return
        }
        setPreview({
          key,
          status: "ready",
          total: json.total ?? 0,
          todo: json.todo ?? 0,
          unknown: json.unknown ?? [],
        })
      } catch {
        if (!ctrl.signal.aborted) setPreview({ key, status: "error" })
      }
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key])

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

  /** Applies a change; once Save was tried, the errors follow the form. */
  const update = (patch: Partial<BuilderState>) => {
    const next = { ...state, ...patch }
    setState(next)
    setServerErrors([])
    setRefusal(null)
    if (errors !== null) setErrors(problemsOf(next, note))
  }

  const updateNote = (text: string) => {
    setNote(text)
    setServerErrors([])
    setRefusal(null)
    if (errors !== null) setErrors(problemsOf(state, text))
  }

  const focusSummary = () =>
    requestAnimationFrame(() => summaryRef.current?.focus())

  /** Sends the proposal; Strapi's verdict comes back as it is. */
  const propose = async () => {
    try {
      const res = await fetch("/api/drives/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toDriveInput(state), note: note.trim() }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (res.ok) {
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

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (saving || (proposing && blocked)) return
    const problems = problemsOf(state, note)
    setErrors(problems)
    setServerErrors([])
    setRefusal(null)
    if (problems.length > 0) {
      focusSummary()

      return
    }

    setSaving(true)
    if (proposing) {
      await propose()

      return
    }
    const input = toDriveInput(state)
    try {
      const res = await fetch(
        drive ? `/api/drives/${drive.documentId}` : "/api/drives",
        {
          method: drive ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locked ? textOnlyInput(input) : input),
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
      const slug = json?.data?.slug ?? drive?.slug
      router.push(slug ? driveHref(slug) : "/community")
      router.refresh()
    } catch {
      setServerErrors(errorsFromResponse(null))
      setSaving(false)
      focusSummary()
    }
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
  const setStep = (i: number, text: string) =>
    update({ steps: state.steps.map((s, j) => (j === i ? text : s)) })

  const list = parseLibraryList(state.libraryList)
  const listCount = list.refs.length
  const today = todayDay()
  const sectionsError = errorOf("verifySections")
  const beforeInvalid =
    Boolean(sectionsError) &&
    (!state.verifyBefore || state.verifyBefore > today)

  // Announces the send; it stays mounted while the form gives way.
  const announcement = proposing ? (
    <p aria-live="polite" className="sr-only">
      {sent ? "Proposal sent" : ""}
    </p>
  ) : null

  if (sent) {
    return (
      <>
        {announcement}
        <ProposalSent />
      </>
    )
  }

  return (
    <>
      {announcement}
      <form
        noValidate
        onSubmit={save}
        className="mx-auto flex w-full max-w-[860px] flex-col"
        style={{
          padding:
            "clamp(28px,3.4vw,44px) clamp(16px,3vw,32px) clamp(56px,7vw,88px)",
          gap: "clamp(18px,2.4vw,24px)",
        }}
      >
        {proposing ? (
          <p
            className="m-0 text-[17px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            A Moderator reviews every proposal. Approved drives open on their
            start date.
          </p>
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

        <Step n={1} id={fieldId("focus")} title="Focus" disabled={locked}>
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend
              className="mb-2 p-0 text-[15px] font-semibold"
              style={{ color: T.ink.base }}
            >
              What will the drive do?
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
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
          </fieldset>

          {state.focusKind === "gaps" ? (
            <div
              role="group"
              aria-labelledby="drive-gaps-label"
              aria-describedby="drive-gaps-hint"
              className="flex flex-col gap-2"
            >
              <p
                id="drive-gaps-label"
                className="m-0 text-[15px] font-semibold"
                style={{ color: T.ink.base }}
              >
                Gaps to fill
              </p>
              <div className="flex flex-wrap gap-2.5">
                {PANEL_GAPS.map((gap) => {
                  const checked = state.gaps.includes(gap)

                  return (
                    <CheckChip
                      key={gap}
                      checked={checked}
                      disabled={!checked && state.gaps.length >= 3}
                      onChange={() => toggleGap(gap)}
                      icon={FOCUS_META[gap].icon}
                    >
                      {FOCUS_META[gap].label}
                    </CheckChip>
                  )
                })}
              </div>
              <p
                id="drive-gaps-hint"
                className={hintClass}
                style={{ color: T.ink.dim }}
              >
                One to three. Each library’s task fills them all in one go.
              </p>
            </div>
          ) : null}

          {state.focusKind === "verify" ? (
            <div className="flex flex-col gap-4">
              <fieldset
                id={fieldId("verifySections")}
                tabIndex={-1}
                className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
                aria-describedby={describedBy("verifySections")}
              >
                <legend
                  className="mb-2 p-0 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  Sections to confirm
                </legend>
                <div className="flex flex-wrap gap-2.5">
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
              <label className={labelClass} style={{ color: T.ink.base }}>
                Not confirmed since
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
                      sectionsError
                        ? `${fieldId("verifySections")}-error`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  aria-invalid={beforeInvalid || undefined}
                />
                <span
                  id="drive-verify-before-hint"
                  className={hintClass}
                  style={{ color: T.ink.dim }}
                >
                  Sections nobody has ever confirmed count too.
                </span>
              </label>
              <FieldMessage field="verifySections" message={sectionsError} />
            </div>
          ) : null}

          {state.focusKind === "record" ? (
            <label className={labelClass} style={{ color: T.ink.base }}>
              Done at this completeness (%)
              <input
                id={fieldId("recordTarget")}
                type="number"
                inputMode="numeric"
                min={RECORD_TARGET_MIN}
                max={RECORD_TARGET_MAX}
                step={5}
                value={state.recordTarget}
                onChange={(e) => update({ recordTarget: e.target.value })}
                style={{ ...styleOf("recordTarget"), maxWidth: 140 }}
                aria-describedby={describedBy(
                  "recordTarget",
                  "drive-record-hint"
                )}
                aria-invalid={Boolean(errorOf("recordTarget")) || undefined}
              />
              <span
                id="drive-record-hint"
                className={hintClass}
                style={{ color: T.ink.dim }}
              >
                From {RECORD_TARGET_MIN} to {RECORD_TARGET_MAX}. A record is
                done once it reaches this.
              </span>
              <FieldMessage
                field="recordTarget"
                message={errorOf("recordTarget")}
              />
            </label>
          ) : null}

          <FieldMessage field="focus" message={errorOf("focus")} />
        </Step>

        <Step
          n={2}
          title="Scope"
          hint="The libraries it covers. Add places at any level, then narrow by type, dataset or completeness. Closed libraries are always left out."
          disabled={locked}
        >
          <div
            id={fieldId("places")}
            tabIndex={-1}
            role="group"
            aria-label="Places"
            className="flex flex-col gap-3"
          >
            <PlacePicker
              locale={locale}
              places={state.places}
              invalid={Boolean(errorOf("places"))}
              onAdd={(p) => update({ places: [...state.places, p] })}
              onRemove={(p) =>
                update({
                  places: state.places.filter(
                    (q) => !(q.level === p.level && q.slug === p.slug)
                  ),
                })
              }
            />
            <FieldMessage field="places" message={errorOf("places")} />
          </div>

          <fieldset
            id={fieldId("libraryTypes")}
            tabIndex={-1}
            className="m-0 flex flex-col gap-2 border-0 p-0"
          >
            <legend
              className="mb-2 p-0 text-[15px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Library types{" "}
              <span className="font-normal" style={{ color: T.ink.dim }}>
                None ticked means every type
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {LIBRARY_TYPES.map((type) => (
                <CheckChip
                  key={type}
                  checked={state.libraryTypes.includes(type)}
                  onChange={() => toggleType(type)}
                >
                  {type}
                </CheckChip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass} style={{ color: T.ink.base }}>
              Dataset{" "}
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
              <span
                id="drive-source-hint"
                className={hintClass}
                style={{ color: T.ink.dim }}
              >
                A dataset key, such as <code>imls-pls</code>: only records
                imported from it count. Leave it blank for every source.
              </span>
            </label>
            <label className={labelClass} style={{ color: T.ink.base }}>
              Only libraries below N% complete
              <span className="flex items-center gap-2">
                <input
                  id={fieldId("completenessBelow")}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={state.completenessBelow}
                  onChange={(e) =>
                    update({ completenessBelow: e.target.value })
                  }
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
              <span
                id="drive-completeness-hint"
                className={hintClass}
                style={{ color: T.ink.dim }}
              >
                Optional. Leave it blank to include every record.
              </span>
              <FieldMessage
                field="completenessBelow"
                message={errorOf("completenessBelow")}
              />
            </label>
          </div>
          <FieldMessage field="source" message={errorOf("source")} />

          <label className={labelClass} style={{ color: T.ink.base }}>
            Or list the libraries
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
              }}
              aria-describedby={describedBy(
                "libraries",
                "drive-libraries-hint"
              )}
              aria-invalid={Boolean(errorOf("libraries")) || undefined}
            />
            <span
              id="drive-libraries-hint"
              className={hintClass}
              style={{ color: T.ink.dim }}
            >
              Slugs or documentIds, one per line, up to{" "}
              {fmt(DRIVE_MAX_LIBRARIES)}. Links to library pages work too. A
              list replaces the places above.
              {listCount > 0 ? ` ${fmt(listCount)} listed.` : ""}
            </span>
            {unknownLibraries.length > 0 && !errorOf("libraries") ? (
              <span className={hintClass} style={{ color: T.accent.danger }}>
                Not found: {unknownLibraries.join(", ")}.
              </span>
            ) : null}
            <FieldMessage field="libraries" message={errorOf("libraries")} />
          </label>
        </Step>

        <LiveCounts
          mode={mode}
          focusKind={state.focusKind}
          locked={locked}
          pending={Boolean(key) && !current}
          preview={key ? current : null}
        />

        <Step
          n={3}
          title="Where to look"
          hint={
            proposing
              ? "Facts from a library’s own website are fine. Data copied from map services isn’t."
              : "Facts from a library’s own website are fine to use. Data from map services, such as Google Maps, isn’t: their terms don’t allow copying it."
          }
        >
          <label className={labelClass} style={{ color: T.ink.base }}>
            Source name
            <input
              id={fieldId("whereName")}
              type="text"
              value={state.whereName}
              onChange={(e) => update({ whereName: e.target.value })}
              style={styleOf("whereName")}
              aria-describedby={describedBy("whereName")}
              aria-invalid={Boolean(errorOf("whereName")) || undefined}
              placeholder="Each library’s own website"
            />
            <FieldMessage field="whereName" message={errorOf("whereName")} />
          </label>
          <label className={labelClass} style={{ color: T.ink.base }}>
            Link
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
            <FieldMessage field="whereUrl" message={errorOf("whereUrl")} />
          </label>
          <label className={labelClass} style={{ color: T.ink.base }}>
            Licence note
            <textarea
              id={fieldId("whereLicence")}
              rows={2}
              value={state.whereLicence}
              onChange={(e) => update({ whereLicence: e.target.value })}
              style={{ ...styleOf("whereLicence"), resize: "vertical" }}
              aria-describedby={describedBy(
                "whereLicence",
                "drive-licence-hint"
              )}
              aria-invalid={Boolean(errorOf("whereLicence")) || undefined}
            />
            <span
              id="drive-licence-hint"
              className={hintClass}
              style={{ color: T.ink.dim }}
            >
              On what terms the answers can be used, as helpers will read it.
            </span>
            <FieldMessage
              field="whereLicence"
              message={errorOf("whereLicence")}
            />
          </label>
        </Step>

        <Step
          n={4}
          title="Words"
          hint="What helpers read on the card and the drive’s page."
        >
          <label className={labelClass} style={{ color: T.ink.base }}>
            Title
            <input
              id={fieldId("title")}
              type="text"
              value={state.title}
              maxLength={120}
              onChange={(e) => update({ title: e.target.value })}
              style={styleOf("title")}
              aria-describedby={describedBy("title", "drive-title-hint")}
              aria-invalid={Boolean(errorOf("title")) || undefined}
            />
            <span
              id="drive-title-hint"
              className={hintClass}
              style={{ color: T.ink.dim }}
            >
              3 to 120 characters. Wrap words in *asterisks* to set them in
              italics, as on the card.
            </span>
            <FieldMessage field="title" message={errorOf("title")} />
          </label>
          <label className={labelClass} style={{ color: T.ink.base }}>
            Summary
            <textarea
              id={fieldId("summary")}
              rows={3}
              value={state.summary}
              onChange={(e) => update({ summary: e.target.value })}
              style={{ ...styleOf("summary"), resize: "vertical" }}
              aria-describedby={describedBy("summary", "drive-summary-count")}
              aria-invalid={Boolean(errorOf("summary")) || undefined}
            />
            <span
              id="drive-summary-count"
              className={hintClass}
              style={{
                color:
                  state.summary.length > SUMMARY_MAX
                    ? T.accent.danger
                    : T.ink.dim,
              }}
            >
              {state.summary.length} of {SUMMARY_MAX} characters
            </span>
            <FieldMessage field="summary" message={errorOf("summary")} />
          </label>
          <div
            id={fieldId("steps")}
            tabIndex={-1}
            role="group"
            aria-labelledby="drive-steps-label"
            aria-describedby={describedBy("steps")}
            className="flex flex-col gap-2.5"
          >
            <p
              id="drive-steps-label"
              className="m-0 text-[15px] font-semibold"
              style={{ color: T.ink.base }}
            >
              How to help{" "}
              <span className="font-normal" style={{ color: T.ink.dim }}>
                One to five short steps
              </span>
            </p>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {state.steps.map((step, i) => (
                // Steps have no ids of their own; the order is the identity.
                // eslint-disable-next-line react/no-array-index-key
                <li key={i} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
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
                    style={styleOf("steps")}
                  />
                  {state.steps.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove step ${i + 1}`}
                      onClick={() =>
                        update({ steps: state.steps.filter((_, j) => j !== i) })
                      }
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-(--t-bg-muted)"
                      style={{ color: T.ink.dim }}
                    >
                      <Icon aria-hidden="true" icon="mdi:close" width={18} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
            <div>
              <button
                type="button"
                className={SECONDARY}
                style={{ color: T.ink.base }}
                disabled={state.steps.length >= STEPS_MAX}
                onClick={() => update({ steps: [...state.steps, ""] })}
              >
                <Icon aria-hidden="true" icon="mdi:plus" width={18} />
                Add a step
              </button>
            </div>
            <FieldMessage field="steps" message={errorOf("steps")} />
          </div>
        </Step>

        <Step
          n={5}
          title="Dates and goal"
          hint="It opens at the start of its first day and closes at the end of its last (UTC), at most 90 days later."
          disabled={locked}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass} style={{ color: T.ink.base }}>
              Opens on
              <input
                id={fieldId("startsOn")}
                type="date"
                value={state.startsOn}
                onChange={(e) => update({ startsOn: e.target.value })}
                style={styleOf("startsOn")}
                aria-describedby={describedBy(
                  "startsOn",
                  proposing ? "drive-starts-hint" : undefined
                )}
                aria-invalid={Boolean(errorOf("startsOn")) || undefined}
              />
              {proposing ? (
                <span
                  id="drive-starts-hint"
                  className={hintClass}
                  style={{ color: T.ink.dim }}
                >
                  Start a week or more from now: a Moderator reviews it first.
                </span>
              ) : null}
              <FieldMessage field="startsOn" message={errorOf("startsOn")} />
            </label>
            <label className={labelClass} style={{ color: T.ink.base }}>
              Ends on
              <input
                id={fieldId("endsOn")}
                type="date"
                value={state.endsOn}
                onChange={(e) => update({ endsOn: e.target.value })}
                style={styleOf("endsOn")}
                aria-describedby={describedBy("endsOn")}
                aria-invalid={Boolean(errorOf("endsOn")) || undefined}
              />
              <FieldMessage field="endsOn" message={errorOf("endsOn")} />
            </label>
            <label className={labelClass} style={{ color: T.ink.base }}>
              Goal
              <span className="flex items-center gap-2">
                <input
                  id={fieldId("goalPercent")}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={state.goalPercent}
                  onChange={(e) => update({ goalPercent: e.target.value })}
                  style={{ ...styleOf("goalPercent"), maxWidth: 140 }}
                  aria-describedby={describedBy(
                    "goalPercent",
                    "drive-goal-hint"
                  )}
                  aria-invalid={Boolean(errorOf("goalPercent")) || undefined}
                />
                <span aria-hidden="true" style={{ color: T.ink.dim }}>
                  %
                </span>
              </span>
              <span
                id="drive-goal-hint"
                className={hintClass}
                style={{ color: T.ink.dim }}
              >
                The drive closes early once this share is done.
              </span>
              <FieldMessage
                field="goalPercent"
                message={errorOf("goalPercent")}
              />
            </label>
            <fieldset
              id={fieldId("unit")}
              tabIndex={-1}
              className="m-0 flex flex-col gap-2 border-0 p-0"
            >
              <legend
                className="mb-1.5 p-0 text-[15px] font-semibold"
                style={{ color: T.ink.base }}
              >
                Counted as
              </legend>
              <div className="flex flex-wrap gap-2">
                {UNITS.map((u) => (
                  <label
                    key={u.value}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[15px] font-medium has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--t-accent-primary) has-[:focus-visible]:outline-solid"
                    style={{
                      background:
                        state.unit === u.value ? T.accent.chip : T.bg.deep,
                      borderColor:
                        state.unit === u.value ? T.accent.primary : T.border.hi,
                      color:
                        state.unit === u.value
                          ? T.accent.primaryHover
                          : T.ink.base,
                    }}
                  >
                    <input
                      type="radio"
                      name="drive-unit"
                      value={u.value}
                      checked={state.unit === u.value}
                      onChange={() => update({ unit: u.value })}
                      className="sr-only"
                    />
                    <Icon
                      aria-hidden="true"
                      icon={
                        state.unit === u.value
                          ? "mdi:radiobox-marked"
                          : "mdi:radiobox-blank"
                      }
                      width={16}
                    />
                    {u.label}
                  </label>
                ))}
              </div>
              <p className={hintClass} style={{ color: T.ink.dim }}>
                The noun on its progress: “142 of 251 branches”.
              </p>
              <FieldMessage field="unit" message={errorOf("unit")} />
            </fieldset>
          </div>
        </Step>

        {proposing ? (
          <Step
            n={6}
            title="Anything the Moderator should know?"
            hint="Optional. Why this gap matters, or anything about the source."
          >
            <label className={labelClass} style={{ color: T.ink.base }}>
              Note for the Moderator
              <textarea
                id="drive-note"
                rows={4}
                value={note}
                maxLength={PROPOSAL_NOTE_MAX}
                onChange={(e) => updateNote(e.target.value)}
                style={{ ...input, resize: "vertical" }}
                aria-describedby="drive-note-count"
              />
              <span
                id="drive-note-count"
                className={hintClass}
                style={{ color: T.ink.dim }}
              >
                {note.length} of {fmt(PROPOSAL_NOTE_MAX)} characters
              </span>
            </label>
          </Step>
        ) : null}

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
              title="The proposal wasn’t sent"
            >
              <p className="m-0" style={{ color: T.ink.base }}>
                {refusal}
              </p>
            </Notice>
          </div>
        ) : null}

        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-5"
          style={{ borderColor: T.border.divider }}
        >
          <button
            type="submit"
            className={PRIMARY}
            disabled={saving || (proposing && Boolean(blocked))}
            aria-describedby={
              proposing && blocked ? "drive-blocked-reason" : undefined
            }
            style={{ border: "none", fontFamily: T.font.sans }}
          >
            {submitLabel(saving, proposing, Boolean(drive))}
            {saving ? null : (
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
            )}
          </button>
          <Link
            href={drive && !proposing ? driveHref(drive.slug) : "/community"}
            className="text-[15px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Cancel
          </Link>
          {proposing && blocked ? (
            <span
              id="drive-blocked-reason"
              className="flex items-center gap-1.5 text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              <Icon aria-hidden="true" icon="mdi:lock-outline" width={16} />
              {blocked}
            </span>
          ) : null}
          {drive || proposing ? null : (
            <span className="text-[14px]" style={{ color: T.ink.dim }}>
              It’s saved as scheduled. Pin it or open it now from its page.
            </span>
          )}
        </div>
      </form>
    </>
  )
}

/** The submit button's words: sending, saving, or what it will do. */
function submitLabel(saving: boolean, proposing: boolean, editing: boolean) {
  if (proposing) return saving ? "Sending…" : "Send proposal"
  if (saving) return "Saving…"

  return editing ? "Save changes" : "Save drive"
}
