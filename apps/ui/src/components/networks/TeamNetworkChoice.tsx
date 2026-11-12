"use client"

import { Icon } from "@iconify/react"
import type { NetworkSummary } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { NetworkPicker } from "@/components/networks/NetworkPicker"
import { STAFF_LINK, StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { CONTACT_EMAIL } from "@/lib/constants"
import { networkRequest } from "@/lib/networks/client"
import type { NetworkDetail } from "@/lib/networks/types"

export type TeamNetworkSelection = {
  network: NetworkSummary
  libraryDocumentIds: string[]
} | null
export function TeamNetworkChoice({
  initialNetwork,
  onChoose,
}: {
  readonly initialNetwork?: string
  readonly onChoose: (choice: TeamNetworkSelection) => void
}) {
  const tStatic = useTranslations("staticUi")

  const [choice, setChoice] = useState<TeamNetworkSelection>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  async function select(id: string) {
    setBusy(true)
    try {
      const [detail, scope] = await Promise.all([
        networkRequest<NetworkDetail>(`/${id}`),
        networkRequest<{ libraryIds: string[] }>(`/${id}/scope`),
      ])
      setChoice({
        network: detail.network,
        libraryDocumentIds: scope.libraryIds,
      })
      setError("")
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The service could not be loaded."
      )
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (initialNetwork) {
      const timer = setTimeout(() => {
        void select(initialNetwork)
      }, 0)

      return () => clearTimeout(timer)
    }
  }, [initialNetwork])

  return (
    <div className="mx-auto grid max-w-5xl items-start gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
      <StaffPanel
        title={tStatic("network.start_with_your_library_service")}
        compact
      >
        <p className="mb-5 text-xs font-semibold tracking-wide text-(--t-accent-primary) uppercase">
          {tStatic("network.step_1_of_2_your_libraries")}
        </p>
        <p className="mb-5 text-(--t-ink-dim)">
          {tStatic(
            "network.choose_your_institution_to_start_with_its_published_libraries_and_use_it_as_the_default_source_for_w"
          )}
        </p>
        <NetworkPicker
          disabled={busy}
          onSelect={(row) => {
            void select(row.documentId)
          }}
        />
        {choice ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-(--t-accent-primary)/20 bg-(--t-accent-chip)/40 p-5">
            <Badge color="aurora" label={tStatic("network.selected_service")} />
            <p className="font-semibold">{choice.network.name}</p>
            <p className="text-sm text-(--t-ink-dim)">
              <strong className="text-(--t-ink-base)">
                {choice.libraryDocumentIds.length} published libraries
              </strong>{" "}
              will form your starting coverage. You can adjust it after setup.
            </p>
            <Button
              type="button"
              variant="primary"
              size="pill"
              disabled={busy}
              onClick={() => onChoose(choice)}
            >
              {tStatic("network.continue_with_this_service")}
            </Button>
          </div>
        ) : null}
        {busy ? (
          <p role="status" className="mt-4 text-sm text-(--t-ink-dim)">
            {tStatic("network.loading_service_libraries")}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-(--t-palette-amber-soft) p-3 text-sm text-(--t-palette-amber-fg)"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-4">
          <Button
            type="button"
            variant="surface"
            size="pill"
            disabled={busy}
            onClick={() => onChoose(null)}
          >
            {tStatic("network.choose_libraries_myself")}
          </Button>
          <a
            className={STAFF_LINK}
            href={`mailto:${CONTACT_EMAIL}?subject=Missing%20library%20service`}
          >
            {tStatic("network.can_t_find_your_service")}
          </a>
        </div>
      </StaffPanel>
      <aside className="space-y-6 px-2 py-2">
        <span className="flex size-11 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
          <Icon aria-hidden icon="mdi:account-group-outline" width={23} />
        </span>
        <h2 className="type-panel-title">
          {tStatic("network.a_shared_workspace")}
        </h2>
        <ol className="list-decimal space-y-5 pl-5 text-base text-(--t-ink-dim)">
          <li>
            <strong className="block text-(--t-ink-base)">
              {tStatic("common.connectLibraries")}
            </strong>
            {tStatic(
              "network.start_with_a_service_or_choose_records_individually"
            )}
          </li>
          <li>
            <strong className="block text-(--t-ink-base)">
              {tStatic("network.set_up_your_team")}
            </strong>
            {tStatic("network.name_your_team_workspaces_are_free")}
          </li>
          <li>
            <strong className="block text-(--t-ink-base)">
              {tStatic("network.invite_create")}
            </strong>
            {tStatic(
              "network.bring_colleagues_together_and_publish_your_first_widget"
            )}
          </li>
        </ol>
        <p className="border-t border-(--t-border-line) pt-5 text-xs leading-relaxed text-(--t-ink-dim)">
          {tStatic(
            "network.library_management_authority_is_reviewed_separately_new_service_additions_are_reviewed_as_a_batch"
          )}
        </p>
      </aside>
    </div>
  )
}
