"use client"
import { Icon } from "@iconify/react"
import type { NetworkSummary } from "@repo/shared-data"
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
      <StaffPanel title="Start with your library service" compact>
        <p className="mb-5 text-xs font-semibold tracking-wide text-(--t-accent-primary) uppercase">
          Step 1 of 2 · Your libraries
        </p>
        <p className="mb-5 text-(--t-ink-dim)">
          Choose your institution to start with its published libraries and use
          it as the default source for widgets. This choice does not verify
          staff authority.
        </p>
        <NetworkPicker
          disabled={busy}
          onSelect={(row) => {
            void select(row.documentId)
          }}
        />
        {choice ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-(--t-accent-primary)/20 bg-(--t-accent-chip)/40 p-5">
            <Badge color="aurora" label="Selected service" />
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
              Continue with this service
            </Button>
          </div>
        ) : null}
        {busy ? (
          <p role="status" className="mt-4 text-sm text-(--t-ink-dim)">
            Loading service libraries…
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
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
            Choose libraries myself
          </Button>
          <a
            className={STAFF_LINK}
            href={`mailto:${CONTACT_EMAIL}?subject=Missing%20library%20service`}
          >
            Can’t find your service?
          </a>
        </div>
      </StaffPanel>
      <aside className="space-y-6 px-2 py-2">
        <span className="flex size-11 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
          <Icon aria-hidden icon="mdi:account-group-outline" width={23} />
        </span>
        <h2 className="type-panel-title">A shared workspace</h2>
        <ol className="list-decimal space-y-5 pl-5 text-base text-(--t-ink-dim)">
          <li>
            <strong className="block text-(--t-ink-base)">
              Connect your libraries
            </strong>
            Start with a service or choose records individually.
          </li>
          <li>
            <strong className="block text-(--t-ink-base)">
              Set up your Team
            </strong>
            Name your Team and review annual billing.
          </li>
          <li>
            <strong className="block text-(--t-ink-base)">
              Invite & create
            </strong>
            Bring colleagues together and publish your first widget.
          </li>
        </ol>
        <p className="border-t border-(--t-border-line) pt-5 text-xs leading-relaxed text-(--t-ink-dim)">
          Library management authority is reviewed separately. New service
          additions are reviewed as a batch.
        </p>
      </aside>
    </div>
  )
}
