"use client"

import { Icon } from "@iconify/react"
import type { StaffRole } from "@repo/access"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useState } from "react"

import { Avatar, Badge, Notice, SegmentedControl, Sheet } from "@/components/ds"
import { useStaff } from "@/lib/access-client"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { TEAM_CONTACT_HREF } from "@/lib/plans"
import { staffRequest } from "@/lib/staff/client"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { TeamDetail, TeamMemberRow, TeamRole } from "@/lib/staff/types"

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

const PILL =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface) disabled:opacity-50"
const SMALL_PILL =
  "inline-flex min-h-11 items-center justify-center gap-1 rounded-full border bg-white px-3.5 text-[13px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-50"
const CONTACT_LINK =
  "inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-(--t-accent-primary) px-5 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover) disabled:opacity-50"
const INPUT =
  "min-h-11 rounded-[14px] border bg-(--t-bg-surface) px-3 text-[15px] font-normal"
const QUIET_LINK =
  "inline-flex min-h-11 items-center text-[13.5px] font-semibold underline underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50"
const NONE = "__none__"
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

function Card({
  title,
  aside,
  children,
}: {
  readonly title: string
  readonly aside?: React.ReactNode
  readonly children: React.ReactNode
}) {
  return (
    <section
      className="rounded-[20px] border p-6 sm:p-8"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="m-0 text-[24px]"
          style={{ fontFamily: T.font.serif, color: T.ink.base }}
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * The Team organiser's page body: seats, the libraries covered, the
 * members list with each person's libraries as chips, invites and removal.
 * An organiser changes a member's libraries and levels in one sheet,
 * "Libraries for {name}", saved as a single request. Members (not
 * organisers) get the same view read only.
 */
export function TeamOrganiser({
  team,
  others,
}: {
  readonly team: TeamDetail
  readonly others: { id: string; name: string }[]
}) {
  const tUi = useUiTranslations("ui")

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
    team.libraries.find((l) => l.documentId === id)?.name ?? "Library"
  const seatsLeft = Math.max(0, team.seats - team.used)
  const active =
    team.status === "active" &&
    (!team.expiresAt || Date.parse(team.expiresAt) > Date.now())

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
      <div className="flex justify-end">
        <Link href={`/staff/team/api?team=${team.documentId}`} className={PILL}>
          API access and usage
        </Link>
      </div>
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
            The seat is held and the invite shows below. Nobody was emailed: the
            site team needs to configure email before invites can be sent.
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
          {team.status === "lapsed"
            ? "It has lapsed: members keep their seats but Pro and Team features are off until it’s renewed."
            : "It has expired. Members keep their seats but Pro and Team features are off."}
        </Notice>
      ) : null}

      <Card
        title={team.name}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              label={team.verifiedAt ? "Verified team" : "Not yet verified"}
              color={team.verifiedAt ? "ok" : "warn"}
              icon={
                team.verifiedAt
                  ? "mdi:check-decagram-outline"
                  : "mdi:clock-outline"
              }
            />
            <Badge
              label={
                active
                  ? "Active"
                  : team.status === "lapsed"
                    ? "Lapsed"
                    : "Expired"
              }
              color={active ? "aurora" : "dim"}
            />
          </div>
        }
      >
        <dl className="m-0 grid gap-4 sm:grid-cols-3">
          <div>
            <dt
              className="text-[13px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Seats
            </dt>
            <dd
              className="m-0 text-[28px]"
              style={{ fontFamily: T.font.serif }}
            >
              {team.used}{" "}
              <span style={{ color: T.ink.dim, fontSize: 16 }}>
                of {team.seats}
              </span>
            </dd>
          </div>
          <div>
            <dt
              className="text-[13px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Organisers
            </dt>
            <dd className="m-0 text-[15px]">
              {team.organiserNames.join(", ") || "None yet"}
            </dd>
          </div>
          <div>
            <dt
              className="text-[13px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Runs until
            </dt>
            <dd className="m-0 text-[15px]">
              {team.expiresAt ? date(team.expiresAt) : "Open ended"}
            </dd>
          </div>
        </dl>
        {!team.verifiedAt ? (
          <p className="mt-4 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
            Until the site team verifies {team.name}, each assignment is filed
            as a claim for a moderator to check.{" "}
            <a
              href={TEAM_CONTACT_HREF}
              className={CONTACT_LINK}
              style={{ color: T.accent.primary }}
            >
              Contact the site team
            </a>
          </p>
        ) : null}
        {others.length ? (
          <p className="mt-4 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
            Your other teams:{" "}
            {others.map((t, i) => (
              <span key={t.id}>
                {i > 0 ? ", " : ""}
                <Link
                  href={`/staff/team?team=${t.id}`}
                  className="font-semibold underline"
                  style={{ color: T.accent.primary }}
                >
                  {t.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </Card>

      <Card title={`Libraries covered (${team.libraries.length})`}>
        {team.libraries.length ? (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {team.libraries.map((lib) => {
              const tint = tintForLibraryType(lib.libraryType)
              const staff = staffOf.has(lib.documentId)

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
                    className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                    style={{ background: tint.bg, color: tint.fg }}
                  >
                    {lib.libraryType === "Mobile"
                      ? "Mobile library"
                      : `${lib.libraryType} library`}
                  </span>
                  <strong className="text-[16px] font-semibold">
                    {lib.name}
                  </strong>
                  {staff ? (
                    <Link
                      href={staffLibraryHref(lib.slug)}
                      className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]"
                      style={{ color: T.accent.primary }}
                    >
                      Open Staff area
                    </Link>
                  ) : (
                    <span className="text-[13px]" style={{ color: T.ink.dim }}>
                      You’re not assigned here
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            No libraries yet. The site team adds them to the Team.
          </p>
        )}
      </Card>

      <Card title={`Members (${team.members.length})`}>
        <ul
          className="m-0 list-none divide-y p-0"
          style={{ borderColor: T.border.divider }}
        >
          {team.members.map((member, index) => {
            const current = assignmentsOf(member)

            return (
              <li
                key={member.documentId}
                className="py-5"
                style={{ borderColor: T.border.divider }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar
                      initials={initialsOf(member)}
                      index={index}
                      size="lg"
                      title={member.name ?? undefined}
                      variant="tint"
                    />
                    <div>
                      <p
                        className="m-0 font-semibold"
                        style={{ color: T.ink.base }}
                      >
                        {member.name ?? member.email ?? member.emailMasked}
                        {member.isYou ? (
                          <span style={{ color: T.ink.dim }}> (you)</span>
                        ) : null}
                      </p>
                      <p
                        className="m-0 text-[13px]"
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
                        member.status === "active" ? "Active" : tUi("invited")
                      }
                      color={member.status === "active" ? "ok" : "warn"}
                      dot
                    />
                    {organiser && !member.isYou ? (
                      <label className="flex items-center gap-2 text-[13px]">
                        <span className="sr-only">
                          Team role for {member.name ?? member.email}
                        </span>
                        <select
                          value={member.teamRole}
                          disabled={busy}
                          className={`${INPUT} text-[13px]`}
                          style={{ borderColor: T.border.hi }}
                          onChange={(event) =>
                            setConfirm({
                              title:
                                event.target.value === "organiser"
                                  ? `Make ${member.name ?? member.email} an organiser?`
                                  : `Make ${member.name ?? member.email} a member?`,
                              body:
                                event.target.value === "organiser"
                                  ? "Organisers invite colleagues, assign them to libraries and can remove anyone from the team."
                                  : "Members keep their seat and their library access, but can’t change the team.",
                              path: `${base}/members/${member.documentId}`,
                              method: "PUT",
                              payload: { teamRole: event.target.value },
                            })
                          }
                        >
                          <option value="member">Member</option>
                          <option value="organiser">Organiser</option>
                        </select>
                      </label>
                    ) : (
                      <Badge
                        label={
                          member.teamRole === "organiser"
                            ? "Organiser"
                            : "Member"
                        }
                        color="dim"
                      />
                    )}
                    {organiser && member.status === "invited" ? (
                      <>
                        <button
                          type="button"
                          className={SMALL_PILL}
                          style={{ borderColor: T.border.hi }}
                          disabled={busy}
                          onClick={() =>
                            void request(
                              `${base}/invites/${member.documentId}/resend`,
                              "POST"
                            )
                          }
                        >
                          Resend
                        </button>
                        <button
                          type="button"
                          className={SMALL_PILL}
                          style={{ borderColor: T.border.hi }}
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              title: `Revoke the invite for ${member.email}?`,
                              body: "Their link stops working and the seat is freed.",
                              path: `${base}/invites/${member.documentId}`,
                              method: "DELETE",
                            })
                          }
                        >
                          Revoke
                        </button>
                      </>
                    ) : null}
                    {organiser &&
                    member.status === "active" &&
                    !member.isYou ? (
                      <button
                        type="button"
                        className={QUIET_LINK}
                        style={{ color: T.ink.dim }}
                        disabled={busy}
                        onClick={() =>
                          setConfirm({
                            title: `Remove ${member.name ?? member.email} from ${team.name}?`,
                            body: "They lose their seat, Pro from this team and staff access at every library this team gave them. They’re emailed for each library.",
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
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {current.map((a) => (
                    <Badge
                      key={a.libraryDocumentId}
                      label={`${libraryName(a.libraryDocumentId)} · ${a.staffRole === "owner" ? "Owner" : "Editor"}${member.status === "invited" ? " · on acceptance" : ""}`}
                      color="dim"
                      icon={
                        team.libraries.find(
                          (l) => l.documentId === a.libraryDocumentId
                        )?.libraryType === "Mobile"
                          ? "mdi:bus-side"
                          : "mdi:library-outline"
                      }
                    />
                  ))}
                  {member.pending.map((p) => (
                    <Badge
                      key={p.submissionDocumentId}
                      label={`${libraryName(p.libraryDocumentId)} · ${p.staffRole === "owner" ? "Owner" : "Editor"} · with a moderator`}
                      color="warn"
                      icon="mdi:clock-outline"
                    />
                  ))}
                  {current.length === 0 && member.pending.length === 0 ? (
                    <span className="text-[13px]" style={{ color: T.ink.dim }}>
                      No libraries yet
                    </span>
                  ) : null}
                  {organiser && team.libraries.length > 0 ? (
                    <button
                      type="button"
                      className={SMALL_PILL}
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
                      <span className="sr-only"> for {memberName(member)}</span>
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
        {!organiser ? (
          <p className="mt-4 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
            Ask {team.organiserNames.join(" or ") || "your organiser"} to change
            your access.
          </p>
        ) : null}
      </Card>

      {organiser ? (
        <Card
          title={tUi("invite_a_colleague")}
          aside={
            <span className="text-[14px]" style={{ color: T.ink.dim }}>
              {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left
            </span>
          }
        >
          {seatsLeft === 0 ? (
            <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
              Every seat is taken. Remove someone, or ask the site team to add
              seats to {team.name}.{" "}
              <a
                href={TEAM_CONTACT_HREF}
                className={CONTACT_LINK}
                style={{ color: T.accent.primary }}
              >
                Contact the site team
              </a>
            </p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
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
              <label className="flex flex-col gap-2 text-[14px] font-semibold">
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
              <label className="flex flex-col gap-2 text-[14px] font-semibold">
                Team role
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value === "organiser"
                        ? "organiser"
                        : "member"
                    )
                  }
                  className={INPUT}
                  style={{ borderColor: T.border.hi }}
                >
                  <option value="member">Member</option>
                  <option value="organiser">
                    Organiser (can manage this team)
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-[14px] font-semibold">
                Give access to (optional)
                <select
                  value={inviteLibrary}
                  onChange={(event) => setInviteLibrary(event.target.value)}
                  className={INPUT}
                  style={{ borderColor: T.border.hi }}
                >
                  <option value={NONE}>No library yet</option>
                  {team.libraries.map((l) => (
                    <option key={l.documentId} value={l.documentId}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              {inviteLibrary !== NONE ? (
                <div className="flex flex-col gap-2 text-[14px] font-semibold">
                  Level
                  <SegmentedControl
                    label={tUi("level_at_the_library")}
                    options={LEVELS}
                    value={inviteLevel}
                    onChange={setInviteLevel}
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className={PRIMARY}
                  disabled={busy || !inviteEmail}
                >
                  <Icon
                    aria-hidden="true"
                    icon="mdi:email-fast-outline"
                    width={16}
                    height={16}
                  />
                  Send invite
                </button>
                <p
                  className="mt-3 mb-0 text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  They sign in with that email and accept the link. The invite
                  holds a seat for 14 days.
                </p>
              </div>
            </form>
          )}
        </Card>
      ) : null}

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
            <button
              type="button"
              className={PRIMARY}
              disabled={busy || !draftDirty}
              onClick={() => {
                if (!assigning) return
                saveAssignments(assigning, draft).then(({ ok }) => {
                  if (ok) setAssigning(null)
                })
              }}
            >
              {tUi("save_changes")}{" "}
            </button>
            <button
              type="button"
              className={PILL}
              style={{ borderColor: T.border.hi }}
              disabled={busy}
              onClick={() => setAssigning(null)}
            >
              {tUi("cancel")}{" "}
            </button>
          </div>
        }
      >
        <p className="m-0 mb-4 text-[15px]" style={{ color: T.ink.dim }}>
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
                <strong className="min-w-0 flex-1 text-[15px]">
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
                <button
                  type="button"
                  className={QUIET_LINK}
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
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[14.5px]" style={{ color: T.ink.dim }}>
            No libraries yet.
          </p>
        )}
        {canAddToDraft ? (
          <div
            className="mt-5 flex flex-col gap-3 rounded-[14px] border border-dashed p-4"
            style={{ borderColor: T.border.hi }}
          >
            <label className="flex flex-col gap-2 text-[14px] font-semibold">
              {tUi("add_a_library")}
              <select
                value={addLibrary}
                className={INPUT}
                style={{ borderColor: T.border.hi }}
                onChange={(event) => setAddLibrary(event.target.value)}
              >
                <option value="">Choose a library…</option>
                {draftFree.map((l) => (
                  <option key={l.documentId} value={l.documentId}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                label={tUi("level_at_the_library")}
                options={LEVELS}
                value={addLevel}
                onChange={setAddLevel}
              />
              <button
                type="button"
                className={SMALL_PILL}
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
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        side="bottom"
        title={confirm?.title ?? "Confirm"}
      >
        <p className="m-0 mb-5" style={{ color: T.ink.dim }}>
          {confirm?.body}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={PRIMARY}
            style={
              confirm?.danger ? { background: T.accent.danger } : undefined
            }
            disabled={busy}
            onClick={() => {
              if (confirm)
                void request(confirm.path, confirm.method, confirm.payload)
            }}
          >
            {confirm?.danger ? "Yes, go ahead" : "Confirm"}
          </button>
          <button
            type="button"
            className={PILL}
            style={{ borderColor: T.border.hi }}
            onClick={() => setConfirm(null)}
          >
            {tUi("cancel")}{" "}
          </button>
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
