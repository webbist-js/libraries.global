"use client"
import type { NetworkClaimSnapshot } from "@repo/shared-data"
import { useEffect, useState, useRef, useCallback } from "react"

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
        <StaffPanel title="Your service or network">
          <NetworkPicker
            onSelect={(row) => {
              void choose(row.documentId)
            }}
          />
        </StaffPanel>
        {error ? <p role="alert">{error}</p> : null}
        {detail ? (
          <StaffPanel title={detail.network.name}>
            <p>{ids.length} published libraries available for this request.</p>
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
      <div className="space-y-6">
        <StaffPanel title="Network affiliations">
          {workspace?.affiliations.map((row) => (
            <div
              key={row.documentId}
              className="border-b border-(--t-border-line) py-4"
            >
              <h3 className="text-lg font-semibold">{row.network.name}</h3>
              <p>
                {row.role} · {row.status}
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
        <StaffPanel title="Grouped requests">
          {workspace?.requests.map((row) => (
            <div
              key={row.documentId}
              className="border-b border-(--t-border-line) py-3"
            >
              <h3 className="font-semibold">{row.fields.networkName}</h3>
              <p>
                {row.fields.intent} · {row.status} ·{" "}
                {row.fields.libraryIds.length} libraries
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
        <StaffPanel title="Different kinds of access">
          <p>
            Affiliation verifies your connection to an institution. A management
            request reviews a fixed list of library records. A Team subscription
            enables collaboration and widgets.
          </p>
          <p>
            New libraries can appear on live public widgets before staff access
            is reviewed. Approve new additions as one batch here.
          </p>
        </StaffPanel>
      </div>
    </div>
  )
}
