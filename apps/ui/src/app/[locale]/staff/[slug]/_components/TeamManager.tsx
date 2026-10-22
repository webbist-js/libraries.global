"use client"

import { Icon } from "@iconify/react"
import type { StaffRole } from "@repo/access"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useState } from "react"

import { Avatar, Badge, Notice, Sheet, Switch } from "@/components/ds"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { staffRequest } from "@/lib/staff/client"
import type { StaffTeam } from "@/lib/staff/types"

type Confirmation = {
  title: string
  body: string
  path: string
  method: string
  payload?: unknown
  leave?: boolean
  /** Removal or leaving: the confirm button turns rust on this step only. */
  danger?: boolean
}

const INPUT = STAFF_FIELD

const ACTION_LABELS: Record<string, string> = {
  invite_sent: "sent an invite",
  invite_revoked: "revoked an invite",
  joined: "joined the staff",
  level_changed: "changed a level",
  removed: "removed from the staff",
  left: "left the staff",
  can_go_live_changed: "changed who can go live",
  live_settings_changed: "changed live sharing settings",
  access_reported: "reported a problem with staff access",
  stepup_locked: "was locked out of step-up",
  notice_created: "posted a notice",
  notice_updated: "updated a notice",
  notice_ended: "ended a notice",
}

const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))

const Card = StaffPanel

/**
 * The library's staff. Covered by a Team: every member's level, verified
 * date and live permission (owners change them), pending invitees under
 * the list, invites to the Team pre-assigned to this library (organisers)
 * and the audit. Uncovered: who has access only. The viewer's own actions,
 * Leave and Report, sit in the staff card's footer with their access line;
 * removing someone is a quiet link that turns rust only on the confirm step.
 */
export function TeamManager({
  id,
  libraryName,
  data,
  role,
  full,
  mobile,
}: {
  readonly id: string
  readonly libraryName: string
  readonly data: StaffTeam
  readonly role: StaffRole
  readonly full: boolean
  readonly mobile: boolean
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const locale = useLocale()
  const date = (iso: string) => formatDate(iso, locale)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const [report, setReport] = useState(false)
  const [message, setMessage] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<StaffRole>("editor")
  const base = `/api/staff/${id}`
  const owner = full && role === "owner"
  const team = data.team
  const organiser = full && !!team?.viewerIsOrganiser
  const owners = data.members.filter((m) => m.staffRole === "owner").length
  const you = data.members.find((m) => m.isYou)
  // The uncovered view lists members without a level, so the session's
  // role for this library stands in: an owner never reads "Editor".
  const yourRole: StaffRole = you?.staffRole ?? role
  const yourAccess = `${yourRole === "owner" ? "Owner" : "Editor"}${you?.approvedAt ? ` since ${date(you.approvedAt)}` : ""}`
  const pendingInvites = data.invites.filter((i) => i.status !== "expired")

  async function request(
    path: string,
    method: string,
    payload?: unknown,
    leave = false
  ) {
    setBusy(true)
    setError("")
    setStatus("")
    try {
      await staffRequest(path, method, payload)
      setStatus("Saved.")
      setConfirm(null)
      if (leave) router.push("/staff")
      router.refresh()

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.")

      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div role="status" aria-live="polite" className="sr-only">
        {status}
      </div>
      {error ? (
        <Notice
          icon="mdi:alert-circle-outline"
          tone="warn"
          title={tUi("not_saved")}
        >
          <span role="alert">{error}</span>
        </Notice>
      ) : null}

      <Card
        title={full ? `Staff (${data.members.length})` : "Who has staff access"}
        aside={
          team ? (
            <Badge
              label={`${team.name}${team.verified ? " · Verified team" : ""}`}
              color="aurora"
              icon="mdi:account-group-outline"
            />
          ) : null
        }
        footer={
          <>
            <p className="m-0 mr-auto text-[14px]" style={{ color: T.ink.dim }}>
              <span className="font-semibold" style={{ color: T.ink.base }}>
                Your access
              </span>{" "}
              · {yourAccess}
              {!data.canLeave && yourRole === "owner"
                ? " · The last owner can’t leave"
                : ""}
            </p>
            {data.canLeave ? (
              <Button
                type="button"
                variant="surface"
                size="pill"
                style={{ borderColor: T.border.hi }}
                onClick={() =>
                  setConfirm({
                    title: `Leave ${libraryName}?`,
                    body: "Your staff access ends now. You can claim it again later, and a moderator will check the claim.",
                    path: `${base}/leave`,
                    method: "POST",
                    leave: true,
                    danger: true,
                  })
                }
              >
                Leave this library
              </Button>
            ) : null}
            <Button
              type="button"
              variant="surface"
              size="pill"
              style={{ borderColor: T.border.hi }}
              onClick={() => setReport(true)}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:flag-outline"
                width={16}
                height={16}
              />
              Report a problem
            </Button>
          </>
        }
      >
        <ul
          className="m-0 list-none divide-y border-t p-0"
          style={{ borderColor: T.border.divider }}
        >
          {data.members.map((member, index) => (
            <li
              key={member.affiliationDocumentId}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
              style={{ borderColor: T.border.divider }}
            >
              <div className="flex min-w-0 items-center gap-4">
                <Avatar
                  initials={member.initials || "?"}
                  index={index}
                  size="lg"
                  title={member.name}
                  variant="tint"
                />
                <div>
                  <p
                    className="m-0 text-[18px] font-semibold wrap-break-word"
                    style={{ color: T.ink.base }}
                  >
                    {member.name}
                    {member.isYou ? (
                      <span style={{ color: T.ink.dim }}> (you)</span>
                    ) : null}
                  </p>
                  {full ? (
                    <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                      {member.approvedAt
                        ? `Verified ${date(member.approvedAt)}`
                        : "Verified"}
                      {mobile && member.canGoLive ? " · Can go live" : ""}
                      {mobile && member.canGoLive === false
                        ? " · Can’t go live"
                        : ""}
                    </p>
                  ) : null}
                </div>
              </div>
              {full ? (
                <div className="flex flex-wrap items-center gap-3">
                  {owner ? (
                    <label className="flex items-center gap-2 text-[14px]">
                      <span className="sr-only">Level for {member.name}</span>
                      <select
                        value={member.staffRole}
                        disabled={
                          busy || (member.staffRole === "owner" && owners === 1)
                        }
                        className={INPUT}
                        style={{ borderColor: T.border.hi }}
                        onChange={(event) =>
                          setConfirm({
                            title: `Make ${member.name} an ${event.target.value}?`,
                            body:
                              event.target.value === "owner"
                                ? "Owners manage the staff list, live sharing and notices."
                                : "Editors keep the record, hours and notices up to date but can’t change who has access.",
                            path: `${base}/team/members/${member.affiliationDocumentId}`,
                            method: "PUT",
                            payload: { staffRole: event.target.value },
                          })
                        }
                      >
                        <option value="owner">Owner</option>
                        <option value="editor">Editor</option>
                      </select>
                    </label>
                  ) : (
                    <Badge
                      label={member.staffRole === "owner" ? "Owner" : "Editor"}
                      color="dim"
                    />
                  )}
                  {mobile ? (
                    <Switch
                      label={tUi("can_go_live")}
                      checked={member.canGoLive === true}
                      disabled={!owner || busy}
                      onChange={(canGoLive) => {
                        void request(
                          `${base}/team/members/${member.affiliationDocumentId}`,
                          "PUT",
                          { canGoLive }
                        )
                      }}
                    />
                  ) : null}
                  {owner && !member.isYou ? (
                    <Button
                      variant="link"
                      size="pill"
                      className="px-0 text-(--t-ink-dim) underline"
                      style={{ color: T.ink.dim }}
                      disabled={
                        busy || (member.staffRole === "owner" && owners === 1)
                      }
                      type="button"
                      onClick={() =>
                        setConfirm({
                          title: `Remove ${member.name} from ${libraryName}?`,
                          body: "Their staff access ends now, any live session they started stops, and they’re emailed. This is recorded in the staff audit.",
                          path: `${base}/team/members/${member.affiliationDocumentId}`,
                          method: "DELETE",
                          danger: true,
                        })
                      }
                    >
                      {tUi("remove")}
                      <span className="sr-only">
                        {" "}
                        {member.name} from the staff
                      </span>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {full && pendingInvites.length ? (
          <ul
            className="m-0 list-none divide-y border-t p-0"
            style={{ borderColor: T.border.divider }}
            aria-label={tUi("invited_not_yet_accepted")}
          >
            {pendingInvites.map((invite) => (
              <li
                key={invite.documentId}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
                style={{ borderColor: T.border.divider }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed"
                    style={{ borderColor: T.border.hi, color: T.ink.dim }}
                  >
                    <Icon icon="mdi:email-outline" width={20} height={20} />
                  </span>
                  <div className="min-w-0">
                    <p
                      className="m-0 font-semibold break-words"
                      style={{ color: T.ink.base }}
                    >
                      {invite.emailMasked}
                    </p>
                    <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                      {invite.staffRole === "owner" ? "Owner" : "Editor"} ·
                      holds a seat until {date(invite.expiresAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    label={tUi("invited")}
                    color="dim"
                    icon="mdi:clock-outline"
                  />
                  {organiser && team ? (
                    <Button
                      type="button"
                      disabled={busy}
                      variant="link"
                      size="pill"
                      className="px-0 text-(--t-ink-dim) underline"
                      style={{ color: T.ink.dim }}
                      onClick={() =>
                        setConfirm({
                          title: `Revoke the invite for ${invite.emailMasked}?`,
                          body: "Their link stops working. You can invite them again later.",
                          path: `/api/staff/team/${team.documentId}/invites/${invite.documentId}`,
                          method: "DELETE",
                          danger: true,
                        })
                      }
                    >
                      Revoke
                      <span className="sr-only">
                        {" "}
                        the invite for {invite.emailMasked}
                      </span>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {full && organiser && team ? (
          <div
            className="mt-6 border-t pt-6"
            style={{ borderColor: T.border.divider }}
          >
            {organiser && team ? (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault()
                  request(
                    `/api/staff/team/${team.documentId}/invites`,
                    "POST",
                    {
                      email: inviteEmail,
                      teamRole: "member",
                      preassign: {
                        libraryDocumentId: id,
                        staffRole: inviteRole,
                      },
                    }
                  ).then((saved) => {
                    if (saved) setInviteEmail("")
                  })
                }}
              >
                <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-2 text-[15px] font-semibold">
                  {tUi("email")}{" "}
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    className={INPUT}
                    style={{ borderColor: T.border.hi }}
                    maxLength={254}
                    placeholder="colleague@library.example"
                  />
                </label>
                <label className="flex flex-col gap-2 text-[14px] font-semibold">
                  Level
                  <select
                    name="staffRole"
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(
                        event.target.value === "owner" ? "owner" : "editor"
                      )
                    }
                    className={INPUT}
                    style={{ borderColor: T.border.hi }}
                  >
                    <option value="editor">Editor</option>
                    <option value="owner">Owner</option>
                  </select>
                </label>
                <Button
                  variant="primary"
                  size="pill"
                  disabled={busy || !inviteEmail}
                  type="submit"
                >
                  <Icon
                    aria-hidden="true"
                    icon="mdi:email-fast-outline"
                    width={16}
                    height={16}
                  />
                  Send invite
                </Button>
                <p
                  className="m-0 basis-full text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  They join {team.name} and get {inviteRole} access to{" "}
                  {libraryName} as soon as they accept
                  {team.verified ? "" : " (a moderator checks it first)"}.
                  Manage every library’s staff in the{" "}
                  <Link
                    href="/staff/teams"
                    className="font-semibold underline"
                    style={{ color: T.accent.primary }}
                  >
                    {tUi("team_organiser")}
                  </Link>
                  .
                </p>
              </form>
            ) : null}
            {data.invites.some((i) => i.status === "expired") ? (
              <p className="mt-4 mb-0 text-[13px]" style={{ color: T.ink.dim }}>
                {data.invites.filter((i) => i.status === "expired").length}{" "}
                earlier invite
                {data.invites.filter((i) => i.status === "expired").length === 1
                  ? ""
                  : "s"}{" "}
                expired unaccepted. Send a new one to try again.
              </p>
            ) : null}
          </div>
        ) : null}
        {!full ? (
          <p className="mt-4 mb-0 text-[14px]" style={{ color: T.ink.dim }}>
            Each person claimed access on their own and a moderator checked it.
            With the Team plan an organiser manages this list.
          </p>
        ) : null}
        {full && !organiser ? (
          <div className="mt-5">
            <Notice
              icon="mdi:account-plus-outline"
              tone="info"
              title={tUi("need_to_add_a_colleague")}
            >
              <p className="m-0" style={{ color: T.ink.base }}>
                Ask your team organiser
                {team?.organiserNames.length
                  ? `, ${team.organiserNames.join(" or ")},`
                  : ""}{" "}
                to invite them or change who has access.
              </p>
            </Notice>
          </div>
        ) : null}
      </Card>

      {full && data.audit.length ? (
        <Card title={tUi("recent_changes")}>
          <ul
            className="m-0 list-none divide-y p-0"
            style={{ borderColor: T.border.divider }}
          >
            {data.audit.map((row, index) => (
              <li
                key={`${row.at}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 text-[14px]"
                style={{ borderColor: T.border.divider }}
              >
                <time
                  dateTime={row.at}
                  className="shrink-0 text-[13px] tabular-nums"
                  style={{ color: T.ink.dim }}
                >
                  {date(row.at)}
                </time>
                <span>
                  <strong>{row.actorName}</strong>{" "}
                  {ACTION_LABELS[row.action] ?? row.action.replaceAll("_", " ")}
                  {row.subjectName ? (
                    <>
                      {" "}
                      · <strong>{row.subjectName}</strong>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        side="bottom"
        title={confirm?.title ?? "Confirm change"}
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
              confirm?.danger ? { background: T.accent.danger } : undefined
            }
            disabled={busy}
            onClick={() => {
              if (confirm)
                void request(
                  confirm.path,
                  confirm.method,
                  confirm.payload,
                  confirm.leave
                )
            }}
          >
            {confirm?.danger ? "Yes, go ahead" : "Confirm"}
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
      <Sheet
        open={report}
        onClose={() => setReport(false)}
        side="bottom"
        title={tUi("report_a_problem_with_staff_access")}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            request(`${base}/report`, "POST", { message }).then((saved) => {
              if (saved) {
                setReport(false)
                setMessage("")
              }
            })
          }}
        >
          <label className="flex flex-col gap-2 text-[14px] font-semibold">
            Tell the moderators what’s wrong
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              minLength={10}
              maxLength={1000}
              rows={5}
              className="rounded-[14px] border bg-(--t-bg-surface) p-3 text-[15px] font-normal"
              style={{ borderColor: T.border.hi }}
            />
          </label>
          <p className="mt-2 mb-4 text-[13px]" style={{ color: T.ink.dim }}>
            A moderator can remove anyone from a library’s staff. 10 to 1,000
            characters.
          </p>
          <Button type="submit" disabled={busy} variant="primary" size="pill">
            Send report
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
