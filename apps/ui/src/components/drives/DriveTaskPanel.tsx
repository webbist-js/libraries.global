"use client"

import { Icon } from "@iconify/react"
import {
  findUnsafeContent,
  type GapKey,
  gapDefinition,
  type VerifySection,
} from "@repo/shared-data"
import { type ReactNode, type Ref, useEffect, useId, useState } from "react"

import {
  type CorrectionRecord,
  hasRecordChange,
  type RecordChanges,
  type RecordEdit,
} from "@/components/contribute/correction.logic"
import { CorrectionEditor } from "@/components/contribute/CorrectionEditor"
import { PhotoUpload } from "@/components/contribute/PhotoUpload"
import {
  FIELD,
  Label,
  PRIMARY,
  SECONDARY,
} from "@/components/contribute/wizard-ui"
import {
  blockerFor,
  EMPTY_DRAFT,
  PHOTO_LICENCE,
  type WizardDraft,
} from "@/components/contribute/wizard.logic"
import { Notice } from "@/components/ds/Notice"
import { facilityRows } from "@/components/library/facility-rows"
import { LibraryFacilityAnswers } from "@/components/library/LibraryFacilityAnswers"
import {
  SECTION_LABELS,
  verifyPayload,
  verifyProblem,
  verifyProblemField,
} from "@/components/library/verify.logic"
import { VerifyFields } from "@/components/library/VerifyFields"
import { T } from "@/lib/design-tokens"
import type { Drive, DriveTask } from "@/lib/drives/types"
import { Link } from "@/lib/navigation"

import { FOCUS_META } from "./focus-meta"
import {
  categoryChanges,
  evidenceProblem,
  evidenceRequired,
  MODE_CATEGORIES,
  type PanelGap,
  panelChanges,
  panelGapsOf,
  type PanelMode,
  panelModeOf,
  type PendingQuota,
  photoPayload,
  quotaReason,
  RECORD_EDITORS,
  recordGapsOf,
  type RecordMode,
  recordPayload,
  recordTaskPayload,
  taskPlace,
  verifySectionsFor,
  webSearchHref,
  withoutDrive,
} from "./task-panel.logic"

const LINK =
  "inline-flex items-center gap-1.5 text-[15px] font-semibold underline underline-offset-[3px]"

const DIM = "m-0 text-[15px]"

const NO_RECORD = "We couldn’t load this record. Skip it, or try again later."

const EVIDENCE_HINTS: Record<RecordMode, string> = {
  hours: "Required. The page with the library’s opening hours.",
  contact: "Required. The page with its contact details.",
  closed: "Optional. A link, or where you saw it.",
}

const isRecordMode = (m: PanelMode | null): m is RecordMode =>
  m === "hours" || m === "contact" || m === "closed"

const isPanelGapMode = (m: PanelMode | null): m is PanelGap =>
  m !== null && m in FOCUS_META

/** The modes that send one record correction: a gap's editor, or the checklist. */
type EvidenceMode = RecordMode | "record"

/** "Back to opening hours": the way back from "closed or moved". */
function backLabelOf(mode: PanelMode | null): string {
  if (mode === "verify") return "Back to confirming details"
  if (mode === "record") return "Back to the checklist"

  return isPanelGapMode(mode)
    ? `Back to ${FOCUS_META[mode].label.toLowerCase()}`
    : "Back"
}

/** "Where did you find this?"'s hint: a gap's own, or the checklist's. */
function evidenceHintOf(mode: RecordMode | null, required: boolean): string {
  if (mode) return EVIDENCE_HINTS[mode]

  return required
    ? "Required. The page you found these details on."
    : "Optional. A link, or where you saw it."
}

/** "opening hours, address or contact details". */
function joinOr(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ""

  return `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`
}

/** The message a failed /api/submissions answer carries, if any. */
function errorMessage(json: unknown): string | undefined {
  const error = (json as { error?: string | { message?: string } } | null)
    ?.error

  return typeof error === "string" ? error : error?.message
}

type Body = { driveDocumentId?: string } & Record<string, unknown>

type Loaded = { record: CorrectionRecord | null } | null

/** The library's record as the correction editors start from it. */
function useRecord(slug: string, enabled: boolean): Loaded {
  const [state, setState] = useState<Loaded>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    fetch(`/api/contribute/library/${encodeURIComponent(slug)}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      )
      .then((json: { data?: CorrectionRecord }) => {
        if (live) setState({ record: json.data ?? null })
      })
      .catch(() => {
        if (live) setState({ record: null })
      })

    return () => {
      live = false
    }
  }, [slug, enabled])

  return state
}

type PhotoState = {
  photo: WizardDraft["photo"]
  caption: string
  credit: string
  licence: boolean
}

/** What a verify sends: the ticked sections, the page, and "in person". */
type VerifyState = {
  sections: VerifySection[]
  source: string
  inPerson: boolean
}

/**
 * Why Send can't go yet, or null: for a verify, the record and the
 * "Still right?" rules; else the record (loaded, changed, and with its
 * source for hours, addresses and contact details), the photo and its
 * licence, then the content-safety check over what the reader wrote.
 */
function panelBlocker({
  mode,
  loaded,
  changes,
  evidence,
  categories,
  verify,
  photo,
  name,
}: {
  mode: PanelMode | null
  loaded: Loaded
  changes: RecordChanges | null
  evidence: string
  /** The whole-record checklist's open categories. */
  categories: readonly string[]
  verify: VerifyState
  photo: PhotoState
  name: string
}): string | null {
  if (mode === "verify") {
    if (!loaded) return "Loading the record…"
    if (!loaded.record) return NO_RECORD

    return verifyProblem(verify)
  }
  if (isRecordMode(mode) || mode === "record") {
    if (!loaded) return "Loading the record…"
    if (!loaded.record) return NO_RECORD
    if (!changes || !hasRecordChange(changes))
      return "Change something to continue."
    const issue = evidenceProblem(mode, evidence, categories)
    if (issue) return issue
  }
  if (mode === "photo") {
    const issue = blockerFor(
      "photo",
      3,
      { slug: "", name },
      { ...EMPTY_DRAFT, photo: photo.photo, licence: photo.licence }
    )
    if (issue) return issue
  }

  return (
    findUnsafeContent(
      {
        source: evidence,
        credit: photo.credit,
        text: photo.caption,
        record: changes?.changes,
      },
      [name]
    )?.message ?? null
  )
}

/** "Kept for you until 14:35" (local time), or null without a hold. */
function heldUntilLabel(heldUntil: string | null | undefined): string | null {
  if (!heldUntil) return null
  const at = new Date(heldUntil)
  if (Number.isNaN(at.getTime())) return null

  return `Kept for you until ${at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
}

/** The library's name (the focus target), its place, and its website. */
function PanelHeader({
  task,
  website,
  heldUntil,
  nameRef,
}: {
  readonly task: DriveTask
  readonly website: string
  readonly heldUntil?: string | null
  readonly nameRef?: Ref<HTMLHeadingElement>
}) {
  const place = taskPlace(task)
  const held = heldUntilLabel(heldUntil)

  return (
    <div className="flex flex-col gap-2">
      <h3
        ref={nameRef}
        tabIndex={-1}
        data-drive-task-name=""
        className="m-0"
        style={{
          // A focus target for screen readers, not a control: no ring.
          outline: "none",
          fontFamily: T.font.serif,
          fontSize: "clamp(24px,2.6vw,30px)",
          fontWeight: 500,
          lineHeight: 1.12,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        {task.name}
      </h3>
      {held ? (
        <p className={DIM} style={{ color: T.ink.dim }}>
          {held}
        </p>
      ) : null}
      {place ? (
        <p className={DIM} style={{ color: T.ink.dim }}>
          {place}
        </p>
      ) : null}
      <a
        className={`${LINK} self-start`}
        href={website || webSearchHref(task)}
        rel="noopener noreferrer"
        style={{ color: T.accent.primary }}
        target="_blank"
      >
        {website ? "Open the library’s website" : "Search for this library"}
        <span className="sr-only"> (opens in a new tab)</span>
        <Icon
          aria-hidden="true"
          height={16}
          icon="mdi:open-in-new"
          width={16}
        />
      </a>
    </div>
  )
}

/** "Sign in to help", back to the drive's page. */
function SignInToHelp({ drivePath }: { readonly drivePath: string }) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-[16px] p-5"
      style={{ background: T.accent.chip }}
    >
      <p className={DIM} style={{ color: T.ink.base }}>
        Every change goes to a reviewer before it’s published.
      </p>
      <Link
        className={`${PRIMARY} h-11 bg-(--t-accent-primary) px-5 text-[15px] text-white no-underline hover:bg-(--t-accent-primary-hover)`}
        href={`/auth/signin?callbackUrl=${encodeURIComponent(drivePath)}`}
      >
        Sign in to help
      </Link>
    </div>
  )
}

/** "What are you adding?": one chip per gap, when a drive has several. */
function GapSwitcher({
  name,
  gaps,
  gap,
  onPick,
}: {
  readonly name: string
  readonly gaps: readonly PanelGap[]
  readonly gap: PanelGap | null
  readonly onPick: (gap: PanelGap) => void
}) {
  return (
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="mb-2 p-0 text-[15px] font-semibold">
        What are you adding?
      </legend>
      {gaps.map((g) => {
        const on = g === gap

        return (
          <label
            key={g}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-semibold outline-offset-2 outline-(--t-accent-primary) has-[:focus-visible]:outline-[3px]"
            style={{
              background: on ? T.accent.chip : T.bg.deep,
              borderColor: on ? T.accent.primary : T.border.hi,
              color: on ? T.accent.primaryHover : T.ink.base,
            }}
          >
            <input
              checked={on}
              className="sr-only"
              name={name}
              onChange={() => onPick(g)}
              type="radio"
              value={g}
            />
            <Icon
              aria-hidden="true"
              height={16}
              icon={FOCUS_META[g].icon}
              width={16}
            />
            {FOCUS_META[g].label}
          </label>
        )
      })}
    </fieldset>
  )
}

/** The photo share: upload, caption, credit and the licence. */
function PhotoFields({
  id,
  value,
  onChange,
}: {
  readonly id: string
  readonly value: PhotoState
  readonly onChange: (next: Partial<PhotoState>) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <PhotoUpload
        photo={value.photo}
        onChange={(photo) => onChange({ photo })}
      />
      <div>
        <Label htmlFor={`${id}-caption`} hint="Optional">
          What does it show?
        </Label>
        <input
          className={FIELD}
          id={`${id}-caption`}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="e.g. The main entrance from the high street"
          style={{ color: T.ink.base }}
          value={value.caption}
        />
      </div>
      <div>
        <Label
          htmlFor={`${id}-credit`}
          hint="Optional, as you’d like to be credited"
        >
          Photo credit
        </Label>
        <input
          className={FIELD}
          id={`${id}-credit`}
          onChange={(e) => onChange({ credit: e.target.value })}
          style={{ color: T.ink.base }}
          value={value.credit}
        />
      </div>
      <label
        className="flex cursor-pointer items-start gap-3 text-[15px]"
        style={{ color: T.ink.base }}
      >
        <input
          checked={value.licence}
          className="mt-0.5 size-5 shrink-0"
          onChange={(e) => onChange({ licence: e.target.checked })}
          style={{ accentColor: "var(--t-accent-primary)" }}
          type="checkbox"
        />
        <span>
          I took this photo, or have permission to share it, and I’m happy for
          it to be published under {PHOTO_LICENCE}.
        </span>
      </label>
    </div>
  )
}

/** The drive's rules refused it: say why, and offer it without the drive. */
function DriveRefusal({
  message,
  sending,
  onResend,
}: {
  readonly message: string
  readonly sending: boolean
  readonly onResend: () => void
}) {
  return (
    <div role="alert">
      <Notice icon="mdi:alert-circle-outline" tone="warn" title={message}>
        <p className="m-0" style={{ color: T.ink.base }}>
          You can still send it for review on its own. It just won’t count
          toward this drive.
        </p>
        <button
          type="button"
          className={`${SECONDARY} mt-2 h-10 self-start px-4 text-[15px]`}
          disabled={sending}
          onClick={onResend}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          Send without the drive
        </button>
      </Notice>
    </div>
  )
}

const ROW_ACTION =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border bg-white px-4 text-[15px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/** One checklist row's action: an editor toggle, a photo, or the Index editor. */
function LacksAction({
  gap,
  label,
  task,
  open,
  regionId,
  onToggle,
  onPhoto,
}: {
  readonly gap: GapKey
  readonly label: string
  readonly task: DriveTask
  readonly open: boolean
  readonly regionId: string
  readonly onToggle: () => void
  readonly onPhoto: () => void
}) {
  const style = { borderColor: T.border.hi, color: T.ink.base }

  if (RECORD_EDITORS[gap])
    return (
      <button
        type="button"
        aria-controls={open ? regionId : undefined}
        aria-expanded={open}
        aria-label={`Add ${label.toLowerCase()} for ${task.name}`}
        className={ROW_ACTION}
        onClick={onToggle}
        style={open ? { ...style, borderColor: T.accent.primary } : style}
      >
        <Icon
          aria-hidden="true"
          height={16}
          icon={open ? "mdi:chevron-up" : "mdi:plus"}
          width={16}
        />
        Add
      </button>
    )

  if (gap === "photo")
    return (
      <button
        type="button"
        className={ROW_ACTION}
        onClick={onPhoto}
        style={style}
      >
        <Icon
          aria-hidden="true"
          height={16}
          icon="mdi:camera-outline"
          width={16}
        />
        Share a photo
        <span className="sr-only"> of {task.name}</span>
      </button>
    )

  return (
    <Link
      className={ROW_ACTION}
      href={`/contribute/index/${task.slug}`}
      style={style}
    >
      Add in the Index editor
      <span className="sr-only">
        : {label.toLowerCase()} for {task.name}
      </span>
    </Link>
  )
}

/**
 * A whole-record task: "What this record lacks", one row per gap the index
 * names. Hours, the address, contact details and facilities open their
 * correction editor under the row; a photo switches the panel to the
 * photo share; the rest go to the Index editor.
 */
function RecordChecklist({
  id,
  task,
  gaps,
  opened,
  onToggle,
  onPhoto,
  editor,
}: {
  readonly id: string
  readonly task: DriveTask
  readonly gaps: readonly GapKey[]
  readonly opened: ReadonlySet<GapKey>
  readonly onToggle: (gap: GapKey) => void
  readonly onPhoto: () => void
  readonly editor: (category: string) => ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4
        className="m-0 text-[16px] font-semibold"
        style={{ color: T.ink.base }}
      >
        What this record lacks
      </h4>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {gaps.map((gap) => {
          const label = gapDefinition(gap).label
          const category = RECORD_EDITORS[gap]
          const open = Boolean(category) && opened.has(gap)
          const regionId = `${id}-lacks-${gap}`

          return (
            <li
              key={gap}
              className="flex flex-col gap-4 rounded-[16px] border p-4"
              style={{
                background: T.bg.deep,
                borderColor: open ? T.accent.primary : T.border.line,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className="text-[16px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {label}
                </span>
                <LacksAction
                  gap={gap}
                  label={label}
                  onPhoto={onPhoto}
                  onToggle={() => onToggle(gap)}
                  open={open}
                  regionId={regionId}
                  task={task}
                />
              </div>
              {open && category ? (
                <div id={regionId}>{editor(category)}</div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Send's reason for being off at the pending limit, and where to look. */
function QuotaFull({
  id,
  reason,
}: {
  readonly id: string
  readonly reason: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        id={id}
        className="m-0 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        {reason}
      </p>
      <Link
        className={`${LINK} self-start`}
        href="/contribute/submissions"
        style={{ color: T.accent.primary }}
      >
        See my submissions
      </Link>
    </div>
  )
}

/**
 * The task panel: one library from a drive's task list, with the existing
 * editor for the drive's Focus (hours, contact details, a photo, the
 * library page's accessibility questions, the "Still right?" fields for a
 * verify drive, or a whole-record drive's checklist of what the record
 * lacks), "Where did you find this?", Send and get the next one, Skip, and
 * "This library has closed or moved". What it sends is an ordinary
 * Submission tagged with the drive, reviewed like any other (ADR-0005).
 * When the drive's rules refuse it (422), the reader can send it without
 * the drive. Key it by the task, so each library starts clean.
 */
export function DriveTaskPanel({
  drive,
  task,
  signedIn,
  claimed,
  quota,
  heldUntil,
  onSent,
  onSkip,
  nameRef,
}: {
  readonly drive: Pick<Drive, "documentId" | "slug" | "focus">
  readonly task: DriveTask
  readonly signedIn: boolean
  /** The reader holds a Library Claim on it: record changes are edits. */
  readonly claimed: boolean
  readonly quota: PendingQuota | null
  /** When the reader's own hold on this library expires, if any. */
  readonly heldUntil?: string | null
  readonly onSent: (task: DriveTask) => void
  readonly onSkip: (task: DriveTask) => void
  /** The library's name: where focus goes when a new library opens. */
  readonly nameRef?: Ref<HTMLHeadingElement>
}) {
  const id = useId()
  const gaps = panelGapsOf(drive.focus)
  const focusMode = panelModeOf(drive.focus)
  const [current, setCurrent] = useState<PanelMode | null>(focusMode)
  const [closed, setClosed] = useState(false)
  const mode: PanelMode | null = closed ? "closed" : current
  const gap = isPanelGapMode(current) ? current : null
  const loaded = useRecord(task.slug, signedIn)
  const record = loaded?.record ?? null

  // A verify drive: the Focus's sections this record has, all ticked to
  // start with; "Where did you check?" is the panel's evidence.
  const [picked, setPicked] = useState<VerifySection[] | null>(null)
  const [inPerson, setInPerson] = useState(false)
  const verifyAvailable = record ? verifySectionsFor(drive.focus, record) : []
  const verifySections = picked ?? verifyAvailable

  // A whole-record drive: the gaps the index names, and the open editors.
  const recordGaps = recordGapsOf(task)
  const [opened, setOpened] = useState<ReadonlySet<GapKey>>(() => new Set())
  const openCategories = recordGaps.flatMap((g) => {
    const category = RECORD_EDITORS[g]

    return category && opened.has(g) ? [category] : []
  })

  const [edit, setEdit] = useState<RecordEdit>({})
  const [evidence, setEvidence] = useState("")
  const [photo, setPhoto] = useState<PhotoState>({
    photo: null,
    caption: "",
    credit: "",
    licence: false,
  })
  const [tried, setTried] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<{
    message: string
    body: Body
  } | null>(null)

  const drivePath = `/community/drives/${drive.slug}`
  const website = task.website || record?.website || ""
  const recordMode = isRecordMode(mode) ? mode : null
  const evidenceMode: EvidenceMode | null =
    recordMode ?? (mode === "record" ? "record" : null)
  let changes: RecordChanges | null = null
  if (record && recordMode) changes = panelChanges(recordMode, record, edit)
  else if (record && mode === "record")
    changes = categoryChanges(openCategories, record, edit)
  const verify: VerifyState = {
    sections: verifySections,
    source: evidence,
    inPerson,
  }
  const full = quotaReason(quota)
  const blocker = panelBlocker({
    mode,
    loaded,
    changes,
    evidence,
    categories: openCategories,
    verify,
    photo,
    name: task.name,
  })
  const showBlocker = tried && blocker !== null
  const evidenceInvalid =
    showBlocker &&
    evidenceMode !== null &&
    blocker === evidenceProblem(evidenceMode, evidence, openCategories)
  const evidenceNeeded =
    evidenceMode !== null && evidenceRequired(evidenceMode, openCategories)
  // The "Still right?" fields show their own problem, by its field.
  const verifyOn = mode === "verify" && verifyAvailable.length > 0
  const verifyIssue =
    verifyOn && showBlocker && !error && !refusal ? blocker : null
  const blockerId = `${id}-blocker`
  const fullId = `${id}-full`

  if (!signedIn)
    return (
      <div className="flex flex-col gap-5">
        <PanelHeader nameRef={nameRef} task={task} website={website} />
        <SignInToHelp drivePath={drivePath} />
      </div>
    )

  const submit = async (body: Body) => {
    setSending(true)
    setError(null)
    setRefusal(null)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSent(task)

        return
      }
      const json = await res.json().catch(() => ({}))
      const message =
        errorMessage(json) ?? "We couldn’t send that. Please try again."
      if (res.status === 422 && body.driveDocumentId)
        setRefusal({ message, body: withoutDrive(body) })
      else setError(message)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSending(false)
    }
  }

  const send = () => {
    setTried(true)
    if (blocker || full || sending) return
    const target = {
      documentId: task.documentId,
      slug: task.slug,
      name: task.name,
    }
    const tag = { driveDocumentId: drive.documentId, claimed }
    if (recordMode && record)
      void submit(
        recordPayload(recordMode, target, record, edit, evidence, tag)
      )
    else if (mode === "record" && record)
      void submit(
        recordTaskPayload(openCategories, target, record, edit, evidence, tag)
      )
    else if (mode === "verify")
      void submit(
        verifyPayload({
          slug: task.slug,
          name: task.name,
          sections: verifySections,
          source: evidence,
          inPerson,
          documentId: task.documentId,
          driveDocumentId: drive.documentId,
        })
      )
    else if (mode === "photo" && photo.photo)
      void submit(
        photoPayload(
          target,
          { photo: photo.photo, credit: photo.credit, caption: photo.caption },
          tag
        )
      )
  }

  const switchTo = (next: { mode?: PanelMode; closed: boolean }) => {
    if (next.mode) setCurrent(next.mode)
    setClosed(next.closed)
    setTried(false)
    setError(null)
    setRefusal(null)
  }

  const editorFor = (category: string) =>
    record ? (
      <CorrectionEditor
        category={category}
        changedKeys={Object.keys(changes?.changes ?? {})}
        current={record}
        edit={edit}
        onChange={setEdit}
        onNames={() => {}}
      />
    ) : null

  const toggleOpen = (g: GapKey) =>
    setOpened((now) => {
      const next = new Set(now)
      if (next.has(g)) next.delete(g)
      else next.add(g)

      return next
    })

  const needsRecord =
    recordMode !== null || mode === "accessibility" || mode === "verify"
  let editor: ReactNode
  if (needsRecord && !loaded)
    editor = (
      <p className={DIM} role="status" style={{ color: T.ink.dim }}>
        Loading the record…
      </p>
    )
  else if (needsRecord && !record)
    editor = (
      <p className={DIM} style={{ color: T.ink.dim }}>
        {NO_RECORD}
      </p>
    )
  else if (mode === "closed")
    editor = (
      <div className="flex flex-col gap-6">
        <p className={DIM} style={{ color: T.ink.dim }}>
          Set what’s true now. Change the status if it has closed, the address
          if it has moved, or both.
        </p>
        <div className="flex flex-col gap-3">
          <h4 className="m-0 text-[16px] font-semibold">Is it still open?</h4>
          {editorFor(MODE_CATEGORIES.closed[0]!)}
        </div>
        <div className="flex flex-col gap-3">
          <h4 className="m-0 text-[16px] font-semibold">Where is it now?</h4>
          {editorFor(MODE_CATEGORIES.closed[1]!)}
        </div>
      </div>
    )
  else if (recordMode) editor = editorFor(MODE_CATEGORIES[recordMode][0]!)
  else if (mode === "verify" && record && !verifyOn) {
    const asked = drive.focus.kind === "verify" ? drive.focus.sections : []
    const labels = asked.map((s) => SECTION_LABELS[s].toLowerCase())
    editor = (
      <Notice
        icon="mdi:information-outline"
        tone="info"
        title={`Nothing to confirm here yet: this library has no ${joinOr(labels)} on record.`}
      />
    )
  } else if (mode === "verify" && record)
    editor = (
      <div className="flex flex-col gap-6">
        <p className={DIM} style={{ color: T.ink.dim }}>
          Confirm what you’ve checked. A Moderator reviews it, then it shows as
          checked today.
        </p>
        <VerifyFields
          available={verifyAvailable}
          idPrefix={`${id}-verify`}
          inPerson={inPerson}
          onInPerson={setInPerson}
          onSections={setPicked}
          onSource={setEvidence}
          problem={verifyIssue}
          problemField={verifyIssue ? verifyProblemField(verify) : null}
          record={record}
          sections={verifySections}
          source={evidence}
        />
      </div>
    )
  else if (mode === "record" && recordGaps.length > 0)
    editor = (
      <RecordChecklist
        editor={(category) =>
          record ? (
            editorFor(category)
          ) : (
            <p className={DIM} style={{ color: T.ink.dim }}>
              {loaded ? NO_RECORD : "Loading the record…"}
            </p>
          )
        }
        gaps={recordGaps}
        id={id}
        onPhoto={() => switchTo({ mode: "photo", closed: false })}
        onToggle={toggleOpen}
        opened={opened}
        task={task}
      />
    )
  else if (mode === "photo")
    editor = (
      <div className="flex flex-col gap-5">
        {focusMode === "record" ? (
          <button
            type="button"
            className={`${LINK} self-start`}
            onClick={() => switchTo({ mode: "record", closed: false })}
            style={{ color: T.accent.primary }}
          >
            <Icon
              aria-hidden="true"
              height={16}
              icon="mdi:arrow-left"
              width={16}
            />
            Back to the checklist
          </button>
        ) : null}
        <PhotoFields
          id={id}
          onChange={(next) => setPhoto((p) => ({ ...p, ...next }))}
          value={photo}
        />
      </div>
    )
  else if (mode === "accessibility" && record)
    editor = (
      <div className="flex flex-col gap-3">
        <p className={DIM} style={{ color: T.ink.dim }}>
          Tap Yes or No for what you can confirm, then send your answers.
        </p>
        <LibraryFacilityAnswers
          driveDocumentId={drive.documentId}
          libraryDocumentId={task.documentId}
          libraryName={task.name}
          libraryPath={task.href ?? drivePath}
          librarySlug={task.slug}
          onSent={() => onSent(task)}
          rows={facilityRows(record)}
        />
      </div>
    )
  else
    editor = (
      <p className={DIM} style={{ color: T.ink.dim }}>
        This drive’s tasks are done in the Index editor.{" "}
        <Link
          className="font-semibold underline underline-offset-[3px]"
          href={`/contribute/index/${task.slug}`}
          style={{ color: T.accent.primary }}
        >
          Improve this record
        </Link>
      </p>
    )

  const sendable =
    recordMode !== null ||
    mode === "photo" ||
    (mode === "verify" && !(record && !verifyOn)) ||
    (mode === "record" && recordGaps.some((g) => RECORD_EDITORS[g]))
  const backLabel = backLabelOf(current)
  const showEvidence =
    record !== null &&
    (recordMode !== null || (mode === "record" && openCategories.length > 0))
  const evidenceHint = evidenceHintOf(recordMode, evidenceNeeded)

  return (
    <div className="flex flex-col gap-5">
      <PanelHeader
        heldUntil={heldUntil}
        nameRef={nameRef}
        task={task}
        website={website}
      />

      {gaps.length > 1 && !closed ? (
        <GapSwitcher
          gap={gap}
          gaps={gaps}
          name={`${id}-gap`}
          onPick={(g) => switchTo({ mode: g, closed: false })}
        />
      ) : null}

      {full ? <QuotaFull id={fullId} reason={full} /> : null}

      {editor}

      {showEvidence ? (
        <div>
          <Label htmlFor={`${id}-evidence`} hint={evidenceHint}>
            Where did you find this?
          </Label>
          <input
            aria-describedby={evidenceInvalid ? blockerId : undefined}
            aria-invalid={evidenceInvalid || undefined}
            aria-required={evidenceNeeded || undefined}
            className={FIELD}
            id={`${id}-evidence`}
            inputMode="url"
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={
              evidenceNeeded ? "https://" : "A link, or where you saw it"
            }
            style={{ color: T.ink.base }}
            type={evidenceNeeded ? "url" : "text"}
            value={evidence}
          />
        </div>
      ) : null}

      {refusal ? (
        <DriveRefusal
          message={refusal.message}
          onResend={() => void submit(refusal.body)}
          sending={sending}
        />
      ) : null}
      {error ? (
        <p
          className="m-0 text-[15px] font-semibold"
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
      {showBlocker && !error && !refusal && !verifyOn ? (
        <p
          id={blockerId}
          className="m-0 text-[15px] font-semibold"
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {blocker}
        </p>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-3 border-t pt-5"
        style={{ borderColor: T.border.divider }}
      >
        {sendable ? (
          <button
            type="button"
            aria-describedby={full ? fullId : undefined}
            disabled={Boolean(full) || sending}
            className={`${PRIMARY} ${
              full || sending
                ? "cursor-not-allowed"
                : "bg-(--t-accent-primary) text-white hover:bg-(--t-accent-primary-hover)"
            }`}
            onClick={send}
            style={
              full || sending
                ? { background: T.bg.muted2, color: T.ink.dim }
                : undefined
            }
          >
            {sending ? "Sending…" : "Send and get the next one"}
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY}
          onClick={() => onSkip(task)}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          Skip
        </button>
        <button
          type="button"
          className={LINK}
          onClick={() => switchTo({ closed: !closed })}
          style={{ color: T.accent.primary }}
        >
          {closed ? backLabel : "This library has closed or moved"}
        </button>
      </div>
    </div>
  )
}
