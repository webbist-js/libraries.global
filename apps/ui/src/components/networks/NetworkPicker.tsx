"use client"
import { NETWORK_KIND_LABELS, type NetworkSummary } from "@repo/shared-data"
import { useTranslations } from "next-intl"
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
      label={tExisting("staticUi.widget.find_your_library_service_or_network")}
      placeholder={tStatic("network.search_by_service_or_network_name")}
      disabled={disabled}
      load={load}
      describe={(row: NetworkSummary) =>
        `${NETWORK_KIND_LABELS[row.kind]} · ${row.libraryCount} ${row.libraryCount === 1 ? "library" : "libraries"}`
      }
      onSelect={onSelect}
    />
  )
}
