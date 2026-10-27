"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

/**
 * Re-runs the connection test on the value under review, then refreshes the
 * page's data so `latestTest` picks up the result. A secondary pill: this
 * isn't the decision, just a check before one.
 */
export function FeedTestButton({
  documentId,
}: {
  readonly documentId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/moderation/submissions/${encodeURIComponent(documentId)}/feed-test`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      )
      if (!res.ok) {
        setError("The test could not be run. Try again in a moment.")

        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        className="inline-flex w-fit items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderColor: T.border.hi, color: T.ink.base }}
        disabled={busy}
        onClick={() => void run()}
      >
        <Icon
          aria-hidden="true"
          icon="mdi:refresh"
          width={16}
          height={16}
          className={busy ? "animate-spin" : undefined}
        />
        {busy ? "Testing…" : "Test again"}
      </button>
      {error ? (
        <p
          role="alert"
          className="m-0 text-sm"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
