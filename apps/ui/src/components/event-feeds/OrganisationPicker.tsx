"use client"

import { FEED_TEST_COPY } from "@repo/shared-data"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { ChoiceCard } from "@/components/ds/ChoiceCard"
import { Notice } from "@/components/ds/Notice"
import { T } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"

import { isFeedTestCode } from "./feed-copy"
import { PRIMARY_PILL } from "./feed-ui"

/**
 * Radio cards for the Eventbrite organisations found on the account that
 * just connected, shown when there's more than one to choose from. Sending
 * one completes the draft feed and opens its review.
 */
export function OrganisationPicker({
  documentId,
  libraryDocumentId,
  librarySlug,
  organizations,
}: {
  readonly documentId: string
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly organizations: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState(
    organizations[0]?.id ?? ""
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!organizationId) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/contribute/event-feeds/${documentId}/organization`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        }
      )
      const json = await res.json().catch(() => null)
      if (res.ok) {
        router.push(staffLibraryHref(librarySlug, "/events?oauth=sent"))

        return
      }
      const result: unknown = json?.error?.result
      if (res.status === 422 && isFeedTestCode(result))
        setError(FEED_TEST_COPY[result] ?? json.error.message)
      else setError(json?.error?.message ?? "That didn't work. Try again.")
    } catch {
      setError("That didn't work. Check your connection.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset
        className="m-0 flex flex-col gap-3 p-5 sm:p-8"
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "20px",
          background: T.bg.deep,
        }}
      >
        <legend
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
            padding: 0,
          }}
        >
          Organisation
        </legend>
        <div className="grid grid-cols-1 gap-3">
          {organizations.map((org) => (
            <ChoiceCard
              key={org.id}
              name="eventbrite-organization"
              value={org.id}
              checked={organizationId === org.id}
              onChange={() => setOrganizationId(org.id)}
              icon="mdi:domain"
              tint={{ bg: T.bg.muted, fg: T.accent.primary }}
              title={org.name}
              hint={null}
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <Notice icon="mdi:alert-circle-outline" tone="warn" title="Test result">
          <p className="m-0">{error}</p>
        </Notice>
      )}

      <div>
        <button
          type="button"
          className={PRIMARY_PILL}
          disabled={!organizationId || sending}
          onClick={send}
        >
          {sending ? "Sending…" : "Send for review"}
        </button>
      </div>
    </div>
  )
}
