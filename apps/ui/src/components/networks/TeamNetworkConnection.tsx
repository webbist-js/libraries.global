"use client"
import { Icon } from "@iconify/react"
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
      className="group my-5 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
    >
      <summary className="min-h-11 cursor-pointer font-semibold">
        <span className="inline-flex items-center gap-2">
          <Icon
            aria-hidden
            icon="mdi:domain"
            width={20}
            className="text-(--t-accent-primary)"
          />
          {team.primaryNetwork
            ? `Connected: ${team.primaryNetwork.name}`
            : "Connect your library service"}
        </span>
      </summary>
      <p className="my-4 max-w-2xl text-sm text-(--t-ink-dim)">
        Connect your service for widget defaults. Confirm whether to add its
        current published libraries to Team coverage.
      </p>
      <NetworkPicker onSelect={setSelected} disabled={pending} />
      {selected ? (
        <div className="mt-5 space-y-3 rounded-2xl bg-(--t-bg-surface) p-4 sm:p-5">
          <p className="font-semibold">{selected.name}</p>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-(--t-accent-primary)"
              checked={addLibraries}
              onChange={(event) => setAddLibraries(event.target.checked)}
              disabled={pending}
            />
            Add its current libraries to Team coverage
          </label>
          <p className="text-sm text-(--t-ink-dim)">
            Existing libraries remain. Future source additions require a
            separate coverage decision and a batch management review.
          </p>
          <Button
            type="button"
            variant="primary"
            size="pill"
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
      {message ? (
        <p
          role="status"
          className="mt-4 rounded-xl bg-(--t-bg-surface) p-4 text-sm"
        >
          {message}
        </p>
      ) : null}
    </details>
  )
}
