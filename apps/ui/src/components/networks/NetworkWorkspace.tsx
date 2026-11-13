"use client"

import { Icon } from "@iconify/react"
import type { NetworkClaimSnapshot } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useEffect, useState, useRef, useCallback } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { SidebarLinks } from "@/components/ds/SidebarLinks"
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
        {!workspace && !error ? (
          <p role="status" className="text-(--t-ink-dim)">
            {tStatic("network.loading_your_service_access")}
          </p>
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
        {workspace?.requests.length ? (
          <StaffPanel
            title={tStatic("network.service_access_requests")}
            compact
          >
            {workspace?.requests.map((row) => (
              <div
                key={row.documentId}
                className="border-b border-(--t-border-line) py-3"
              >
                <h3 className="type-h3">{row.fields.networkName}</h3>
                <p>
                  {row.fields.intent === "employment"
                    ? tExisting("ui.affiliation")
                    : "Management access"}{" "}
                  · {reviewStatus(row.status)} · {row.fields.libraryIds.length}{" "}
                  {tExisting("widgetPublic.libraries_lower")}
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
                    {tStatic("network.update_and_resubmit_this_request")}
                  </button>
                ) : null}
              </div>
            ))}
            <SidebarLinks flushEnd>
              <li>
                <Link className={STAFF_LINK} href="/contribute/submissions">
                  {tExisting("ui.your_submissions")}
                </Link>
              </li>
            </SidebarLinks>
          </StaffPanel>
        ) : null}
        <StaffPanel
          title={
            workspace &&
            (workspace.affiliations.length ||
              workspace.mandates.length ||
              workspace.requests.length)
              ? "Find another service or network"
              : tExisting("staticUi.libraryEditor.find_your_service_or_network")
          }
          compact
        >
          <div className="grid gap-5">
            <p className="m-0 max-w-[66ch] text-sm leading-relaxed text-(--t-ink-dim)">
              {tStatic(
                "network.connect_your_work_with_a_library_service_or_network_choose_an_institution_to_verify_your_affiliation"
              )}
            </p>
            <NetworkPicker
              onSelect={(row) => {
                void choose(row.documentId)
              }}
            />
          </div>
        </StaffPanel>
        {error ? (
          <div role="alert">
            <Notice
              title={tStatic("network.service_unavailable")}
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
            {tStatic("network.loading_service_libraries")}
          </p>
        ) : null}
        {detail && !loading ? (
          <StaffPanel title={detail.network.name}>
            <div className="mb-5 flex flex-wrap gap-2">
              <Badge
                color="aurora"
                label={`${ids.length} published ${ids.length === 1 ? "library" : "libraries"}`}
              />
              <Badge
                color="dim"
                label={tStatic("network.evidence_stays_private")}
              />
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
      </div>
      <aside className="space-y-6">
        <StaffPanel title={tStatic("network.your_affiliations")} compact>
          <p className="mt-0 text-sm text-(--t-ink-dim)">
            {tStatic(
              "network.affiliation_verifies_where_you_work_management_access_is_reviewed_separately"
            )}
          </p>
          {workspace && !workspace.affiliations.length ? (
            <p className="mb-4 text-base text-(--t-ink-dim)">
              {tStatic(
                "network.no_affiliations_yet_verified_connections_can_appear_on_your_profile_when_you_choose_to_share_them"
              )}
            </p>
          ) : null}
          {workspace?.affiliations.map((row) => (
            <div
              key={row.documentId}
              className="border-b border-(--t-border-line) py-4"
            >
              <h3 className="type-h3">{row.network.name}</h3>
              <p>
                {row.role} · {reviewStatus(row.status)}
              </p>
              <p className="text-base">
                {row.publicDisplay
                  ? tExisting(
                      "staticUi.profileRoute.shown_on_your_public_profile"
                    )
                  : "Private profile affiliation"}
              </p>
            </div>
          ))}
          <SidebarLinks flushEnd>
            <li>
              <Link className={STAFF_LINK} href="/profile/settings">
                {tStatic("network.manage_profile_affiliations")}
              </Link>
            </li>
          </SidebarLinks>
        </StaffPanel>
        <details className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
          <summary className="min-h-11 cursor-pointer font-semibold text-(--t-ink-base)">
            {tExisting("accessLocks.howAccessWorks")}
          </summary>
          <ul className="m-0 mt-4 list-none space-y-5 p-0">
            {[
              {
                icon: "mdi:account-check-outline",
                title: tExisting("ui.affiliation"),
                text: tStatic(
                  "network.verifies_your_connection_to_an_institution"
                ),
              },
              {
                icon: "mdi:shield-check-outline",
                title: tStatic("network.library_management"),
                text: tStatic(
                  "network.grants_access_to_specific_library_records_after_review_new_additions_are_reviewed_together_as_a_batc"
                ),
              },
              {
                icon: "mdi:account-group-outline",
                title: tStatic("network.team_membership"),
                text: tStatic(
                  "network.enables_shared_workspaces_and_widgets_public_maps_can_follow_a_service_as_its_membership_changes"
                ),
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
                  <p className="mt-1 text-base leading-relaxed text-(--t-ink-dim)">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  )
}
