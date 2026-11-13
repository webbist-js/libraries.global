"use client"

import { Icon } from "@iconify/react"
import type { NetworkSummary } from "@repo/shared-data"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useTransition, useEffect } from "react"

import { NetworkPicker } from "@/components/networks/NetworkPicker"
import { STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { Link, useRouter } from "@/lib/navigation"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkDetail } from "@/lib/networks/types"
import type { TeamDetail } from "@/lib/staff/types"

export function TeamNetworkConnection({ team }: { readonly team: TeamDetail }) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
          failure instanceof Error
            ? failure.message
            : tExisting("apiIndividualCheckout.retry")
        )
      }
    })
  }

  return (
    <details
      open={!!networkParam}
      className="group my-5 min-w-0 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl text-(--t-ink-base) outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary) [&::-webkit-details-marker]:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--t-accent-chip) text-(--t-accent-primary)">
          <Icon aria-hidden icon="mdi:domain" width={22} />
        </span>
        <span className="grid min-w-0 flex-1 gap-1">
          <span className="text-xs font-medium text-(--t-ink-dim)">
            {team.primaryNetwork ? "Connected service" : "Service connection"}
          </span>
          <span className="type-small-heading [overflow-wrap:anywhere]">
            {team.primaryNetwork?.name ?? "Connect your library service"}
          </span>
        </span>
        <Icon
          aria-hidden
          icon="mdi:chevron-down"
          width={20}
          className="shrink-0 text-(--t-ink-dim) transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-5 grid gap-5 border-t border-(--t-border-line) pt-5">
        <p className="m-0 max-w-[66ch] text-sm leading-relaxed text-(--t-ink-dim)">
          {tStatic(
            "network.connect_your_service_for_widget_defaults_confirm_whether_to_add_its_current_published_libraries_to_t"
          )}
        </p>
        <NetworkPicker onSelect={setSelected} disabled={pending} />
        {selected ? (
          <div className="grid gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5">
            <p className="m-0 font-semibold">{selected.name}</p>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-4 accent-(--t-accent-primary)"
                checked={addLibraries}
                onChange={(event) => setAddLibraries(event.target.checked)}
                disabled={pending}
              />
              {tStatic("network.add_its_current_libraries_to_team_coverage")}
            </label>
            <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {tStatic(
                "network.existing_libraries_remain_future_source_additions_require_a_separate_coverage_decision_and_a_batch_m"
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button
                type="button"
                variant="primary"
                size="pill"
                disabled={pending}
                onClick={connect}
              >
                {tStatic("network.confirm_connection")}
              </Button>
              <Link
                className={`${STAFF_LINK} inline-flex min-h-11 items-center text-sm`}
                href={`/staff/networks?network=${selected.documentId}`}
              >
                {tStatic("network.request_service_management")}
              </Link>
            </div>
          </div>
        ) : null}
        {message ? (
          <p
            role="status"
            className="m-0 rounded-xl bg-(--t-bg-surface) p-4 text-sm"
          >
            {message}
          </p>
        ) : null}
      </div>
    </details>
  )
}
