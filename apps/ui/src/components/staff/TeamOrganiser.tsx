"use client"

import { Icon } from "@iconify/react"
import type { StaffRole } from "@repo/access"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { Avatar, Badge, Notice, SegmentedControl, Sheet } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
import { TeamNetworkConnection } from "@/components/networks/TeamNetworkConnection"
import { LibraryAccessBadge } from "@/components/staff/LibraryAccessBadge"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { TeamStatusBadges } from "@/components/staff/TeamStatusBadges"
import { Button } from "@/components/ui/button"
import { useStaff } from "@/lib/access-client"
import { CONTACT_EMAIL } from "@/lib/constants"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { staffRequest } from "@/lib/staff/client"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { TeamDetail, TeamMemberRow, TeamRole } from "@/lib/staff/types"

import { TeamConfiguration } from "./TeamConfiguration"

type Confirmation = {
  title: string
  body: string
  path: string
  method: string
  payload?: unknown
  /** Removal: the confirm button turns rust on this step only. */
  danger?: boolean
}
type Assignment = { libraryDocumentId: string; staffRole: StaffRole }

const CONTACT_LINK =
  "inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4"
const INPUT = STAFF_FIELD
const NONE = "__none__"
const SITE_TEAM_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Staff workspace")}`
const LEVELS = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Editor" },
] as const

const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))

const initialsOf = (m: TeamMemberRow) =>
  (m.name ?? m.email ?? m.emailMasked)
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?"

const Card = StaffPanel

/** Library identity and role stay readable independently of the review badge. */
function MemberLibraryAccess({
  name,
  role,
  status,
}: {
  readonly name: string
  readonly role: StaffRole
  readonly status: string
}) {
  const tExisting = useTranslations()

  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-48">
        <strong className="block text-sm wrap-anywhere">{name}</strong>
        <span className="text-sm text-(--t-ink-dim)">
          {role === "owner"
            ? tExisting("teamInvitation.owner")
            : tExisting("authorBadges.editor")}
        </span>
      </div>
      <LibraryAccessBadge status={status} />
    </li>
  )
}

/**
 * The staff workspace page body: the libraries covered, the members list
 * with each person's library access and review states, invites and removal.
 * The workspace is free; membership never grants library editing, which
 * comes only from each person's own verified staff claims.
 * An organiser changes a member's libraries and levels in one sheet,
 * "Libraries for {name}", saved as a single request. Members (not
 * organisers) get the same view read only.
 */
export function TeamOrganiser({ team }: { readonly team: TeamDetail }) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  const router = useRouter()
  const locale = useLocale()
  const date = (iso: string) => formatDate(iso, locale)
  const { libraries: mine } = useStaff()
  const organiser = team.viewerRole === "organiser"
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<TeamRole>("member")
  const [inviteLibrary, setInviteLibrary] = useState(NONE)
  const [inviteLevel, setInviteLevel] = useState<StaffRole>("editor")
  // The "Libraries for {name}" sheet: a staged copy of one member's
  // assignments, saved in one request.
  const [assigning, setAssigning] = useState<TeamMemberRow | null>(null)
  const [draft, setDraft] = useState<Assignment[]>([])
  const [addLibrary, setAddLibrary] = useState("")
  const [addLevel, setAddLevel] = useState<StaffRole>("editor")
  const base = `/api/staff/team/${team.documentId}`
  const staffOf = new Set(mine.map((l) => l.id))
  const libraryName = (id: string) =>
    team.libraries.find((l) => l.documentId === id)?.name ??
    tExisting("ui.library")
  // Free workspaces never lapse for payment; only a closed row reads as inactive.
  const active = team.status !== "lapsed"

  async function request(
    path: string,
    method: string,
    payload?: unknown,
    saved = "Saved."
  ): Promise<{ ok: boolean; body: unknown }> {
    setBusy(true)
    setError("")
    setStatus("")
    try {
      const body = await staffRequest(path, method, payload)
      setStatus(saved)
      setConfirm(null)
      router.refresh()

      return { ok: true, body }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")

      return { ok: false, body: null }
    } finally {
      setBusy(false)
    }
  }

  const saveAssignments = (member: TeamMemberRow, next: Assignment[]) =>
    request(`${base}/members/${member.documentId}`, "PUT", {
      assignments: next,
    })

  const assignmentsOf = (member: TeamMemberRow): Assignment[] =>
    member.status === "active"
      ? member.assignments.map((a) => ({
          libraryDocumentId: a.libraryDocumentId,
          staffRole: a.staffRole,
        }))
      : member.preassign
        ? [member.preassign]
        : []
  const memberName = (m: TeamMemberRow) => m.name ?? m.email ?? m.emailMasked
  const openAssign = (member: TeamMemberRow) => {
    setDraft(assignmentsOf(member))
    setAddLibrary("")
    setAddLevel("editor")
    setAssigning(member)
  }
  const draftFree = team.libraries.filter(
    (l) => !draft.some((a) => a.libraryDocumentId === l.documentId)
  )
  const draftDirty =
    !!assigning &&
    JSON.stringify(draft) !== JSON.stringify(assignmentsOf(assigning))
  // An invite carries one pre-assignment; an active member any number.
  const canAddToDraft =
    !!assigning &&
    draftFree.length > 0 &&
    (assigning.status === "active" || draft.length === 0)

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
      {status.startsWith("Invite created") ? (
        <Notice
          icon="mdi:email-alert-outline"
          tone="warn"
          title={tUi("invite_created_but_email_isnt_configured")}
        >
          <span style={{ color: T.ink.base }}>
            {tStatic(
              "staff.the_invite_shows_below_nobody_was_emailed_the_site_team_needs_to_configure_email_before_invites_can_"
            )}
          </span>
        </Notice>
      ) : null}
      {error ? (
        <Notice
          icon="mdi:alert-circle-outline"
          tone="warn"
          title={tUi("not_saved")}
        >
          <span role="alert">{error}</span>
        </Notice>
      ) : null}
      {!active ? (
        <Notice
          icon="mdi:pause-circle-outline"
          tone="warn"
          title={tUi("this_team_isnt_active")}
        >
          {tStatic(
            "staff.the_site_team_has_closed_this_workspace_so_invitations_and_shared_tools_are_paused_each_person_s_own"
          )}{" "}
          <a href={SITE_TEAM_HREF} className={CONTACT_LINK}>
            {tStatic("common.contactSiteTeam")}
          </a>
        </Notice>
      ) : null}

      {team.serviceScopes?.map((scope) => (
        <Notice
          key={scope.networkId}
          tone="ok"
          icon="mdi:shield-check-outline"
          title={scope.name}
        >
          <p>
            {scope.approvedLibraryIds.length} libraries approved for service
            access · {scope.ownerLibraryIds.length} support staff delegation.{" "}
            <a
              href={`/staff/networks?network=${scope.networkId}`}
              className={CONTACT_LINK}
            >
              {tStatic("staff.open_service_management")}
            </a>
          </p>
        </Notice>
      ))}
      {!team.verifiedAt ? (
        <Notice
          tone="warn"
          icon="mdi:clock-outline"
          title={tStatic("staff.some_library_assignments_need_review")}
        >
          {tStatic(
            "staff.assignments_need_moderator_review_unless_they_are_covered_by_an_approved_service_delegation"
          )}{" "}
          <a href={SITE_TEAM_HREF} className={CONTACT_LINK}>
            {tStatic("common.contactSiteTeam")}
          </a>
        </Notice>
      ) : null}
      <TeamNetworkConnection team={team} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card
            id="team-members"
            title={tStatic("staff.members")}
            aside={
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm text-(--t-ink-dim)">
                  {team.members.length}{" "}
                  {team.members.length === 1 ? "person" : "people"}
                </span>
                {organiser ? (
                  <Link href="#team-invite" className={CONTACT_LINK}>
                    {tExisting("ui.invite_a_colleague")}
                  </Link>
                ) : null}
              </div>
            }
          >
            <ul
              className="m-0 list-none divide-y p-0"
              style={{ borderColor: T.border.divider }}
            >
              {team.members.map((member, index) => {
                const current = assignmentsOf(member)

                return (
                  <li
                    key={member.documentId}
                    className="py-5 first:pt-0 last:pb-0"
                    style={{ borderColor: T.border.divider }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          initials={initialsOf(member)}
                          index={index}
                          size="lg"
                          title={member.name ?? undefined}
                          variant="tint"
                        />
                        <div className="min-w-0 [overflow-wrap:anywhere]">
                          <p
                            className="m-0 font-semibold"
                            style={{ color: T.ink.base }}
                          >
                            {member.name ?? member.email ?? member.emailMasked}
                            {member.isYou ? (
                              <span style={{ color: T.ink.dim }}>
                                {" "}
                                {tStatic("common.youSuffix")}
                              </span>
                            ) : null}
                          </p>
                          <p
                            className="m-0 text-sm"
                            style={{ color: T.ink.dim }}
                          >
                            {organiser ? member.email : member.emailMasked}
                            {member.status === "active"
                              ? member.acceptedAt
                                ? ` · joined ${date(member.acceptedAt)}`
                                : ""
                              : member.invitedAt
                                ? ` · invited ${date(member.invitedAt)}`
                                : " · invited"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          label={
                            member.status === "active"
                              ? tExisting("membershipPage.apiActive")
                              : tUi("invited")
                          }
                          color={member.status === "active" ? "ok" : "warn"}
                          dot
                        />
                        {organiser && !member.isYou ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="sr-only">
                              Team role for {member.name ?? member.email}
                            </span>
                            <SelectField
                              label={`Team role for ${member.name ?? member.email}`}
                              value={member.teamRole}
                              disabled={busy}
                              onValueChange={(value) =>
                                setConfirm({
                                  title:
                                    value === "organiser"
                                      ? `Make ${member.name ?? member.email} an organiser?`
                                      : `Make ${member.name ?? member.email} a member?`,
                                  body:
                                    value === "organiser"
                                      ? "Organisers invite colleagues, assign them to libraries and can remove anyone from the team."
                                      : "Members keep their library access, but can’t change the team.",
                                  path: `${base}/members/${member.documentId}`,
                                  method: "PUT",
                                  payload: { teamRole: value },
                                })
                              }
                              options={[
                                {
                                  value: "member",
                                  label: tExisting("teamInvitation.member"),
                                },
                                {
                                  value: "organiser",
                                  label: tExisting("teamInvitation.organiser"),
                                },
                              ]}
                            />
                          </div>
                        ) : (
                          <Badge
                            label={
                              member.teamRole === "organiser"
                                ? tExisting("teamInvitation.organiser")
                                : tExisting("teamInvitation.member")
                            }
                            color="dim"
                          />
                        )}
                        {organiser && member.status === "invited" ? (
                          <>
                            <Button
                              type="button"
                              variant="surface"
                              size="pill"
                              style={{ borderColor: T.border.hi }}
                              disabled={busy}
                              onClick={() =>
                                void request(
                                  `${base}/invites/${member.documentId}/resend`,
                                  "POST"
                                )
                              }
                            >
                              {tStatic("staff.resend")}
                            </Button>
                            <Button
                              type="button"
                              variant="surface"
                              size="pill"
                              style={{ borderColor: T.border.hi }}
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: `Revoke the invite for ${member.email}?`,
                                  body: "Their invitation link stops working.",
                                  path: `${base}/invites/${member.documentId}`,
                                  method: "DELETE",
                                })
                              }
                            >
                              {tStatic("common.revoke")}
                            </Button>
                          </>
                        ) : null}
                        {organiser &&
                        member.status === "active" &&
                        !member.isYou ? (
                          <Button
                            type="button"
                            variant="link"
                            size="pill"
                            className="px-0 text-(--t-ink-dim) underline"
                            style={{ color: T.ink.dim }}
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                title: `Remove ${member.name ?? member.email} from ${team.name}?`,
                                body: "They leave the workspace and lose the library assignments it gave them. Staff access they claimed themselves is kept. They’re emailed for each library.",
                                path: `${base}/members/${member.documentId}`,
                                method: "DELETE",
                                danger: true,
                              })
                            }
                          >
                            {tUi("remove")}{" "}
                            <span className="sr-only">
                              {" "}
                              {memberName(member)} from the team
                            </span>
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {current.length || member.pending.length ? (
                        <ul
                          aria-label={`Library access for ${memberName(member)}`}
                          className="m-0 w-full list-none divide-y divide-(--t-border-line) p-0"
                        >
                          {current.map((assignment) => (
                            <MemberLibraryAccess
                              key={assignment.libraryDocumentId}
                              name={libraryName(assignment.libraryDocumentId)}
                              role={assignment.staffRole}
                              status={
                                member.status === "invited"
                                  ? "invited"
                                  : "approved"
                              }
                            />
                          ))}
                          {member.pending.map((request) => (
                            <MemberLibraryAccess
                              key={request.submissionDocumentId}
                              name={libraryName(request.libraryDocumentId)}
                              role={request.staffRole}
                              status={request.status}
                            />
                          ))}
                        </ul>
                      ) : null}
                      {current.length === 0 && member.pending.length === 0 ? (
                        <span className="text-sm" style={{ color: T.ink.dim }}>
                          {tStatic("staff.no_libraries_yet")}
                        </span>
                      ) : null}
                      {organiser && team.libraries.length > 0 ? (
                        <Button
                          type="button"
                          variant="surface"
                          size="pill"
                          style={{ borderColor: T.border.hi }}
                          disabled={busy}
                          onClick={() => openAssign(member)}
                        >
                          <Icon
                            aria-hidden="true"
                            icon={
                              current.length ? "mdi:pencil-outline" : "mdi:plus"
                            }
                            width={14}
                            height={14}
                          />
                          {current.length
                            ? "Change libraries"
                            : "Assign to a library"}
                          <span className="sr-only">
                            {" "}
                            for {memberName(member)}
                          </span>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            {!organiser ? (
              <p className="mt-4 mb-0 text-sm" style={{ color: T.ink.dim }}>
                Ask {team.organiserNames.join(" or ") || "your organiser"} to
                change your access.
              </p>
            ) : null}
          </Card>

          <Card
            id="team-libraries"
            title={tStatic("staff.libraries_covered")}
            footer={
              organiser && team.libraries.length > 0 ? (
                <TeamConfiguration
                  team={team}
                  label={tStatic("staff.manage_libraries")}
                />
              ) : undefined
            }
            aside={
              <span className="text-sm text-(--t-ink-dim)">
                {team.libraries.length}
              </span>
            }
          >
            <p className="mt-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {tStatic(
                "staff.the_libraries_this_workspace_looks_after_each_person_s_library_staff_access_is_assigned_and_checked_"
              )}
            </p>
            {team.libraries.length ? (
              <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                {team.libraries.map((lib) => {
                  const tint = tintForLibraryType(lib.libraryType)
                  const staff = staffOf.has(lib.documentId)
                  const pending = team.members
                    .find((member) => member.isYou)
                    ?.pending.find(
                      (request) => request.libraryDocumentId === lib.documentId
                    )

                  return (
                    <li
                      key={lib.documentId}
                      className="flex flex-col gap-2 rounded-2xl border p-4"
                      style={{
                        borderColor: T.border.line,
                        background: T.bg.surface,
                      }}
                    >
                      <span
                        className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold"
                        style={{ background: tint.bg, color: tint.fg }}
                      >
                        {lib.libraryType === "Mobile"
                          ? tStatic("common.mobileLibrary")
                          : `${lib.libraryType} library`}
                      </span>
                      <strong className="text-base font-semibold">
                        {lib.name}
                      </strong>
                      {staff ? (
                        <Link
                          href={staffLibraryHref(lib.slug)}
                          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-[3px]"
                          style={{ color: T.accent.primary }}
                        >
                          {tStatic("common.openStaffArea")}
                        </Link>
                      ) : pending ? (
                        <LibraryAccessBadge status={pending.status} />
                      ) : (
                        <span className="text-sm" style={{ color: T.ink.dim }}>
                          {tStatic("staff.you_re_not_assigned_here")}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-(--t-border-hi) p-4">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--t-bg-space) text-(--t-ink-dim)">
                  <Icon aria-hidden="true" icon="mdi:bank-outline" width={22} />
                </span>
                <p className="m-0 min-w-0 flex-1 basis-48 text-base leading-relaxed text-(--t-ink-dim)">
                  <strong className="text-(--t-ink-base)">
                    {tStatic("staff.no_libraries_yetsentence")}
                  </strong>{" "}
                  {organiser
                    ? "Choose the libraries your workspace covers, then assign members. Staff authority is checked separately."
                    : "Your organiser can add libraries and assign your access."}
                </p>
                {organiser ? (
                  <TeamConfiguration
                    team={team}
                    label={tStatic("staff.add_libraries")}
                  />
                ) : null}
              </div>
            )}
          </Card>
        </div>
        <aside className="min-w-0 space-y-6">
          <Card
            compact
            title={tExisting("staffWorkspace.teamDetails")}
            footer={organiser ? <TeamConfiguration team={team} /> : undefined}
            aside={
              <TeamStatusBadges
                workspace={active ? "open" : "closed"}
                verified={Boolean(team.verifiedAt)}
              />
            }
          >
            <dl className="m-0 grid gap-4">
              <div>
                <dt
                  className="text-sm font-semibold"
                  style={{ color: T.ink.dim }}
                >
                  {tStatic("staff.members")}
                </dt>
                <dd className="m-0 text-base tabular-nums">
                  {team.members.filter((m) => m.status === "active").length}{" "}
                  active ·{" "}
                  {team.members.filter((m) => m.status === "invited").length}{" "}
                  invited
                </dd>
              </div>
              <div>
                <dt
                  className="text-sm font-semibold"
                  style={{ color: T.ink.dim }}
                >
                  {tStatic("staff.organisers")}
                </dt>
                <dd className="m-0 text-base">
                  {team.organiserNames.join(", ") || "None yet"}
                </dd>
              </div>
            </dl>
          </Card>

          <Card compact title={tExisting("staffWorkspace.apiAccess")}>
            <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
              {tStatic(
                "staff.api_access_is_bought_separately_on_the_developers_page_it_never_grants_library_editing"
              )}
            </p>
            <Link
              href="/developers"
              className={`${CONTACT_LINK} mt-2 text-(--t-accent-primary)`}
            >
              {tExisting("featureAccess.openDevelopers")}
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
            </Link>
          </Card>

          {organiser ? (
            <Card
              id="team-invite"
              className="scroll-mt-(--sticky-content-top)"
              compact
              title={tUi("invite_a_colleague")}
            >
              {!active ? (
                <p className="m-0 text-base" style={{ color: T.ink.dim }}>
                  {tStatic(
                    "staff.invitations_are_paused_while_this_workspace_is_closed"
                  )}
                </p>
              ) : (
                <form
                  className="grid min-w-0 gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    request(
                      `${base}/invites`,
                      "POST",
                      {
                        email: inviteEmail,
                        teamRole: inviteRole,
                        ...(inviteLibrary !== NONE
                          ? {
                              preassign: {
                                libraryDocumentId: inviteLibrary,
                                staffRole: inviteLevel,
                              },
                            }
                          : {}),
                      },
                      "Invite sent."
                    ).then(({ ok, body }) => {
                      if (!ok) return
                      setInviteEmail("")
                      setInviteLibrary(NONE)
                      const sent = (body as { emailSent?: boolean } | null)
                        ?.emailSent
                      if (sent === false)
                        setStatus(
                          "Invite created, but email isn’t configured: send them the link from the Resend action once it is."
                        )
                    })
                  }}
                >
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    {tUi("email")}{" "}
                    <input
                      type="email"
                      required
                      autoComplete="off"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      className={INPUT}
                      style={{ borderColor: T.border.hi }}
                      maxLength={254}
                      placeholder="colleague@library.example"
                    />
                  </label>
                  <div className="flex flex-col gap-2 text-sm font-semibold">
                    <span>{tStatic("staff.team_role")}</span>
                    <SelectField
                      label={tStatic("staff.team_role")}
                      value={inviteRole}
                      disabled={busy}
                      onValueChange={(value) =>
                        setInviteRole(
                          value === "organiser" ? "organiser" : "member"
                        )
                      }
                      options={[
                        {
                          value: "member",
                          label: tExisting("teamInvitation.member"),
                        },
                        {
                          value: "organiser",
                          label: tStatic(
                            "staff.organiser_can_manage_this_team"
                          ),
                        },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-2 text-sm font-semibold">
                    <span>{tStatic("staff.give_access_to_optional")}</span>
                    <SelectField
                      label={tStatic("staff.give_access_to_optional")}
                      value={inviteLibrary}
                      disabled={busy}
                      onValueChange={setInviteLibrary}
                      options={[
                        { value: NONE, label: tStatic("staff.no_library_yet") },
                        ...team.libraries.map((library) => ({
                          value: library.documentId,
                          label: library.name,
                        })),
                      ]}
                    />
                  </div>
                  {inviteLibrary !== NONE ? (
                    <div className="flex flex-col gap-2 text-sm font-semibold">
                      {tStatic("common.level")}
                      <SegmentedControl
                        label={tUi("level_at_the_library")}
                        options={LEVELS}
                        value={inviteLevel}
                        onChange={setInviteLevel}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <Button
                      type="submit"
                      variant="primary"
                      size="pill"
                      disabled={busy || !inviteEmail}
                    >
                      <Icon
                        aria-hidden="true"
                        icon="mdi:email-fast-outline"
                        width={16}
                        height={16}
                      />
                      {tStatic("common.sendInvite")}
                    </Button>
                    <p
                      className="mt-3 mb-0 text-base"
                      style={{ color: T.ink.dim }}
                    >
                      {tStatic(
                        "staff.they_sign_in_with_that_email_and_accept_the_link_within_14_days_library_editing_still_needs_verified"
                      )}
                    </p>
                  </div>
                </form>
              )}
            </Card>
          ) : null}
        </aside>
      </div>
      <Sheet
        open={assigning !== null}
        onClose={() => !busy && setAssigning(null)}
        side="right"
        title={
          assigning
            ? `Libraries for ${memberName(assigning)}`
            : tUi("libraries")
        }
        footer={
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              size="pill"
              disabled={busy || !draftDirty}
              onClick={() => {
                if (!assigning) return
                saveAssignments(assigning, draft).then(({ ok }) => {
                  if (ok) setAssigning(null)
                })
              }}
            >
              {tUi("save_changes")}{" "}
            </Button>
            <Button
              type="button"
              variant="surface"
              size="pill"
              style={{ borderColor: T.border.hi }}
              disabled={busy}
              onClick={() => setAssigning(null)}
            >
              {tUi("cancel")}{" "}
            </Button>
          </div>
        }
      >
        <p className="m-0 mb-4 text-base" style={{ color: T.ink.dim }}>
          Staff access at each library below, at the chosen level. Owners manage
          the staff list, live sharing and notices; editors keep the record,
          hours and notices up to date. Changes apply when you save
          {assigning?.status === "invited"
            ? ", and take effect when they accept"
            : ""}
          .
        </p>
        {draft.length ? (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {draft.map((a) => (
              <li
                key={a.libraryDocumentId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border p-3"
                style={{ borderColor: T.border.line, background: T.bg.deep }}
              >
                <strong className="min-w-0 flex-1 text-base">
                  {libraryName(a.libraryDocumentId)}
                </strong>
                <SegmentedControl
                  label={`Level at ${libraryName(a.libraryDocumentId)}`}
                  options={LEVELS}
                  value={a.staffRole}
                  onChange={(staffRole) =>
                    setDraft((all) =>
                      all.map((x) =>
                        x.libraryDocumentId === a.libraryDocumentId
                          ? { ...x, staffRole }
                          : x
                      )
                    )
                  }
                />
                <Button
                  type="button"
                  variant="link"
                  size="pill"
                  className="px-0 text-(--t-ink-dim) underline"
                  style={{ color: T.ink.dim }}
                  onClick={() =>
                    setDraft((all) =>
                      all.filter(
                        (x) => x.libraryDocumentId !== a.libraryDocumentId
                      )
                    )
                  }
                >
                  {tUi("remove")}{" "}
                  <span className="sr-only">
                    {" "}
                    {libraryName(a.libraryDocumentId)}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
            {tStatic("staff.no_libraries_yetsentence")}
          </p>
        )}
        {canAddToDraft ? (
          <div
            className="mt-5 flex flex-col gap-3 rounded-[14px] border border-dashed p-4"
            style={{ borderColor: T.border.hi }}
          >
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {tUi("add_a_library")}
              <SelectField
                value={String(addLibrary ?? "")}
                className={INPUT}
                style={{ borderColor: T.border.hi }}
                onValueChange={(selectedValue) => setAddLibrary(selectedValue)}
                options={[
                  { value: "", label: tStatic("staff.choose_a_library") },
                  ...draftFree.map((l) => ({
                    value: String(l.documentId),
                    label: String(l.name),
                  })),
                ]}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                label={tUi("level_at_the_library")}
                options={LEVELS}
                value={addLevel}
                onChange={setAddLevel}
              />
              <Button
                type="button"
                variant="surface"
                size="pill"
                style={{ borderColor: T.border.hi }}
                disabled={!addLibrary}
                onClick={() => {
                  if (!addLibrary) return
                  setDraft((all) => [
                    ...all,
                    { libraryDocumentId: addLibrary, staffRole: addLevel },
                  ])
                  setAddLibrary("")
                  setAddLevel("editor")
                }}
              >
                <Icon
                  aria-hidden="true"
                  icon="mdi:plus"
                  width={14}
                  height={14}
                />
                {tUi("add")}{" "}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        side="bottom"
        title={confirm?.title ?? tStatic("common.confirm")}
      >
        <p className="m-0 mb-5" style={{ color: T.ink.dim }}>
          {confirm?.body}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            size="pill"
            style={
              confirm?.danger ? { background: T.action.danger } : undefined
            }
            disabled={busy}
            onClick={() => {
              if (confirm)
                void request(confirm.path, confirm.method, confirm.payload)
            }}
          >
            {confirm?.danger ? "Yes, go ahead" : tStatic("common.confirm")}
          </Button>
          <Button
            type="button"
            variant="surface"
            size="pill"
            style={{ borderColor: T.border.hi }}
            onClick={() => setConfirm(null)}
          >
            {tUi("cancel")}{" "}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-4" style={{ color: T.accent.danger }}>
            {error}
          </p>
        ) : null}
      </Sheet>
    </div>
  )
}
