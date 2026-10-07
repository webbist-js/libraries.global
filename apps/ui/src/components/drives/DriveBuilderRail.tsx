"use client"

import { DRIVE_PROPOSAL_MIN_ACCEPTED } from "@repo/access"
import { DRIVE_MAX_TASKS } from "@repo/shared-data"
import type { ReactNode } from "react"

import { Badge, Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"
import { Link } from "@/lib/navigation"

import {
  cardStyle,
  linkClass,
  linkStyle,
  railCard,
  railTitleClass,
} from "./builder-ui"
import type { FocusKind } from "./builder.logic"
import { DriveCard } from "./DriveCard"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** A drive with fewer than this many to do gets the "small drive" note. */
export const SMALL_DRIVE = 20

/** What the propose page knows about the user before they send. */
export type ProposalStanding = {
  /** Accepted changes, Role Applications not counted. */
  accepted: number
  /** Their proposal waiting on a Moderator, if any ("" when untitled). */
  open: { title: string } | null
}

/** One place's share of the live counts. */
export type PreviewPlaceCount = {
  level: string
  slug: string
  name: string
  total: number
  todo: number | null
}

/** The live counts as the side column reads them. */
export type ScopeCounts =
  | { status: "none" }
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready"
      total: number
      /** Null while no gap is chosen: the scope is counted, not the work. */
      todo: number | null
      places: readonly PreviewPlaceCount[]
    }

/** The second number's words, by Focus. */
const TODO_LABEL: Record<FocusKind, string> = {
  gaps: "missing a chosen gap",
  verify: "to check",
  record: "below the target",
}

/** Why nothing is left to do in scope, by Focus. */
const NOTHING_TO_DO: Record<FocusKind, string> = {
  gaps: "Nothing to do here yet: every library in scope already has this.",
  verify:
    "Nothing to do here yet: every library in scope has been confirmed since then.",
  record:
    "Nothing to do here yet: every library in scope is already this complete.",
}

/** What the counts wait for, by Focus. */
const COUNTS_PROMPT: Record<FocusKind, string> = {
  gaps: "Add a place (or a list) to see how many libraries it covers.",
  verify:
    "Choose a section, a date and a place (or a list) to see how many libraries it covers.",
  record:
    "Choose a target and a place (or a list) to see how many libraries it covers.",
}

/**
 * "On the noticeboard · Live preview": the real Noticeboard card, drawn
 * from the form as it stands.
 */
export function PreviewCard({ view }: { readonly view: DriveView }) {
  return (
    <section
      aria-labelledby="drive-preview-heading"
      className="flex flex-col gap-3 rounded-[24px] p-3 sm:p-4"
      style={{
        background: T.bg.space,
        border: `1px solid ${T.border.line}`,
      }}
    >
      <div className="flex items-baseline justify-between gap-3 px-1 pt-1">
        <h2
          id="drive-preview-heading"
          className="m-0 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          On the noticeboard
        </h2>
        <span className="text-[13px]" style={{ color: T.ink.dim }}>
          Live preview
        </span>
      </div>
      <DriveCard view={view} preview />
    </section>
  )
}

/** A big serif number and its words; "…" while counting. */
function BigNumber({
  value,
  label,
  accent,
}: {
  readonly value: number | null
  readonly label: string
  readonly accent?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: 40,
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color:
            value == null
              ? T.ink.faint
              : accent
                ? T.accent.primary
                : T.ink.base,
        }}
      >
        {value == null ? "…" : fmt(value)}
      </span>
      <span className="text-[14px]" style={{ color: T.ink.dim }}>
        {label}
      </span>
    </div>
  )
}

/** The note under the numbers: too small, too big, or nothing to do. */
function ScopeNotice({
  total,
  todo,
  focusKind,
}: {
  readonly total: number
  readonly todo: number
  readonly focusKind: FocusKind
}) {
  if (total === 0) {
    return (
      <Notice
        icon="mdi:information-outline"
        tone="info"
        title="No libraries in scope. Try a wider place or fewer filters."
      />
    )
  }
  if (todo === 0) {
    return (
      <Notice
        icon="mdi:information-outline"
        tone="info"
        title={NOTHING_TO_DO[focusKind]}
      />
    )
  }
  if (todo > DRIVE_MAX_TASKS) {
    return (
      <Notice
        icon="mdi:alert-outline"
        tone="warn"
        title={`That’s over ${fmt(DRIVE_MAX_TASKS)} tasks. Narrow the scope so it can open.`}
      />
    )
  }
  if (todo < SMALL_DRIVE) {
    return (
      <Notice
        icon="mdi:alert-outline"
        tone="warn"
        title={`Only ${fmt(todo)} to do. Small drives finish fast, but think about adding nearby areas.`}
      />
    )
  }

  return null
}

/**
 * "Scope right now": libraries in scope and how many need the work, a
 * bar between them, a note when the drive would be too small, too big or
 * empty, and each place's own numbers. Live, from `/api/drives/preview`.
 */
export function ScopeCard({
  counts,
  focusKind,
  locked,
}: {
  readonly counts: ScopeCounts
  readonly focusKind: FocusKind
  readonly locked: boolean
}) {
  let body: ReactNode
  if (locked) {
    body = (
      <p className="m-0">
        The scope is fixed once a drive opens, so it isn’t counted here.
      </p>
    )
  } else if (counts.status === "none") {
    body = <p className="m-0">{COUNTS_PROMPT[focusKind]}</p>
  } else if (counts.status === "error") {
    body = <p className="m-0">Counts unavailable right now.</p>
  } else {
    const ready = counts.status === "ready" ? counts : null
    const total = ready?.total ?? null
    const todo = ready?.todo ?? null
    const percent =
      total && todo != null ? Math.min(100, (todo / total) * 100) : 0

    body = (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <BigNumber value={total} label="libraries in scope" />
          {ready && todo == null ? (
            <p className="m-0 self-end text-[14px]">
              Choose a gap to see how many miss it.
            </p>
          ) : (
            <BigNumber value={todo} label={TODO_LABEL[focusKind]} accent />
          )}
        </div>
        <span
          aria-hidden="true"
          className="block h-1.5 overflow-hidden rounded-full"
          style={{ background: T.border.divider }}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: `${percent}%`,
              minWidth: percent > 0 ? 6 : 0,
              background: T.accent.primary,
            }}
          />
        </span>
        {ready && todo != null ? (
          <ScopeNotice total={ready.total} todo={todo} focusKind={focusKind} />
        ) : null}
        {ready && ready.places.length > 0 ? (
          <ul
            aria-label="By place"
            className="m-0 flex list-none flex-col p-0 text-[14px]"
          >
            {ready.places.map((p) => (
              <li
                key={`${p.level}:${p.slug}`}
                className="flex items-baseline justify-between gap-3 py-2"
                style={{ borderTop: `1px solid ${T.border.divider}` }}
              >
                <span style={{ color: T.ink.base }}>{p.name}</span>
                <span className="text-right" style={{ color: T.ink.dim }}>
                  {p.todo == null
                    ? `${fmt(p.total)} in scope`
                    : `${fmt(p.todo)} of ${fmt(p.total)} to do`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <section
      aria-labelledby="drive-counts-heading"
      className={railCard}
      style={cardStyle}
    >
      <h2
        id="drive-counts-heading"
        className={railTitleClass}
        style={{ color: T.ink.base }}
      >
        Scope right now
      </h2>
      <div
        aria-live="polite"
        aria-busy={counts.status === "loading"}
        className="mt-3 text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        {body}
      </div>
    </section>
  )
}

/**
 * "Who can propose": accepted changes against the minimum, and the
 * proposal still in review, if any. Strapi decides on send; this only
 * explains.
 */
export function StandingCard({
  standing,
}: {
  readonly standing: ProposalStanding
}) {
  const { accepted, open } = standing
  const needed = DRIVE_PROPOSAL_MIN_ACCEPTED
  const eligible = accepted >= needed
  const shown = Math.min(accepted, needed)

  return (
    <section
      aria-labelledby="drive-standing"
      className={railCard}
      style={cardStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="drive-standing"
          className={railTitleClass}
          style={{ color: T.ink.base }}
        >
          Who can propose
        </h2>
        {eligible ? (
          <Badge label="You can" color="ok" icon="mdi:check" />
        ) : (
          <Badge label="Not yet" color="dim" icon="mdi:progress-clock" />
        )}
      </div>
      <p
        className="mt-2 mb-0 text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        Anyone with {needed} accepted changes. You have{" "}
        <strong style={{ color: T.ink.base }}>{fmt(accepted)}</strong>.
      </p>
      {eligible ? null : (
        <>
          <div
            role="progressbar"
            aria-label="Accepted changes"
            aria-valuemin={0}
            aria-valuemax={needed}
            aria-valuenow={shown}
            aria-valuetext={`${accepted} of ${needed} accepted changes`}
            className="mt-4 h-2 w-full rounded-full"
            style={{ background: T.bg.muted2 }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(shown / needed) * 100}%`,
                background: T.accent.primary,
              }}
            />
          </div>
          <p className="mt-4 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
            Corrections, new libraries and photos all count.{" "}
            <Link href="/contribute" className={linkClass} style={linkStyle}>
              Improve a record
            </Link>
          </p>
        </>
      )}
      {open ? (
        <div
          className="mt-4 flex flex-col gap-2 rounded-[16px] p-4"
          style={{
            border: `1px solid ${T.border.line}`,
            background: T.bg.surface,
          }}
        >
          <p
            className="m-0 text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {open.title
              ? `Your proposal “${open.title}” is waiting for review.`
              : "Your proposal is waiting for review."}
          </p>
          <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
            You can propose another once it’s decided. Follow it in{" "}
            <Link
              href="/contribute/submissions"
              className={linkClass}
              style={linkStyle}
            >
              My submissions
            </Link>
            .
          </p>
        </div>
      ) : null}
    </section>
  )
}

/** The board's card in place of "Who can propose": no review, and where it's run. */
export function BoardCard({ editing }: { readonly editing: boolean }) {
  return (
    <section
      aria-labelledby="drive-board"
      className={railCard}
      style={cardStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="drive-board"
          className={railTitleClass}
          style={{ color: T.ink.base }}
        >
          Editorial board
        </h2>
        <Badge label="No review needed" color="ok" icon="mdi:check" />
      </div>
      <p
        className="mt-2 mb-0 text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        {editing
          ? "You’re on the editorial board, so your changes are saved directly. Pin it or feature it from its page."
          : "You’re on the editorial board, so this drive is created directly and scheduled. Open it, pin it or feature it from its page."}
      </p>
    </section>
  )
}
