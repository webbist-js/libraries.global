"use client"
import type { NetworkSummary } from "@repo/shared-data"
import { useEffect, useState, useTransition } from "react"

import { NetworkPicker } from "@/components/networks/NetworkPicker"
import { STAFF_FIELD, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkWorkspace } from "@/lib/networks/types"

export function NetworkAffiliationEditor() {
  const [role, setRole] = useState(""),
    [department, setDepartment] = useState(""),
    [publicDisplay, setPublicDisplay] = useState(false)
  const [data, setData] = useState<NetworkWorkspace | null>(null),
    [selected, setSelected] = useState<NetworkSummary | null>(null),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition()
  function refresh() {
    networkRequest<NetworkWorkspace>("/me")
      .then(setData)
      .catch(() => setError("Affiliations could not be loaded."))
  }
  useEffect(() => {
    let live = true
    networkRequest<NetworkWorkspace>("/me")
      .then((value) => {
        if (live) setData(value)
      })
      .catch(() => {
        if (live) setError("Affiliations could not be loaded.")
      })

    return () => {
      live = false
    }
  }, [])
  function save() {
    if (!selected || !role.trim()) return
    startTransition(async () => {
      try {
        await networkRequest(`/${selected.documentId}/affiliation`, "PUT", {
          role,
          department,
          publicDisplay,
        })
        setSelected(null)
        setError("")
        refresh()
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })
  }
  function withdraw(id: string) {
    startTransition(async () => {
      try {
        await networkRequest(`/${id}/withdraw`, "POST", {
          reason: "Affiliation ended by the account holder",
        })
        refresh()
      } catch {
        setError("The affiliation could not be withdrawn. Please try again.")
      }
    })
  }

  return (
    <div className="mt-6 space-y-4 border-t border-(--t-border-line) pt-6">
      <h3 className="type-h3">Your service or network</h3>
      <p className="text-sm">
        Add your institutional affiliation. A declared affiliation is separate
        from verified employment or authority to manage library records.
      </p>
      {data?.affiliations.map((row) => (
        <div
          key={row.documentId}
          className="rounded-xl border border-(--t-border-line) p-4"
        >
          <p className="font-semibold">
            {row.network.name} · {row.status}
          </p>
          <p>
            {row.role}
            {row.publicDisplay ? " · Public" : " · Private"}
          </p>
          <Link
            className={STAFF_LINK}
            href={`/staff/networks?network=${row.network.documentId}`}
          >
            Request verification or management
          </Link>
          {row.status !== "revoked" ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => withdraw(row.documentId)}
            >
              End this affiliation and its service authority
            </Button>
          ) : null}
        </div>
      ))}
      <NetworkPicker
        onSelect={(row) => {
          setSelected(row)
          const existing = data?.affiliations.find(
            (item) => item.network.documentId === row.documentId
          )
          setRole(existing?.role ?? "")
          setDepartment(existing?.department ?? "")
          setPublicDisplay(existing?.publicDisplay ?? false)
        }}
        disabled={pending}
      />
      {selected ? (
        <div className="space-y-4">
          <p className="font-semibold">{selected.name}</p>
          <label className="grid gap-2">
            Role
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              required
              maxLength={160}
              className={STAFF_FIELD}
            />
          </label>
          <label className="grid gap-2">
            Department (optional)
            <input
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              maxLength={160}
              className={STAFF_FIELD}
            />
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={publicDisplay}
              onChange={(event) => setPublicDisplay(event.target.checked)}
            />
            Show this affiliation on my public profile
          </label>
          <Button
            type="button"
            variant="surface"
            disabled={pending || !role.trim()}
            onClick={save}
          >
            Save affiliation
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
