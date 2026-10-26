"use client"
import type { NetworkSummary } from "@repo/shared-data"
import { useSearchParams } from "next/navigation"
import { useState, useTransition, useEffect } from "react"

import { NetworkPicker } from "@/components/networks/NetworkPicker"
import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Link, useRouter } from "@/lib/navigation"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkDetail } from "@/lib/networks/types"
import type { TeamDetail } from "@/lib/staff/types"

export function TeamNetworkConnection({ team }: { readonly team: TeamDetail }) {
  const [selected, setSelected] = useState<NetworkSummary | null>(null),
    [addLibraries, setAddLibraries] = useState(true),
    [message, setMessage] = useState(""),
    [pending, startTransition] = useTransition(),
    router = useRouter()
  const networkParam = useSearchParams().get("network")
  useEffect(() => {
    let active = true
    if (networkParam)
      networkRequest<NetworkDetail>(`/${encodeURIComponent(networkParam)}`)
        .then((data) => {
          if (active) setSelected(data.network)
        })
        .catch(() => {
          if (active) setMessage("The selected service could not be loaded.")
        })

    return () => {
      active = false
    }
  }, [networkParam])
  if (team.viewerRole !== "organiser") return null
  function connect() {
    if (!selected) return
    startTransition(async () => {
      try {
        const scope = await networkRequest<{ libraryIds: string[] }>(
            `/${selected.documentId}/scope`
          ),
          ids = addLibraries
            ? [
                ...new Set([
                  ...team.libraries.map((row) => row.documentId),
                  ...scope.libraryIds,
                ]),
              ]
            : team.libraries.map((row) => row.documentId)
        const response = await fetch(`/api/staff/team/${team.documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            primaryNetworkId: selected.documentId,
            libraryDocumentIds: ids,
          }),
        })
        if (!response.ok)
          throw new Error(
            "The service could not be connected. Verified Teams must already have approved authority for any newly covered libraries."
          )
        setMessage(
          "Service connected. Existing staff authority is retained; service access requires its own review."
        )
        router.refresh()
      } catch (failure) {
        setMessage(
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })
  }

  return (
    <details
      open={!!networkParam}
      className="my-5 rounded-2xl border border-(--t-border-line) p-5"
    >
      <summary className="min-h-11 cursor-pointer font-semibold">
        Connect a library service or network
      </summary>
      {team.primaryNetwork ? (
        <p className="font-semibold">Connected to {team.primaryNetwork.name}</p>
      ) : null}
      <p className="my-4">
        Connect your service for widget defaults. Confirm whether to add its
        current published libraries to Team coverage.
      </p>
      <NetworkPicker onSelect={setSelected} disabled={pending} />
      {selected ? (
        <div className="mt-4 space-y-3">
          <p className="font-semibold">{selected.name}</p>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={addLibraries}
              onChange={(event) => setAddLibraries(event.target.checked)}
              disabled={pending}
            />
            Add its current libraries to Team coverage
          </label>
          <p className="text-sm">
            Existing libraries remain. Future source additions require a
            separate coverage decision and a batch management review.
          </p>
          <Button
            type="button"
            variant="surface"
            disabled={pending}
            onClick={connect}
          >
            Confirm connection
          </Button>
          <Link
            className={`${STAFF_LINK} ml-4`}
            href={`/staff/networks?network=${selected.documentId}`}
          >
            Request service management
          </Link>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </details>
  )
}
