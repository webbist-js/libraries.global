"use client"
import { Icon } from "@iconify/react"
import type { VerifySection } from "@repo/shared-data"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

const SECTION_LABEL: Record<string, string> = {
  hours: "hours",
  status: "status",
  address: "address",
  contact: "contact details",
}

/**
 * "Confirm hours": stamps the section as verified today, as an outlined
 * pill. The result is announced (role=status) and the page refreshes so the
 * health row shows the new date.
 */
export function StaffVerifyButton({
  id,
  sections,
  label,
}: {
  id: string
  sections: VerifySection[]
  /** The pill's text; defaults to "Confirm {section}". */
  label?: string
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("")
  const router = useRouter()
  const what = SECTION_LABEL[sections[0] ?? ""] ?? "details"
  const text = label ?? `Confirm ${what}`
  async function verify() {
    setBusy(true)
    setError("")
    setDone("")
    try {
      const r = await fetch(`/api/staff/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      })
      const data = await r.json()
      if (!r.ok)
        throw new Error(
          r.status === 429
            ? "Too many confirmations in a short time. Wait a moment, then try again."
            : (data.error?.message ?? "Please try again.")
        )
      setDone(`Confirmed: ${what} marked as checked today.`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        disabled={busy}
        onClick={verify}
        variant="surface"
        size="pill"
        style={{ borderColor: T.border.hi, color: T.ink.base }}
      >
        <Icon
          aria-hidden="true"
          icon="mdi:check"
          width={16}
          height={16}
          style={{ color: T.accent.ok }}
        />
        {busy ? "Confirming…" : text}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {done}
      </span>
      {error && (
        <span
          role="alert"
          className="text-[13px]"
          style={{ color: T.accent.danger }}
        >
          {error}
        </span>
      )}
    </span>
  )
}
