"use client"
import type { NetworkClaimSnapshot } from "@repo/shared-data"
import { useLocale } from "next-intl"
import { useState, useTransition } from "react"

import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkDetail } from "@/lib/networks/types"

export function NetworkClaimForm({
  detail,
  libraryIds,
  teamId = null,
  mandateId = null,
  onSaved,
  initialRequest,
}: {
  readonly detail: NetworkDetail
  readonly libraryIds: string[]
  readonly teamId?: string | null
  readonly mandateId?: string | null
  readonly initialRequest?: Partial<NetworkClaimSnapshot> | null
  readonly onSaved: () => void
}) {
  const locale = useLocale()
  const [intent, setIntent] = useState(initialRequest?.intent ?? "employment"),
    [selected, setSelected] = useState(
      initialRequest?.libraryIds?.filter((id) => libraryIds.includes(id)) ??
        libraryIds
    ),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [pending, startTransition] = useTransition()
  const [attachTeam, setAttachTeam] = useState(
    initialRequest ? Boolean(initialRequest.teamId) : Boolean(teamId)
  )
  const management = intent === "management"
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    startTransition(async () => {
      try {
        setError("")
        await networkRequest(`/${detail.network.documentId}/claims`, "POST", {
          intent,
          locale,
          staffRole: values.get("staffRole") ?? "editor",
          role: values.get("role"),
          department: values.get("department"),
          note: values.get("note"),
          evidenceUrl: values.get("evidenceUrl"),
          libraryIds: management ? selected : [],
          teamId: management && attachTeam ? teamId : null,
          mandateId: management ? mandateId : null,
        })
        setDone(true)
        onSaved()
      } catch (failure) {
        setError(
          failure instanceof Error ? failure.message : "Please try again."
        )
      }
    })
  }
  if (done)
    return (
      <p role="status">
        Your grouped request is in the moderation queue. You can follow its
        progress below and in Your submissions.
      </p>
    )

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <label className="grid gap-2">
        What would you like reviewed?
        <select
          value={intent}
          onChange={(event) =>
            setIntent(
              event.target.value === "management" ? "management" : "employment"
            )
          }
          className={STAFF_FIELD}
          disabled={pending}
        >
          <option value="employment">
            Verify that I work for this institution
          </option>
          {detail.network.kind !== "consortium" ? (
            <option value="management">
              Management access to its library records
            </option>
          ) : null}
        </select>
      </label>
      <p className="text-sm text-(--t-ink-dim)">
        Employment verification confirms your affiliation. Management approval
        grants access only to the libraries a moderator approves. Evidence is
        private.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          Your role
          <input
            name="role"
            defaultValue={initialRequest?.role}
            required
            maxLength={160}
            className={STAFF_FIELD}
            disabled={pending}
          />
        </label>
        <label className="grid gap-2">
          Department (optional)
          <input
            name="department"
            defaultValue={initialRequest?.department}
            maxLength={160}
            className={STAFF_FIELD}
            disabled={pending}
          />
        </label>
      </div>
      {management ? (
        <label className="grid gap-2">
          Requested responsibility
          <select
            name="staffRole"
            defaultValue={initialRequest?.staffRole ?? "editor"}
            className={STAFF_FIELD}
            disabled={pending}
          >
            <option value="editor">Edit these library records</option>
            <option value="owner">
              Manage staff and delegate access as an owner
            </option>
          </select>
          <span className="text-sm">
            Editor access is the default. Owner responsibility requires an
            explicit moderator decision and reason.
          </span>
        </label>
      ) : null}
      {management ? (
        <NetworkScope
          detail={detail}
          libraryIds={libraryIds}
          selected={selected}
          setSelected={setSelected}
          disabled={pending}
        />
      ) : null}
      <label className="grid gap-2">
        Evidence URL (optional)
        <input
          name="evidenceUrl"
          defaultValue={initialRequest?.evidenceUrl}
          type="url"
          maxLength={2000}
          className={STAFF_FIELD}
          placeholder="https://your-service.example/staff"
          disabled={pending}
        />
      </label>
      <label className="grid gap-2">
        Explain your relationship and requested authority
        <textarea
          name="note"
          defaultValue={initialRequest?.note}
          required
          maxLength={4000}
          rows={4}
          className={STAFF_FIELD}
          disabled={pending}
        />
      </label>
      {teamId && management ? (
        <div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={attachTeam}
              onChange={(event) => setAttachTeam(event.target.checked)}
              disabled={pending || Boolean(mandateId)}
            />
            Connect the approved delegation scope to my Team
          </label>
          <p>
            Approved management can support assignments from your Team within
            the reviewed scope. Payment does not verify service authority.
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-(--t-danger)">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        disabled={pending || (management && !selected.length)}
      >
        {pending ? "Sending…" : "Send one request for review"}
      </Button>
    </form>
  )
}
function NetworkScope({
  detail,
  libraryIds,
  selected,
  setSelected,
  disabled,
}: {
  readonly detail: NetworkDetail
  readonly libraryIds: string[]
  readonly selected: string[]
  readonly setSelected: (ids: string[]) => void
  readonly disabled: boolean
}) {
  const [page, setPage] = useState(detail),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("")
  async function changePage(next: number) {
    setLoading(true)
    try {
      setPage(
        await networkRequest<NetworkDetail>(
          `/${detail.network.documentId}?page=${next}`
        )
      )
      setError("")
    } catch {
      setError("The next page could not be loaded.")
    } finally {
      setLoading(false)
    }
  }
  function toggle(id: string) {
    setSelected(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id]
    )
  }

  return (
    <fieldset
      className="space-y-3 rounded-xl border border-(--t-border-line) p-4"
      disabled={disabled || loading}
    >
      <legend>Reviewed library scope</legend>
      <p>
        {selected.length} of {libraryIds.length} published libraries selected.
        Later additions require a new batch review.
      </p>
      <div className="flex gap-3">
        <Button
          variant="surface"
          type="button"
          onClick={() => setSelected(libraryIds)}
        >
          Select all
        </Button>
        <Button variant="surface" type="button" onClick={() => setSelected([])}>
          Clear
        </Button>
      </div>
      <ul className="m-0 max-h-80 list-none overflow-auto p-0">
        {page.libraries
          .filter((row) => libraryIds.includes(row.documentId))
          .map((row) => (
            <li key={row.documentId}>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.includes(row.documentId)}
                  onChange={() => toggle(row.documentId)}
                />
                {row.name}
              </label>
            </li>
          ))}
      </ul>
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex justify-between">
        <Button
          variant="surface"
          type="button"
          disabled={page.page === 1}
          onClick={() => changePage(page.page - 1)}
        >
          Previous libraries
        </Button>
        <Button
          variant="surface"
          type="button"
          disabled={page.page * page.pageSize >= detail.network.libraryCount}
          onClick={() => changePage(page.page + 1)}
        >
          More libraries
        </Button>
      </div>
    </fieldset>
  )
}
