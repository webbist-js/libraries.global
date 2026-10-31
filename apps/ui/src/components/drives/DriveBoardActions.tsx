"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import {
  EditorialToolbar,
  EDITORIAL_SUBTLE_PILL,
  EDITORIAL_SUBTLE_DANGER_PILL,
  EDITORIAL_DANGER_PILL,
} from "@/components/ds/EditorialToolbar"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import type { Drive } from "@/lib/drives/types"
import { Link, useRouter } from "@/lib/navigation"
import { cn } from "@/lib/styles"

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

const PILL = EDITORIAL_SUBTLE_PILL
const PRIMARY = cn(EDITORIAL_SUBTLE_PILL, EDITORIAL_DANGER_PILL)

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
  const tUi = useUiTranslations("ui")

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
        className="text-sm font-semibold"
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
        className="min-h-11 rounded-[14px] border bg-(--t-bg-deep) px-3.5 text-base"
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      />
      <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
        The slug of a published Journal article, for example
        ohio-hours-thank-you.
      </p>
      <div>
        <button type="button" className={PILL} disabled={busy} onClick={save}>
          {busy ? tUi("saving") : tUi("save")}
        </button>
      </div>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="m-0 flex items-center gap-1.5 text-sm font-semibold"
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
  const tUi = useUiTranslations("ui")

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

  const button = (action: BoardAction, label: string, onClick?: () => void) => (
    <button
      type="button"
      className={cn(
        PILL,
        action === "cancel" &&
          cn(EDITORIAL_SUBTLE_DANGER_PILL, "border-(--t-palette-coral-fg)/30")
      )}
      disabled={busy !== null}
      onClick={onClick ?? (() => run(action))}
    >
      {busy === action ? "Working…" : label}
    </button>
  )

  return (
    <>
      <EditorialToolbar
        variant="subtle"
        showIcon={false}
        className="rounded-[18px] py-2.5"
        label="Run this drive"
        headingId="drive-board-heading"
        description="Only the editorial board sees this."
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/community/drives/${encodeURIComponent(drive.slug)}/edit`}
                className={PILL}
              >
                {tUi("edit")}{" "}
              </Link>
              {drive.status === "scheduled"
                ? button("open", tUi("open_now"))
                : null}
              {settled
                ? null
                : drive.pinned
                  ? button("unpin", "Unpin")
                  : button("pin", "Pin")}
              {!settled && drive.pinned
                ? drive.featured
                  ? button("unfeature", "Stop featuring")
                  : button("feature", "Feature")
                : null}
            </div>
            {!settled && (
              <div className="flex flex-wrap items-center gap-2 border-l border-(--t-border-hi) pl-2.5">
                {drive.status === "open"
                  ? button("close", "Close now", () => {
                      setMessage(null)
                      setConfirming("close")
                    })
                  : null}
                {button("cancel", "Cancel drive", () => {
                  setMessage(null)
                  setConfirming("cancel")
                })}
              </div>
            )}
          </>
        }
      >
        {drive.status === "closed" || confirming || message ? (
          <>
            {drive.status === "closed" ? (
              <JournalStoryForm drive={drive} />
            ) : null}

            {confirming ? (
              <div
                role="group"
                aria-labelledby="drive-board-confirm"
                className="flex flex-col gap-3 rounded-[16px] px-4 py-3.5"
                style={{ background: "var(--t-palette-amber-bg)" }}
              >
                <p
                  id="drive-board-confirm"
                  className="m-0 flex items-start gap-2 text-base leading-[1.5]"
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
                    <Icon
                      aria-hidden="true"
                      icon="mdi:shield-alert-outline"
                      width={15}
                    />
                    {busy === confirming ? "Working…" : CONFIRM[confirming].yes}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-3 py-1.5 text-xs font-semibold text-(--t-ink-base) disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    {CONFIRM[confirming].no}
                  </button>
                </div>
              </div>
            ) : null}

            <p
              className={cn(
                "m-0 flex items-center gap-1.5 text-sm font-semibold",
                !message && "sr-only"
              )}
              style={{
                color:
                  message?.tone === "error" ? T.accent.danger : T.accent.ok,
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
          </>
        ) : null}
      </EditorialToolbar>
      <p role="status" aria-live="polite" className="sr-only">
        {message?.text}
      </p>
    </>
  )
}
