"use client"
import { NETWORK_KIND_LABELS, type NetworkSummary } from "@repo/shared-data"
import { useCallback } from "react"

import { CatalogueSearch } from "@/components/ds/CatalogueSearch"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkList } from "@/lib/networks/types"

export function NetworkPicker({
  onSelect,
  disabled = false,
}: {
  readonly onSelect: (network: NetworkSummary) => void
  readonly disabled?: boolean
}) {
  const load = useCallback(
    async (query: string, page: number, signal: AbortSignal) => {
      const result = await networkRequest<NetworkList>(
        `?q=${encodeURIComponent(query)}&page=${page}`,
        "GET",
        undefined,
        signal
      )

      return {
        rows: result.networks,
        more: page * result.pageSize < result.total,
      }
    },
    []
  )

  return (
    <CatalogueSearch
      label="Find your library service or network"
      placeholder="Search by service or network name"
      disabled={disabled}
      load={load}
      describe={(row: NetworkSummary) =>
        `${NETWORK_KIND_LABELS[row.kind]} · ${row.libraryCount} ${row.libraryCount === 1 ? "library" : "libraries"}`
      }
      onSelect={onSelect}
    />
  )
}
