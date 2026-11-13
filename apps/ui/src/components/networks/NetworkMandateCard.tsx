"use client"

import type { NetworkMandate } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import {
  StaffPanel,
  STAFF_FIELD,
  STAFF_LINK,
} from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import { networkRequest } from "@/lib/networks/client"

export function NetworkMandateCard({
  mandate,
  onChanged,
  onAdditions,
}: {
  readonly mandate: NetworkMandate
  readonly onChanged: () => void
  readonly onAdditions: () => void
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [pending, startTransition] = useTransition()
  function act(action: "retry" | "reconcile") {
    startTransition(async () => {
      try {
        setError("")
        await networkRequest(
          `/${mandate.documentId}/${action}`,
          "POST",
          action === "retry"
            ? {}
            : { version: mandate.version, revoke: true, reason }
        )
        onChanged()
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : tExisting("apiIndividualCheckout.retry")
        )
      }
    })
  }

  return (
    <StaffPanel title={mandate.network.name}>
      <p>
        {tStatic("network.management")} {mandate.status} ·{" "}
        {mandate.approvedLibraryIds.length} approved libraries ·{" "}
        {mandate.ownerLibraryIds.length} with owner responsibility · revision{" "}
        {mandate.version}
      </p>
      <p role="status">
        {mandate.fulfilment.complete
          ? "Access updates complete"
          : `${mandate.fulfilment.pending.length} access updates and ${mandate.fulfilment.revocations?.length ?? 0} removals pending`}
      </p>
      {Object.keys(mandate.fulfilment.failures).length ? (
        <p role="alert">
          {tStatic(
            "network.some_updates_need_retrying_completed_updates_will_be_preserved"
          )}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-4">
        <Link
          className={STAFF_LINK}
          href={`/staff/networks/libraries?networkId=${mandate.network.documentId}`}
        >
          {tStatic("network.open_service_libraries")}
        </Link>
        {!mandate.fulfilment.complete ? (
          <Button
            variant="surface"
            disabled={pending}
            onClick={() => act("retry")}
          >
            {tStatic("network.retry_access_updates")}
          </Button>
        ) : null}
        {mandate.additionsAwaitingReview.length &&
        mandate.status === "approved" ? (
          <Button variant="surface" disabled={pending} onClick={onAdditions}>
            {tExisting("homepageFallback.review")}{" "}
            {mandate.additionsAwaitingReview.length} new source libraries
          </Button>
        ) : null}
      </div>
      {mandate.removalsAwaitingReview.length ? (
        <p>
          {mandate.removalsAwaitingReview.length} approved libraries are no
          longer in the source. A moderator must confirm removal of their
          service access.
        </p>
      ) : null}
      {mandate.status === "approved" ? (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer py-2">
            {tStatic("network.end_this_management_authority")}
          </summary>
          <label className="grid gap-2">
            {tStatic("common.reason")}
            <input
              className={STAFF_FIELD}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
          </label>
          <p className="text-sm">
            {tStatic(
              "network.this_removes_access_derived_from_the_service_mandate_including_team_assignments_based_on_it_independ"
            )}
          </p>
          <Button
            variant="surface"
            disabled={pending || !reason.trim()}
            onClick={() => act("reconcile")}
          >
            {tStatic("network.revoke_service_authority")}
          </Button>
        </details>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </StaffPanel>
  )
}
