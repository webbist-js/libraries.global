"use client"
import { NETWORK_KIND_LABELS, type NetworkSummary } from "@repo/shared-data"
import { useEffect, useState } from "react"

import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkList } from "@/lib/networks/types"

export function NetworkPicker({
  onSelect,
  disabled = false,
}: {
  readonly onSelect: (network: NetworkSummary) => void
  readonly disabled?: boolean
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [result, setResult] = useState<NetworkList | null>(null),
    [error, setError] = useState("")
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      networkRequest<NetworkList>(
        `?q=${encodeURIComponent(query)}&page=${page}`
      )
        .then((value) => {
          if (live) {
            setResult(value)
            setError("")
          }
        })
        .catch(() => {
          if (live) setError("Services could not be loaded. Try again.")
        })
    }, 250)

    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, page])

  return (
    <div className="space-y-3">
      <label className="grid gap-2">
        Find your library service or network
        <input
          className={STAFF_FIELD}
          value={query}
          maxLength={120}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(1)
          }}
          placeholder="Search by name"
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <ul className="m-0 max-h-80 list-none overflow-auto rounded-xl border border-(--t-border-line) p-0">
        {result?.networks.map((row) => (
          <li
            key={row.documentId}
            className="border-b border-(--t-border-line) last:border-0"
          >
            <button
              type="button"
              disabled={disabled}
              className="min-h-14 w-full p-3 text-left hover:bg-(--t-bg-surface)"
              onClick={() => onSelect(row)}
            >
              <span className="block font-semibold">{row.name}</span>
              <span className="text-sm text-(--t-ink-dim)">
                {NETWORK_KIND_LABELS[row.kind]} · {row.libraryCount} libraries
              </span>
            </button>
          </li>
        ))}
      </ul>
      {result && !result.networks.length ? (
        <p>
          No matches. You can still choose libraries individually or suggest a
          missing service through contact.
        </p>
      ) : null}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="surface"
          disabled={disabled || page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="surface"
          disabled={
            disabled || !result || page * result.pageSize >= result.total
          }
          onClick={() => setPage(page + 1)}
        >
          More services
        </Button>
      </div>
    </div>
  )
}
