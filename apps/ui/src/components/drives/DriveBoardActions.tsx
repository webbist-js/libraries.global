"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import type { Drive } from "@/lib/drives/types"
import { Link, useRouter } from "@/lib/navigation"

type BoardAction =
  | "pin"
  | "unpin"
  | "feature"
  | "unfeature"
  | "open"
  | "close"
  | "cancel"

/** What the page says once an action has gone through. */
const DONE: Record<BoardAction, string> = {
  pin: "Pinned to the Noticeboard.",
  unpin: "Unpinned.",
  feature: "Featured on the Noticeboard.",
  unfeature: "No longer featured.",
  open: "The drive is open.",
  close: "The drive is closed.",
  cancel: "The drive is cancelled.",
}

/** The final actions, each asked about before it's sent. */
const CONFIRM: Record<
  "close" | "cancel",
  { question: string; yes: string; no: string }
> = {
  close: {
    question:
      "Close this drive now? It stops taking tasks and keeps its final numbers. It can’t be reopened.",
    yes: "Yes, close it",
    no: "Keep it open",
  },
  cancel: {
    question:
      "Cancel this drive? It comes off the Noticeboard and its page stops being indexed. Anything already sent is still reviewed.",
    yes: "Yes, cancel it",
    no: "Don’t cancel",
  },
}

const PILL =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-4 text-[15px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary) disabled:cursor-not-allowed disabled:opacity-60"
const PRIMARY =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-(--t-accent-primary) px-4 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"

/** Strapi's refusal, or a fallback. */
async function messageOf(res: Response): Promise<string> {
  const fallback = "That didn’t work. Try again in a moment."
  try {
    const json = (await res.json()) as {
      error?: string | { message?: string; details?: { errors?: string[] } }
    }
    if (typeof json.error === "string") return json.error

    return json.error?.details?.errors?.[0] ?? json.error?.message ?? fallback
  } catch {
    return fallback
  }
}

/**
 * A closed drive's link to its Journal story (spec §5.6): a slug the board
 * saves once the piece is published. "Save" PUTs it to the drive and
 * refreshes the page so `DriveDetailPage` can show the "Read the story"
 * card.
 */
function JournalStoryForm({
  drive,
}: {
  readonly drive: Pick<Drive, "documentId" | "storySlug">
}) {
  const router = useRouter()
  const [value, setValue] = useState(drive.storySlug ?? "")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    tone: "ok" | "error"
    text: string
  } | null>(null)

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/drives/${encodeURIComponent(drive.documentId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storySlug: value.trim() || null }),
        }
      )
      if (!res.ok) {
        setMessage({ tone: "error", text: await messageOf(res) })

        return
      }
      setMessage({ tone: "ok", text: "Saved." })
      router.refresh()
    } catch {
      setMessage({
        tone: "error",
        text: "That didn’t work. Try again in a moment.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-2 border-t pt-3.5"
      style={{ borderColor: T.border.line }}
    >
      <label
        htmlFor="drive-story-slug"
        className="text-[14px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Journal story
      </label>
      <input
        id="drive-story-slug"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ohio-hours-thank-you"
        className="min-h-11 rounded-[14px] border bg-white px-3.5 text-[15px]"
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      />
      <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
        The slug of a published Journal article, for example
        ohio-hours-thank-you.
      </p>
      <div>
        <button
          type="button"
          className={PILL}
          style={{ color: T.ink.base }}
          disabled={busy}
          onClick={save}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="m-0 flex items-center gap-1.5 text-[14px] font-semibold"
          style={{
            color: message.tone === "error" ? T.accent.danger : T.accent.ok,
          }}
        >
          <Icon
            aria-hidden="true"
            icon={
              message.tone === "error"
                ? "mdi:alert-circle-outline"
                : "mdi:check-circle-outline"
            }
            width={16}
          />
          {message.text}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The editorial board's controls on a drive's page: Edit, Pin or Unpin,
 * Feature, Open now, Close now and Cancel (the last two asked about first).
 * Shown only with `drives.manage`; Strapi re-checks the caller's Role
 * Grants on every action.
 */
export function DriveBoardActions({
  drive,
}: {
  readonly drive: Pick<
    Drive,
    "documentId" | "slug" | "status" | "pinned" | "featured" | "storySlug"
  >
}) {
  const { has, ready } = useCapabilities()
  const router = useRouter()
  const [busy, setBusy] = useState<BoardAction | null>(null)
  const [confirming, setConfirming] = useState<"close" | "cancel" | null>(null)
  const [message, setMessage] = useState<{
    tone: "ok" | "error"
    text: string
  } | null>(null)

  if (!ready || !has("drives.manage")) return null

  const settled = drive.status === "closed" || drive.status === "cancelled"

  const run = async (action: BoardAction) => {
    setBusy(action)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/drives/${encodeURIComponent(drive.documentId)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      )
      if (!res.ok) {
        setMessage({ tone: "error", text: await messageOf(res) })

        return
      }
      setConfirming(null)
      setMessage({ tone: "ok", text: DONE[action] })
      router.refresh()
    } catch {
      setMessage({
        tone: "error",
        text: "That didn’t work. Try again in a moment.",
      })
    } finally {
      setBusy(null)
    }
  }

  const button = (
    action: BoardAction,
    label: string,
    icon: string,
    onClick?: () => void
  ) => (
    <button
      type="button"
      className={PILL}
      style={{ color: T.ink.base }}
      disabled={busy !== null}
      onClick={onClick ?? (() => run(action))}
    >
      <Icon aria-hidden="true" icon={icon} width={17} />
      {busy === action ? "Working…" : label}
    </button>
  )

  return (
    <section
      aria-labelledby="drive-board-heading"
      className="flex flex-col gap-3.5"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "clamp(20px,2.6vw,24px)",
      }}
    >
      <div className="flex flex-col gap-1">
        <h2
          id="drive-board-heading"
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: 24,
            color: T.ink.base,
          }}
        >
          Run this drive
        </h2>
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          Only the editorial board sees this.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/community/drives/${encodeURIComponent(drive.slug)}/edit`}
          className={PILL}
          style={{ color: T.ink.base }}
        >
          <Icon aria-hidden="true" icon="mdi:pencil-outline" width={17} />
          Edit
        </Link>
        {drive.status === "scheduled"
          ? button("open", "Open now", "mdi:play-circle-outline")
          : null}
        {settled
          ? null
          : drive.pinned
            ? button("unpin", "Unpin", "mdi:pin-off-outline")
            : button("pin", "Pin", "mdi:pin-outline")}
        {!settled && drive.pinned
          ? drive.featured
            ? button("unfeature", "Stop featuring", "mdi:star-off-outline")
            : button("feature", "Feature", "mdi:star-outline")
          : null}
        {drive.status === "open"
          ? button("close", "Close now", "mdi:stop-circle-outline", () => {
              setMessage(null)
              setConfirming("close")
            })
          : null}
        {settled
          ? null
          : button("cancel", "Cancel drive", "mdi:cancel", () => {
              setMessage(null)
              setConfirming("cancel")
            })}
      </div>

      {drive.status === "closed" ? <JournalStoryForm drive={drive} /> : null}

      {confirming ? (
        <div
          role="group"
          aria-labelledby="drive-board-confirm"
          className="flex flex-col gap-3 rounded-[16px] px-4 py-3.5"
          style={{ background: "#F5EEDC" }}
        >
          <p
            id="drive-board-confirm"
            className="m-0 flex items-start gap-2 text-[15px] leading-[1.5]"
            style={{ color: T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:alert-outline"
              width={18}
              className="mt-0.5 shrink-0"
              style={{ color: T.accent.warn }}
            />
            {CONFIRM[confirming].question}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY}
              disabled={busy !== null}
              onClick={() => run(confirming)}
            >
              {busy === confirming ? "Working…" : CONFIRM[confirming].yes}
            </button>
            <button
              type="button"
              className={PILL}
              style={{ color: T.ink.base }}
              disabled={busy !== null}
              onClick={() => setConfirming(null)}
            >
              {CONFIRM[confirming].no}
            </button>
          </div>
        </div>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className="m-0 flex items-center gap-1.5 text-[14px] font-semibold"
        style={{
          color: message?.tone === "error" ? T.accent.danger : T.accent.ok,
        }}
      >
        {message ? (
          <Icon
            aria-hidden="true"
            icon={
              message.tone === "error"
                ? "mdi:alert-circle-outline"
                : "mdi:check-circle-outline"
            }
            width={17}
          />
        ) : null}
        {message?.text}
      </p>
    </section>
  )
}
