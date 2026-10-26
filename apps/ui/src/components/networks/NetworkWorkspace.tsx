"use client"
import { Icon } from "@iconify/react"
import type { NetworkClaimSnapshot } from "@repo/shared-data"
import { useEffect, useState, useRef, useCallback } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { NetworkClaimForm } from "@/components/networks/NetworkClaimForm"
import { NetworkMandateCard } from "@/components/networks/NetworkMandateCard"
import { NetworkPicker } from "@/components/networks/NetworkPicker"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Link } from "@/lib/navigation"
import { networkRequest } from "@/lib/networks/client"
import type {
  NetworkDetail,
  NetworkWorkspace as Workspace,
} from "@/lib/networks/types"

const reviewStatus = (status: string) =>
  (
    ({
      needs_info: "More information needed",
      pending: "Awaiting review",
      submitted: "Awaiting review",
      approved: "Approved",
      verified: "Verified",
      rejected: "Not approved",
      revoked: "Revoked",
      unverified: "Not verified",
    }) as Record<string, string>
  )[status] ??
  status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())

export function NetworkWorkspace({
  initialNetwork,
  teamId = null,
  initialRequestId,
}: {
  readonly initialRequestId?: string
  readonly initialNetwork?: string
  readonly teamId?: string | null
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [detail, setDetail] = useState<NetworkDetail | null>(null),
    [ids, setIds] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [mandateId, setMandateId] = useState<string | null>(null)
  const [formInitial, setFormInitial] =
    useState<Partial<NetworkClaimSnapshot> | null>(null)
  const initialChoice = useRef("")
  function refresh() {
    networkRequest<Workspace>("/me")
      .then(setWorkspace)
      .catch(() =>
        setError("Your service access could not be loaded. Please try again.")
      )
  }
  const selectionRequest = useRef(0)
  const choose = useCallback(
    async (
      id: string,
      additions?: string[],
      mandate?: string,
      request?: Partial<NetworkClaimSnapshot>
    ) => {
      const sequence = ++selectionRequest.current
      setLoading(true)
      try {
        setError("")
        const [next, scope] = await Promise.all([
          networkRequest<NetworkDetail>(`/${id}`),
          networkRequest<{ libraryIds: string[] }>(`/${id}/scope`),
        ])
        if (sequence !== selectionRequest.current) return
        setDetail(next)
        setIds(additions ?? scope.libraryIds)
        const existing = workspace?.mandates.find(
          (row) => row.network.documentId === id && row.status === "approved"
        )
        const affiliation = workspace?.affiliations.find(
          (row) => row.network.documentId === id
        )
        setMandateId(mandate ?? existing?.documentId ?? null)
        setFormInitial(
          request ?? {
            ...(mandate ? { intent: "management" as const } : {}),
            role: affiliation?.role ?? "",
            department: affiliation?.department ?? "",
            teamId: existing ? existing.teamId : teamId,
          }
        )
      } catch (failure) {
        if (sequence !== selectionRequest.current) return
        setError(
          failure instanceof Error
            ? failure.message
            : "Service scope unavailable."
        )
      } finally {
        if (sequence === selectionRequest.current) setLoading(false)
      }
    },
    [workspace, teamId]
  )
  useEffect(() => {
    let live = true
    networkRequest<Workspace>("/me")
      .then((value) => {
        if (live) setWorkspace(value)
      })
      .catch(() => {
        if (live) setError("Your service access could not be loaded.")
      })

    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (!initialNetwork || !workspace) return
    const key = `${initialNetwork}:${initialRequestId ?? ""}`
    if (initialChoice.current === key) return
    const request = workspace.requests.find(
      (row) => row.documentId === initialRequestId
    )
    const timer = setTimeout(() => {
      initialChoice.current = key
      void choose(
        initialNetwork,
        undefined,
        request?.fields.mandateId ?? undefined,
        request?.fields
      )
    }, 0)

    return () => clearTimeout(timer)
  }, [initialNetwork, initialRequestId, workspace, choose])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
      <div className="space-y-6">
        <StaffPanel title="Find your institution" compact>
          <p className="mb-5 text-sm text-(--t-ink-dim)">
            Connect your work with a library service or network. Choose an
            institution to verify your affiliation or request management access.
          </p>
          <NetworkPicker
            onSelect={(row) => {
              void choose(row.documentId)
            }}
          />
        </StaffPanel>
        {error ? (
          <div role="alert">
            <Notice
              title="Service unavailable"
              tone="warn"
              icon="mdi:alert-circle-outline"
            >
              {error}
            </Notice>
          </div>
        ) : null}
        {loading ? (
          <p
            role="status"
            className="rounded-2xl bg-(--t-bg-muted) p-5 text-sm"
          >
            Loading service libraries…
          </p>
        ) : null}
        {detail && !loading ? (
          <StaffPanel title={detail.network.name}>
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge
                color="aurora"
                label={`${ids.length} published ${ids.length === 1 ? "library" : "libraries"}`}
              />
              <Badge color="dim" label="Evidence stays private" />
            </div>
            <NetworkClaimForm
              key={`${detail.network.documentId}:${mandateId ?? "new"}:${formInitial?.submittedAt ?? ""}`}
              detail={detail}
              libraryIds={ids}
              teamId={teamId}
              mandateId={mandateId}
              onSaved={refresh}
              initialRequest={formInitial}
            />
          </StaffPanel>
        ) : null}
        {workspace?.mandates.map((mandate) => (
          <NetworkMandateCard
            key={`${mandate.documentId}:${mandate.version}`}
            mandate={mandate}
            onChanged={refresh}
            onAdditions={() => {
              void choose(
                mandate.network.documentId,
                mandate.additionsAwaitingReview,
                mandate.documentId
              )
            }}
          />
        ))}
      </div>
      <aside className="space-y-6">
        <StaffPanel title="Your affiliations" compact>
          {workspace && !workspace.affiliations.length ? (
            <p className="mb-4 text-sm text-(--t-ink-dim)">
              No affiliations yet. Verified connections can appear on your
              profile when you choose to share them.
            </p>
          ) : null}
          {workspace?.affiliations.map((row) => (
            <div
              key={row.documentId}
              className="border-b border-(--t-border-line) py-4"
            >
              <h3 className="text-lg font-semibold">{row.network.name}</h3>
              <p>
                {row.role} · {reviewStatus(row.status)}
              </p>
              <p className="text-sm">
                {row.publicDisplay
                  ? "Shown on your public profile"
                  : "Private profile affiliation"}
              </p>
            </div>
          ))}
          <Link className={STAFF_LINK} href="/profile/settings">
            Manage profile affiliations
          </Link>
        </StaffPanel>
        <StaffPanel title="Grouped requests" compact>
          {workspace && !workspace.requests.length ? (
            <p className="mb-4 text-sm text-(--t-ink-dim)">
              Your service requests will appear here with their review status.
            </p>
          ) : null}
          {workspace?.requests.map((row) => (
            <div
              key={row.documentId}
              className="border-b border-(--t-border-line) py-3"
            >
              <h3 className="font-semibold">{row.fields.networkName}</h3>
              <p>
                {row.fields.intent === "employment"
                  ? "Affiliation"
                  : "Management access"}{" "}
                · {reviewStatus(row.status)} · {row.fields.libraryIds.length}{" "}
                libraries
              </p>
              {row.reviewNote ? <p>{row.reviewNote}</p> : null}
              {row.status === "needs_info" ? (
                <button
                  type="button"
                  className={STAFF_LINK}
                  onClick={() => {
                    void choose(
                      row.fields.networkId,
                      undefined,
                      row.fields.mandateId ?? undefined,
                      row.fields
                    )
                  }}
                >
                  Update and resubmit this request
                </button>
              ) : null}
            </div>
          ))}
          <Link className={STAFF_LINK} href="/contribute/submissions">
            Your submissions
          </Link>
        </StaffPanel>
        <StaffPanel title="How access works" compact>
          <ul className="m-0 list-none space-y-5 p-0">
            {[
              {
                icon: "mdi:account-check-outline",
                title: "Affiliation",
                text: "Verifies your connection to an institution.",
              },
              {
                icon: "mdi:shield-check-outline",
                title: "Library management",
                text: "Grants access to specific library records after review. New additions are reviewed together as a batch.",
              },
              {
                icon: "mdi:account-group-outline",
                title: "Team membership",
                text: "Enables shared workspaces and widgets. Public maps can follow a service as its membership changes.",
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <Icon
                  aria-hidden
                  icon={item.icon}
                  width={20}
                  className="mt-1 shrink-0 text-(--t-accent-primary)"
                />
                <div>
                  <strong className="text-sm">{item.title}</strong>
                  <p className="mt-1 text-sm leading-relaxed text-(--t-ink-dim)">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </StaffPanel>
      </aside>
    </div>
  )
}
