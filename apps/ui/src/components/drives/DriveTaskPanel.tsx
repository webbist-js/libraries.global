"use client"

import { Icon } from "@iconify/react"
import { findUnsafeContent } from "@repo/shared-data"
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
import { T } from "@/lib/design-tokens"
import type { Drive, DriveTask } from "@/lib/drives/types"
import { Link } from "@/lib/navigation"

import { FOCUS_META } from "./focus-meta"
import {
  evidenceProblem,
  evidenceRequired,
  MODE_CATEGORIES,
  type PanelGap,
  panelChanges,
  panelGapsOf,
  type PanelMode,
  type PendingQuota,
  photoPayload,
  quotaReason,
  type RecordMode,
  recordPayload,
  taskPlace,
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

/**
 * Why Send can't go yet, or null: the record (loaded, changed, and with
 * its source for hours and contact), the photo and its licence, then the
 * content-safety check over what the reader wrote.
 */
function panelBlocker({
  mode,
  loaded,
  changes,
  evidence,
  photo,
  name,
}: {
  mode: PanelMode | null
  loaded: Loaded
  changes: RecordChanges | null
  evidence: string
  photo: PhotoState
  name: string
}): string | null {
  if (isRecordMode(mode)) {
    if (!loaded) return "Loading the record…"
    if (!loaded.record) return NO_RECORD
    if (!changes || !hasRecordChange(changes))
      return "Change something to continue."
    const issue = evidenceProblem(mode, evidence)
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

/** The library's name (the focus target), its place, and its website. */
function PanelHeader({
  task,
  website,
  nameRef,
}: {
  readonly task: DriveTask
  readonly website: string
  readonly nameRef?: Ref<HTMLHeadingElement>
}) {
  const place = taskPlace(task)

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
 * editor for the drive's Focus (hours, contact details, a photo, or the
 * library page's accessibility questions), "Where did you find this?",
 * Send and get the next one, Skip, and "This library has closed or moved".
 * What it sends is an ordinary Submission tagged with the drive, reviewed
 * like any other (ADR-0005). When the drive's rules refuse it (422), the
 * reader can send it without the drive. Key it by the task, so each
 * library starts clean.
 */
export function DriveTaskPanel({
  drive,
  task,
  signedIn,
  claimed,
  quota,
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
  readonly onSent: (task: DriveTask) => void
  readonly onSkip: (task: DriveTask) => void
  /** The library's name: where focus goes when a new library opens. */
  readonly nameRef?: Ref<HTMLHeadingElement>
}) {
  const id = useId()
  const gaps = panelGapsOf(drive.focus)
  const [gap, setGap] = useState<PanelGap | null>(gaps[0] ?? null)
  const [closed, setClosed] = useState(false)
  const mode: PanelMode | null = closed ? "closed" : gap
  const loaded = useRecord(task.slug, signedIn)
  const record = loaded?.record ?? null

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
  const changes =
    recordMode && record ? panelChanges(recordMode, record, edit) : null
  const full = quotaReason(quota)
  const blocker = panelBlocker({
    mode,
    loaded,
    changes,
    evidence,
    photo,
    name: task.name,
  })
  const showBlocker = tried && blocker !== null
  const evidenceInvalid =
    showBlocker &&
    recordMode !== null &&
    blocker === evidenceProblem(recordMode, evidence)
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
    else if (mode === "photo" && photo.photo)
      void submit(
        photoPayload(
          target,
          { photo: photo.photo, credit: photo.credit, caption: photo.caption },
          tag
        )
      )
  }

  const switchTo = (next: { gap?: PanelGap; closed: boolean }) => {
    if (next.gap) setGap(next.gap)
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

  const needsRecord = recordMode !== null || mode === "accessibility"
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
  else if (mode === "photo")
    editor = (
      <PhotoFields
        id={id}
        onChange={(next) => setPhoto((p) => ({ ...p, ...next }))}
        value={photo}
      />
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

  const sendable = recordMode !== null || mode === "photo"
  const backLabel = gap
    ? `Back to ${FOCUS_META[gap].label.toLowerCase()}`
    : "Back"

  return (
    <div className="flex flex-col gap-5">
      <PanelHeader nameRef={nameRef} task={task} website={website} />

      {gaps.length > 1 && !closed ? (
        <GapSwitcher
          gap={gap}
          gaps={gaps}
          name={`${id}-gap`}
          onPick={(g) => switchTo({ gap: g, closed: false })}
        />
      ) : null}

      {full ? <QuotaFull id={fullId} reason={full} /> : null}

      {editor}

      {recordMode && record ? (
        <div>
          <Label htmlFor={`${id}-evidence`} hint={EVIDENCE_HINTS[recordMode]}>
            Where did you find this?
          </Label>
          <input
            aria-describedby={evidenceInvalid ? blockerId : undefined}
            aria-invalid={evidenceInvalid || undefined}
            aria-required={evidenceRequired(recordMode) || undefined}
            className={FIELD}
            id={`${id}-evidence`}
            inputMode="url"
            onChange={(e) => setEvidence(e.target.value)}
            placeholder={
              evidenceRequired(recordMode)
                ? "https://"
                : "A link, or where you saw it"
            }
            style={{ color: T.ink.base }}
            type={evidenceRequired(recordMode) ? "url" : "text"}
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
      {showBlocker && !error && !refusal ? (
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
