"use client"
import type { NetworkClaimSnapshot } from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { ChoiceCard } from "@/components/ds/ChoiceCard"
import { Notice } from "@/components/ds/Notice"
import { SelectField } from "@/components/ds/SelectField"
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
  const [staffRole, setStaffRole] = useState(
    initialRequest?.staffRole ?? "editor"
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
          failure instanceof Error
            ? failure.message
            : tExisting("apiIndividualCheckout.retry")
        )
      }
    })
  }
  if (done)
    return (
      <div role="status">
        <Notice
          tone="info"
          icon="mdi:check-circle-outline"
          title={tStatic("network.request_sent_for_review")}
        >
          {tStatic(
            "network.follow_its_progress_in_grouped_requests_or_your_submissions_we_ll_let_you_know_if_more_information_i"
          )}
        </Notice>
      </div>
    )

  return (
    <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending}>
        <legend className="mb-3 text-sm font-semibold">
          {tStatic("network.what_would_you_like_reviewed")}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="request-intent"
            value="employment"
            checked={!management}
            onChange={() => setIntent("employment")}
            icon="mdi:account-check-outline"
            tint={{ bg: "var(--t-accent-chip)", fg: "var(--t-accent-primary)" }}
            title={tStatic("network.verify_my_affiliation")}
            hint={tStatic(
              "network.confirm_that_you_work_for_this_service_or_network"
            )}
          />
          {detail.network.kind !== "consortium" ? (
            <ChoiceCard
              name="request-intent"
              value="management"
              checked={management}
              onChange={() => setIntent("management")}
              icon="mdi:shield-check-outline"
              tint={{
                bg: "var(--t-accent-chip)",
                fg: "var(--t-accent-primary)",
              }}
              title={tStatic("network.manage_library_records")}
              hint={tStatic(
                "network.request_staff_access_to_a_reviewed_set_of_libraries"
              )}
            />
          ) : null}
        </div>
      </fieldset>
      <p className="text-sm text-(--t-ink-dim)">
        {tStatic(
          "network.employment_verification_confirms_your_affiliation_management_approval_grants_access_only_to_the_libr"
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          {tExisting("teamInvitation.yourRole")}
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
          {tExisting("libraryClaim.department")}
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
        <div className="grid gap-2">
          <span>{tStatic("network.requested_responsibility")}</span>
          <SelectField
            label={tStatic("network.requested_responsibility")}
            name="staffRole"
            value={staffRole}
            onValueChange={(value) =>
              setStaffRole(value === "owner" ? "owner" : "editor")
            }
            options={[
              {
                value: "editor",
                label: tStatic("network.edit_these_library_records"),
              },
              {
                value: "owner",
                label: tStatic(
                  "network.manage_staff_and_delegate_access_as_an_owner"
                ),
              },
            ]}
            disabled={pending}
          />
          <span className="text-sm text-(--t-ink-dim)">
            {tStatic(
              "network.editor_access_is_the_default_owner_responsibility_requires_an_explicit_moderator_decision_and_reason"
            )}
          </span>
        </div>
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
        {tStatic("network.evidence_url_optional")}
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
        {tStatic("network.explain_your_relationship_and_requested_authority")}
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
              className="size-4 accent-(--t-accent-primary)"
              checked={attachTeam}
              onChange={(event) => setAttachTeam(event.target.checked)}
              disabled={pending || Boolean(mandateId)}
            />
            {tStatic(
              "network.connect_the_approved_delegation_scope_to_my_team"
            )}
          </label>
          <p>
            {tStatic(
              "network.approved_management_can_support_assignments_from_your_team_within_the_reviewed_scope_payment_does_no"
            )}
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
        size="pill"
        disabled={pending || (management && !selected.length)}
      >
        {pending ? tExisting("ui.sending") : "Send one request for review"}
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
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

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
      <legend>{tStatic("network.reviewed_library_scope")}</legend>
      <p>
        {selected.length} {tExisting("widgetPublic.of")} {libraryIds.length}{" "}
        published libraries selected. Later additions require a new batch
        review.
      </p>
      <div className="flex gap-3">
        <Button
          variant="surface"
          type="button"
          onClick={() => setSelected(libraryIds)}
        >
          {tStatic("network.select_all")}
        </Button>
        <Button variant="surface" type="button" onClick={() => setSelected([])}>
          {tExisting("atlasNetwork.clearService")}
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
                  className="size-4 accent-(--t-accent-primary)"
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
          {tStatic("network.previous_libraries")}
        </Button>
        <Button
          variant="surface"
          type="button"
          disabled={page.page * page.pageSize >= detail.network.libraryCount}
          onClick={() => changePage(page.page + 1)}
        >
          {tExisting("ui.more_libraries")}
        </Button>
      </div>
    </fieldset>
  )
}
