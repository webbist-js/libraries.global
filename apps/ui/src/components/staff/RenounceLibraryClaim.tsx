"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { staffRequest } from "@/lib/staff/client"

/** Uses the same authenticated, audited departure as the library staff page. */
export function RenounceLibraryClaim({
  libraryId,
  libraryName,
}: {
  readonly libraryId: string
  readonly libraryName: string
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function leave() {
    setBusy(true)
    setError(null)
    try {
      await staffRequest(
        `/api/staff/${encodeURIComponent(libraryId)}/leave`,
        "POST"
      )
      window.location.reload()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your claim could not be removed."
      )
      setBusy(false)
    }
  }

  return (
    <div className="min-w-0 text-sm">
      {confirm ? (
        <div className="space-y-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-surface) p-4">
          <p className="m-0">
            Renounce your claim to <strong>{libraryName}</strong>? Your staff
            access to this library will end. Your published contributions stay,
            and you can submit a new claim later.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="surface"
              size="pill"
              disabled={busy}
              onClick={() => void leave()}
            >
              {busy ? "Leaving…" : "Confirm renunciation"}
            </Button>
            <Button
              variant="ghost"
              size="pill"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep my claim
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="link"
          className="min-h-11 px-0 text-sm"
          onClick={() => setConfirm(true)}
        >
          Renounce library claim
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-(--t-accent-danger)">
          {error}
        </p>
      ) : null}
    </div>
  )
}
