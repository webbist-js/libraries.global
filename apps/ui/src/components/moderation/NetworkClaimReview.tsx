"use client"
import { useEffect, useState, useTransition } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { ReviewDecisionForm } from "@/components/moderation/ReviewDecisionForm"
import { NetworkMandateCard } from "@/components/networks/NetworkMandateCard"
import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkReview } from "@/lib/networks/types"

export function NetworkClaimReview({
  documentId,
  status,
}: {
  readonly documentId: string
  readonly status: string
}) {
  const [staffRole, setStaffRole] = useState<"editor" | "owner">("editor")
  const [review, setReview] = useState<NetworkReview | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState("")
  function refresh() {
    networkRequest<NetworkReview>(`/${documentId}/review`)
      .then(setReview)
      .catch(() =>
        setError("Service scope could not be loaded. Reload before approving.")
      )
  }
  useEffect(() => {
    let live = true
    networkRequest<NetworkReview>(`/${documentId}/review`)
      .then((data) => {
        if (live) {
          setReview(data)
          setSelected(
            data.snapshot.libraryIds.filter((id) =>
              data.currentLibraryIds.includes(id)
            )
          )
        }
      })
      .catch(() => {
        if (live)
          setError(
            "Service scope could not be loaded. Reload before approving."
          )
      })

    return () => {
      live = false
    }
  }, [documentId])
  if (!review)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading frozen service scope…"}
      </p>
    )

  return (
    <div className="space-y-5">
      <p className="font-semibold">
        {review.snapshot.networkName} · {review.snapshot.intent}
      </p>
      <p>
        {review.snapshot.libraryIds.length} requested libraries. Source revision{" "}
        {review.snapshot.membershipRevision.slice(0, 12)}.
      </p>
      <p>
        {review.added.length} libraries added and {review.removed.length}{" "}
        removed from the source since submission. Additions are excluded from
        this decision.
      </p>
      <p className="text-sm">
        {review.snapshot.role} · {review.snapshot.department}
      </p>
      <p className="whitespace-pre-wrap">{review.snapshot.note}</p>
      {review.snapshot.evidenceUrl ? (
        <a
          className="underline"
          href={review.snapshot.evidenceUrl}
          rel="noopener noreferrer"
        >
          Private evidence
        </a>
      ) : null}
      {review.snapshot.intent === "management" ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-2">
            Choose approved scope ({selected.length})
          </summary>
          <ul className="m-0 max-h-80 list-none overflow-auto p-0">
            {review.snapshot.libraryIds.map((id) => (
              <li key={id}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={
                      !review.currentLibraryIds.includes(id) ||
                      status !== "pending"
                    }
                    checked={selected.includes(id)}
                    onChange={() =>
                      setSelected(
                        selected.includes(id)
                          ? selected.filter((value) => value !== id)
                          : [...selected, id]
                      )
                    }
                  />
                  <span>{review.libraryNames[id] ?? id}</span>
                  {!review.currentLibraryIds.includes(id)
                    ? "No longer in source"
                    : ""}
                </label>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {review.snapshot.intent === "management" ? (
        <label className="grid gap-2">
          Approved responsibility
          <SelectField
            className={STAFF_FIELD}
            value={String(staffRole ?? "")}
            onValueChange={(selectedValue) =>
              setStaffRole(selectedValue as "editor" | "owner")
            }
            options={[
              { value: "editor", label: "Editor access" },
              ...(review.snapshot.staffRole === "owner"
                ? [
                    {
                      value: "owner",
                      label: "Owner responsibility and delegation",
                    },
                  ]
                : []),
            ]}
          />
        </label>
      ) : null}
      <ReviewDecisionForm
        documentId={documentId}
        status={status}
        submissionType="network_claim"
        canPublish={false}
        canApprove={
          review.snapshot.intent === "employment" || selected.length > 0
        }
        approvedLibraryIds={selected}
        approvedStaffRole={staffRole}
        approvalBlockedReason="Choose a current library to approve, or reject this request with a reason."
        requireApprovalNote={
          staffRole === "owner" ||
          selected.length !== review.snapshot.libraryIds.length
        }
      />
      <details>
        <summary className="min-h-11 cursor-pointer py-2">
          Service authority history
        </summary>
        <ul className="m-0 list-none space-y-3 p-0">
          {review.audit.map((event) => (
            <li key={event.documentId}>
              {event.action} · revision {event.version} ·{" "}
              {event.createdAt.slice(0, 10)}
              {event.reason ? <p>{event.reason}</p> : null}
            </li>
          ))}
        </ul>
      </details>
      {review.mandates.map((mandate) => (
        <div key={`${mandate.documentId}:${mandate.version}`}>
          <NetworkMandateCard
            mandate={mandate}
            onChanged={refresh}
            onAdditions={() => {}}
          />
          {mandate.removalsAwaitingReview.length ? (
            <NetworkRemovalConfirmation
              id={mandate.documentId}
              version={mandate.version}
              libraryIds={mandate.removalsAwaitingReview}
              onChanged={refresh}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}
function NetworkRemovalConfirmation({
  id,
  version,
  libraryIds,
  onChanged,
}: {
  readonly id: string
  readonly version: number
  readonly libraryIds: string[]
  readonly onChanged: () => void
}) {
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition()
  function remove() {
    startTransition(async () => {
      try {
        await networkRequest(`/${id}/reconcile`, "POST", {
          version,
          libraryIds,
          reason,
        })
        onChanged()
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Removal failed.")
      }
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-(--t-border-line) p-4">
      <p>
        Confirm removal of {libraryIds.length} libraries no longer in the
        service source. Independent claims remain.
      </p>
      <label className="grid gap-2">
        Review reason
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          className={STAFF_FIELD}
        />
      </label>
      <Button
        type="button"
        variant="surface"
        disabled={pending || !reason.trim()}
        onClick={remove}
      >
        Confirm service access removals
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  )
}
