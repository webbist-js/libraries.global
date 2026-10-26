"use client"
import type { NetworkSummary } from "@repo/shared-data"
import { useEffect, useState } from "react"

import { NetworkPicker } from "@/components/networks/NetworkPicker"
import { STAFF_LINK, StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { CONTACT_EMAIL } from "@/lib/constants"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkDetail } from "@/lib/networks/types"

export type TeamNetworkSelection = {
  network: NetworkSummary
  libraryDocumentIds: string[]
} | null
export function TeamNetworkChoice({
  initialNetwork,
  onChoose,
}: {
  readonly initialNetwork?: string
  readonly onChoose: (choice: TeamNetworkSelection) => void
}) {
  const [choice, setChoice] = useState<TeamNetworkSelection>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  async function select(id: string) {
    setBusy(true)
    try {
      const [detail, scope] = await Promise.all([
        networkRequest<NetworkDetail>(`/${id}`),
        networkRequest<{ libraryIds: string[] }>(`/${id}/scope`),
      ])
      setChoice({
        network: detail.network,
        libraryDocumentIds: scope.libraryIds,
      })
      setError("")
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The service could not be loaded."
      )
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (initialNetwork) {
      const timer = setTimeout(() => {
        void select(initialNetwork)
      }, 0)

      return () => clearTimeout(timer)
    }
  }, [initialNetwork])

  return (
    <StaffPanel title="Start with your library service">
      <p className="mb-5 text-(--t-ink-dim)">
        Choose your institution to start with its published libraries and use it
        as the default source for widgets. This choice does not verify staff
        authority.
      </p>
      <NetworkPicker
        disabled={busy}
        onSelect={(row) => {
          void select(row.documentId)
        }}
      />
      {choice ? (
        <div className="mt-5 rounded-xl bg-(--t-bg-surface) p-4">
          <p className="font-semibold">{choice.network.name}</p>
          <p>
            {choice.libraryDocumentIds.length} published libraries selected. You
            can adjust the Team’s coverage after setup.
          </p>
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => onChoose(choice)}
          >
            Continue with this service
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-4">
        <Button
          type="button"
          variant="surface"
          disabled={busy}
          onClick={() => onChoose(null)}
        >
          Choose libraries myself
        </Button>
        <a
          className={STAFF_LINK}
          href={`mailto:${CONTACT_EMAIL}?subject=Missing%20library%20service`}
        >
          Can’t find your service?
        </a>
      </div>
    </StaffPanel>
  )
}
