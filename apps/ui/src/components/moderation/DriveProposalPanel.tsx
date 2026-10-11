"use client"

import {
  DRIVE_PLACE_LEVELS,
  type DrivePlaceLevel,
  type DriveScope,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { DriveTitle } from "@/components/drives/DriveTitle"
import {
  FOCUS_FILTER_META,
  FOCUS_META,
  focusSummary,
  type PanelGap,
} from "@/components/drives/focus-meta"
import { Badge, Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { driveHref, plainDriveTitle } from "@/lib/drives/drive-view"
import { nameFromSlug } from "@/lib/find-places"
import { Link, useRouter } from "@/lib/navigation"

import {
  decisionErrorMessage,
  type DriveProposalReview,
  formatDate,
  type RoleApplicant,
} from "./submissionMeta"

const OPEN = new Set(["pending", "needs_info"])
const PANEL_GAP_SET: readonly string[] = Object.keys(FOCUS_META)
const isPanelGap = (g: string): g is PanelGap => PANEL_GAP_SET.includes(g)

const PLACE_LEVEL_LABELS: Record<DrivePlaceLevel, string> = {
  continent: "Continent",
  country: "Country",
  region: "Region",
  area: "Area",
}

const heading = "m-0 text-[15px] font-semibold"

/** "yyyy-MM-dd" for a date input's value, from an ISO stamp. */
function toDayValue(iso: string): string {
  const d = new Date(iso)

  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10)
}

/** Where a Drive's scope runs: one line per place level present, or the
 * size of an explicit library list, which replaces places entirely. */
function whereLines(scope: DriveScope): string[] {
  const libraries = scope.libraries?.length ?? 0
  if (libraries > 0) {
    return [`${libraries} chosen ${libraries === 1 ? "library" : "libraries"}`]
  }

  return DRIVE_PLACE_LEVELS.flatMap((level) => {
    const slugs = scope.places?.[level] ?? []

    return slugs.length > 0
      ? [`${PLACE_LEVEL_LABELS[level]}: ${slugs.map(nameFromSlug).join(", ")}`]
      : []
  })
}

/** "Types: …", "Records from …", "Below n% complete" — each only when set. */
function scopeDetailLines(scope: DriveScope): string[] {
  const lines: string[] = []
  const types = scope.libraryTypes ?? []
  if (types.length > 0) {
    lines.push(`Types: ${types.join(", ")}`)
  }
  if (scope.source) lines.push(`Records from ${scope.source}`)
  if (scope.completenessBelow != null) {
    lines.push(`Below ${Math.trunc(scope.completenessBelow)}% complete`)
  }

  return lines
}

/**
 * The applicant block, as `RoleApplicationPanel` renders it for a Role
 * Application: a link to their profile, their accepted count, and their
 * latest accepted changes.
 */
function ProposerBlock({
  applicant,
}: {
  readonly applicant: RoleApplicant | null
}) {
  const tUi = useUiTranslations("ui")

  if (!applicant) {
    return (
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        Proposer details aren’t available.
      </p>
    )
  }

  return (
    <>
      <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
        {applicant.username ? (
          <Link
            href={`/profile/${encodeURIComponent(applicant.username)}`}
            className="font-semibold underline underline-offset-2"
            style={{ color: T.accent.primary }}
          >
            @{applicant.username}
          </Link>
        ) : (
          <span style={{ color: T.ink.dim }}>No public profile</span>
        )}
        <span style={{ color: T.ink.dim }}>
          {" "}
          · {applicant.acceptedCount} accepted{" "}
          {applicant.acceptedCount === 1 ? "change" : "changes"}
        </span>
      </p>
      {applicant.recentAccepted.length > 0 ? (
        <ul
          aria-label={tUi("recent_accepted_changes")}
          className="m-0 list-none overflow-hidden rounded-[14px] p-0"
          style={{
            border: `1px solid ${T.border.line}`,
            background: T.bg.surface,
          }}
        >
          {applicant.recentAccepted.map((c, i) => (
            <li
              key={`${c.decidedAt}-${i}`}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[14px]"
              style={
                i > 0
                  ? { borderTop: `1px solid ${T.border.divider}` }
                  : undefined
              }
            >
              <span
                className="min-w-0 flex-1 truncate"
                style={{ color: T.ink.base }}
              >
                <span className="font-semibold">{c.type}</span>
                <span style={{ color: T.ink.dim }}> · {c.summary}</span>
              </span>
              <span
                className="shrink-0 text-[13px]"
                style={{ color: T.ink.dim }}
              >
                {formatDate(c.decidedAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          No accepted changes listed.
        </p>
      )}
    </>
  )
}

/**
 * Change dates: Opens/Ends date inputs, prefilled from the drive. Only
 * shown while the proposal is still open. Saving re-pins the payload hash
 * on the submission (`setModeratorEdit`) and the review refreshes with it.
 */
function ChangeDatesForm({
  documentId,
  startsAt,
  endsAt,
}: {
  readonly documentId: string
  readonly startsAt: string
  readonly endsAt: string
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const opensId = useId()
  const endsId = useId()
  const [opens, setOpens] = useState(toDayValue(startsAt))
  const [ends, setEnds] = useState(toDayValue(endsAt))
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true)
    setErrors(null)
    setSaved(false)
    try {
      const res = await fetch(
        `/api/moderation/submissions/${encodeURIComponent(documentId)}/drive-dates`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startsAt: `${opens}T00:00:00.000Z`,
            endsAt: `${ends}T23:59:59.000Z`,
          }),
        }
      )
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const details =
          body &&
          typeof body === "object" &&
          (body as { error?: { details?: { errors?: unknown } } }).error
            ?.details?.errors
        setErrors(
          Array.isArray(details) && details.length > 0
            ? details.map(String)
            : [decisionErrorMessage(res.status, body)]
        )

        return
      }
      setSaved(true)
      router.refresh()
    } catch {
      setErrors(["Something went wrong. Check your connection and try again."])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={opensId}
            className="text-[14px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {tUi("opens")}
          </label>
          <input
            id={opensId}
            type="date"
            value={opens}
            onChange={(e) => setOpens(e.target.value)}
            className="rounded-[10px] border px-3 py-2 text-[14px]"
            style={{
              borderColor: T.border.hi,
              background: T.bg.deep,
              color: T.ink.base,
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor={endsId}
            className="text-[14px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {tUi("ends")}
          </label>
          <input
            id={endsId}
            type="date"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            className="rounded-[10px] border px-3 py-2 text-[14px]"
            style={{
              borderColor: T.border.hi,
              background: T.bg.deep,
              color: T.ink.base,
            }}
          />
        </div>
        <button
          type="button"
          disabled={busy || !opens || !ends}
          onClick={() => void save()}
          className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          {busy ? tUi("saving") : "Save dates"}
        </button>
      </div>
      {errors ? (
        <ul
          role="alert"
          className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]"
          style={{ color: T.accent.danger }}
        >
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      ) : null}
      <p
        aria-live="polite"
        className="m-0 text-[14px]"
        style={{ color: T.accent.ok }}
      >
        {saved ? "Dates saved" : ""}
      </p>
    </div>
  )
}

/**
 * The review panel for a Drive Proposal: the drive it would create, how
 * big it is counted now, its problems as it stands, a Moderator's date
 * change, and, once approved, the drive it created.
 */
export function DriveProposalPanel({
  documentId,
  status,
  proposal,
  applicant,
}: {
  readonly documentId: string
  readonly status: string
  readonly proposal: DriveProposalReview | null
  readonly applicant: RoleApplicant | null
}) {
  const tUi = useUiTranslations("ui")

  if (!proposal) {
    return (
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        This proposal’s drive could not be read.
      </p>
    )
  }

  const { drive, datesEdited, counts, errors, created } = proposal
  const gaps =
    drive.focus.kind === "gaps"
      ? (drive.focus.gaps ?? []).filter(isPanelGap)
      : []
  const kindLook =
    drive.focus.kind === "gaps" ? null : FOCUS_FILTER_META[drive.focus.kind]
  const whereList = whereLines(drive.scope)
  const detailLines = scopeDetailLines(drive.scope)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3
          className="m-0 text-[18px]"
          style={{ fontFamily: T.font.serif, color: T.ink.base }}
        >
          <DriveTitle title={drive.title} />
        </h3>
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.base }}
        >
          {drive.summary}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {gaps.map((g) => (
            <Badge
              key={g}
              label={FOCUS_META[g].label}
              color="aurora"
              icon={FOCUS_META[g].icon}
            />
          ))}
          {kindLook ? (
            <Badge label={kindLook.label} color="aurora" icon={kindLook.icon} />
          ) : null}
          <span className="text-[13px]" style={{ color: T.ink.dim }}>
            Per {drive.unit}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={heading} style={{ color: T.ink.base }}>
          {tUi("focus")}
        </h3>
        <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
          {focusSummary(drive.focus)}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={heading} style={{ color: T.ink.base }}>
          Where
        </h3>
        <ul
          className="m-0 flex list-none flex-col gap-1 p-0 text-[15px]"
          style={{ color: T.ink.base }}
        >
          {[...whereList, ...detailLines].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={heading} style={{ color: T.ink.base }}>
          Counts
        </h3>
        {counts === null ? (
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            Counts are unavailable right now.
          </p>
        ) : (
          <>
            <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
              {`${counts.total} in scope, ${counts.todo} to do`}
            </p>
            {counts.todo > 2000 ? (
              <Notice
                tone="warn"
                icon="mdi:alert-outline"
                title="Too big to finish: over 2,000 to do. Ask for a split by region, or reject it."
              />
            ) : null}
            {counts.todo === 0 ? (
              <Notice
                tone="warn"
                icon="mdi:alert-outline"
                title={tUi("nothing_to_do_in_this_scope_right_now")}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={heading} style={{ color: T.ink.base }}>
          Dates
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
            {`Opens ${formatDate(drive.startsAt)} · Ends ${formatDate(drive.endsAt)}`}
          </p>
          {datesEdited ? (
            <Badge
              label="Changed by a Moderator"
              color="gold"
              icon="mdi:pencil-outline"
            />
          ) : null}
        </div>
        {drive.goalPercent !== 100 ? (
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            {`Goal ${drive.goalPercent}%`}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={heading} style={{ color: T.ink.base }}>
          How to help
        </h3>
        <ol
          className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px]"
          style={{ color: T.ink.base }}
        >
          {drive.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className={heading} style={{ color: T.ink.base }}>
          {tUi("where_to_look")}
        </h3>
        <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
          {drive.whereToLook.name}
        </p>
        {drive.whereToLook.url ? (
          <a
            href={drive.whereToLook.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${drive.whereToLook.name} (opens in a new tab)`}
            className="text-[14px] underline underline-offset-2"
            style={{ color: T.accent.primary, wordBreak: "break-all" }}
          >
            {drive.whereToLook.url}
          </a>
        ) : null}
        {drive.whereToLook.licenceNote ? (
          <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
            {drive.whereToLook.licenceNote}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className={heading} style={{ color: T.ink.base }}>
          Proposed by
        </h3>
        <ProposerBlock applicant={applicant} />
      </div>

      {errors.length > 0 ? (
        <Notice
          tone="warn"
          icon="mdi:alert-circle-outline"
          title={tUi("this_drive_isnt_valid_as_it_stands")}
        >
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {OPEN.has(status) ? (
        <div className="flex flex-col gap-2">
          <h3 className={heading} style={{ color: T.ink.base }}>
            Change dates
          </h3>
          <ChangeDatesForm
            documentId={documentId}
            startsAt={drive.startsAt}
            endsAt={drive.endsAt}
          />
        </div>
      ) : null}

      {created ? (
        <Notice
          tone="ok"
          icon="mdi:check-circle-outline"
          title={`Scheduled as a drive: ${plainDriveTitle(created.title)}`}
        >
          <p className="m-0 text-[14px]">
            <Link
              href={driveHref(created.slug)}
              className="font-semibold underline underline-offset-2"
              style={{ color: T.accent.primary }}
            >
              Open the drive →
            </Link>
          </p>
          <p className="m-0 text-[14px]">
            The editorial board pins and features drives.
          </p>
        </Notice>
      ) : null}
    </div>
  )
}
