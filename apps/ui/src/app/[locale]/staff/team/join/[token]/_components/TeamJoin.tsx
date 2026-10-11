"use client"
import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { staffRequest } from "@/lib/staff/client"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { TeamInvitePreview, TeamSummary } from "@/lib/staff/types"

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-(--t-accent-primary) px-5 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover) disabled:opacity-50"
const OUTLINED =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
const INLINE =
  "inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-[3px]"

/** The invite's pre-assignment, with the library's name and slug when the API sends them. */
type Preassign = NonNullable<TeamInvitePreview["preassign"]> & {
  libraryName?: string | null
  librarySlug?: string | null
}

/**
 * Accept a Team invite: the team, who sent it, the masked email, the role
 * and the library it opens (when pre-assigned). Blocked states say what to
 * do next with a link; after joining, focus lands on the confirmation and
 * the pre-assigned library is one click away.
 */
export function TeamJoin({
  token,
  invite,
  emailVerified,
}: {
  readonly token: string
  readonly invite: TeamInvitePreview
  readonly emailVerified: boolean
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const doneRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [joined, setJoined] = useState<TeamSummary | null>(null)
  const blocked =
    invite.status !== "open" || !invite.emailMatches || !emailVerified
  const preassign = invite.preassign as Preassign | null
  const staffBase = staffLibraryHref(preassign?.librarySlug)
  const libraryLabel = preassign
    ? (preassign.libraryName ?? `library ${preassign.libraryDocumentId}`)
    : null

  useEffect(() => {
    if (joined) doneRef.current?.focus()
  }, [joined])

  async function join() {
    setBusy(true)
    setError("")
    try {
      const result = await staffRequest<{ team: TeamSummary }>(
        `/api/staff/team/join/${token}/accept`,
        "POST"
      )
      setJoined(result.team)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.")
    } finally {
      setBusy(false)
    }
  }

  if (joined)
    return (
      <section
        className="max-w-[60ch] rounded-[20px] border p-6 sm:p-8"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        <div ref={doneRef} role="status" tabIndex={-1} className="outline-none">
          <Notice
            icon="mdi:check-circle-outline"
            tone="ok"
            title={`You’re on ${joined.name}`}
          >
            <span style={{ color: T.ink.base }}>
              {joined.role === "organiser"
                ? "You organise this team: invite colleagues and assign them to its libraries."
                : preassign && libraryLabel
                  ? `You now have ${preassign.staffRole} access to ${libraryLabel}. Your organiser can add more libraries at any time.`
                  : "Your organiser gives you access to the team’s libraries; any library already assigned to you is in your Staff area."}
            </span>
          </Notice>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {preassign ? (
            <Link href={`${staffBase}`} className={PRIMARY}>
              {tUi("open_library", { library: libraryLabel ?? "" })}
              <Icon
                aria-hidden="true"
                icon="mdi:arrow-right"
                width={16}
                height={16}
              />
            </Link>
          ) : null}
          <Link
            href={joined.role === "organiser" ? "/staff/team" : "/staff"}
            className={preassign ? OUTLINED : PRIMARY}
            style={
              preassign
                ? { borderColor: T.border.hi, color: T.ink.base }
                : undefined
            }
          >
            {joined.role === "organiser"
              ? "Open the Team organiser"
              : "Open your Staff area"}
            {preassign ? null : (
              <Icon
                aria-hidden="true"
                icon="mdi:arrow-right"
                width={16}
                height={16}
              />
            )}
          </Link>
        </div>
      </section>
    )

  return (
    <section
      className="max-w-[60ch] rounded-[20px] border p-6 sm:p-8"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <dl className="m-0 grid gap-4 sm:grid-cols-2">
        <div>
          <dt
            className="text-[13px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            {tUi("team")}
          </dt>
          <dd className="m-0 text-[22px]" style={{ fontFamily: T.font.serif }}>
            {invite.teamName}
          </dd>
        </div>
        <div>
          <dt
            className="text-[13px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            Invited by
          </dt>
          <dd className="m-0 text-[15px]">{invite.invitedByName}</dd>
        </div>
        <div>
          <dt
            className="text-[13px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            Sent to
          </dt>
          <dd
            className="m-0 text-[15px] break-words"
            style={{ fontFamily: T.font.mono, fontSize: 14 }}
          >
            {invite.emailMasked}
          </dd>
        </div>
        <div>
          <dt
            className="text-[13px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            Your role
          </dt>
          <dd className="m-0 text-[15px]">
            {invite.teamRole === "organiser" ? "Organiser" : "Member"}
          </dd>
        </div>
        {preassign ? (
          <div className="sm:col-span-2">
            <dt
              className="text-[13px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Library access on joining
            </dt>
            <dd className="m-0 text-[15px]">
              {libraryLabel} ·{" "}
              {preassign.staffRole === "owner" ? "Owner" : "Editor"}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 space-y-4">
        {invite.status === "expired" ? (
          <Notice
            icon="mdi:clock-alert-outline"
            tone="warn"
            title={tUi("this_invite_has_expired")}
          >
            <span style={{ color: T.ink.base }}>
              Ask {invite.invitedByName} to send a new one.
            </span>
          </Notice>
        ) : null}
        {invite.status === "team_inactive" ? (
          <Notice
            icon="mdi:pause-circle-outline"
            tone="warn"
            title={tUi("this_team_isnt_active_2")}
          >
            <span style={{ color: T.ink.base }}>
              Its plan has lapsed or expired. Ask {invite.invitedByName} to
              check with the site team.
            </span>
          </Notice>
        ) : null}
        {invite.status === "open" && !invite.emailMatches ? (
          <Notice
            icon="mdi:account-alert-outline"
            tone="warn"
            title={tUi("sign_in_with_the_invited_email")}
          >
            <span style={{ color: T.ink.base }}>
              This invite went to {invite.emailMasked}. Sign out, sign in with
              that address, then open the link again.
            </span>
            <span>
              <Link
                href="/auth/signout"
                className={INLINE}
                style={{ color: T.accent.primary }}
              >
                {tUi("sign_out")}{" "}
                <Icon
                  aria-hidden="true"
                  icon="mdi:logout"
                  width={15}
                  height={15}
                />
              </Link>
            </span>
          </Notice>
        ) : null}
        {invite.status === "open" && invite.emailMatches && !emailVerified ? (
          <Notice
            icon="mdi:email-alert-outline"
            tone="warn"
            title={tUi("verify_your_email_first")}
          >
            <span style={{ color: T.ink.base }}>
              Confirm your email address from your account settings, then come
              back to this link.
            </span>
            <span>
              <Link
                href="/profile/settings"
                className={INLINE}
                style={{ color: T.accent.primary }}
              >
                Email settings
                <Icon
                  aria-hidden="true"
                  icon="mdi:arrow-right"
                  width={15}
                  height={15}
                />
              </Link>
            </span>
          </Notice>
        ) : null}
        {error ? (
          <p role="alert" className="m-0" style={{ color: T.accent.danger }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className={PRIMARY}
          disabled={busy || blocked}
          onClick={() => void join()}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:account-plus-outline"
            width={16}
            height={16}
          />
          {busy ? "Joining…" : `Join ${invite.teamName}`}
        </button>
      </div>
    </section>
  )
}
