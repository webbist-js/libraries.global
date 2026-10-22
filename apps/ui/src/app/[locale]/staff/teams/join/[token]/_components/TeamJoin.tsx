"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { Notice } from "@/components/ds"
import { StaffPanel, STAFF_LINK } from "@/components/staff/StaffPanel"
import { Button, buttonVariants } from "@/components/ui/button"
import { Link } from "@/lib/navigation"
import { staffRequest } from "@/lib/staff/client"
import { staffLibraryHref } from "@/lib/staff/paths"
import type { TeamInvitePreview, TeamSummary } from "@/lib/staff/types"

const PRIMARY = buttonVariants({ variant: "primary", size: "pill" })
const OUTLINED = buttonVariants({ variant: "surface", size: "pill" })
type GuideLink = { href: string; title: string }

/** Keep the token URL as the email entry point; acceptance never happens on load. */
export function TeamJoin({
  token,
  invite,
  emailVerified,
  existingTeamName,
  guides = [],
}: {
  readonly token: string
  readonly invite: TeamInvitePreview
  readonly emailVerified: boolean
  readonly existingTeamName?: string
  readonly guides?: readonly GuideLink[]
}) {
  const t = useTranslations("teamInvitation")
  const tUi = useTranslations("ui")
  const doneRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [joined, setJoined] = useState<TeamSummary | null>(null)
  const blocked =
    invite.status !== "open" ||
    !invite.emailMatches ||
    !emailVerified ||
    Boolean(existingTeamName)
  const preassign = invite.preassign
  const libraryLabel = preassign
    ? (preassign.libraryName ??
      t("libraryFallback", { id: preassign.libraryDocumentId }))
    : null
  const organiser = (joined?.role ?? invite.teamRole) === "organiser"
  const libraryReady = Boolean(preassign && joined?.verified)
  const libraryNeedsReview = Boolean(preassign && joined && !joined.verified)
  const staffRole = t(preassign?.staffRole === "owner" ? "owner" : "editor")

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
      // Acceptance consumes the token. Refreshing this URL would replace
      // the confirmation with a not-found page, so navigate via the next steps.
      setJoined(result.team)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("joinError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-8">
      {joined ? (
        <StaffPanel>
          <div
            ref={doneRef}
            role="status"
            tabIndex={-1}
            className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-(--t-accent-primary)"
          >
            <Notice
              icon="mdi:check-circle-outline"
              tone="ok"
              title={t("joinedTitle", { team: joined.name })}
            >
              <span className="text-(--t-ink-base)">
                {libraryNeedsReview && libraryLabel
                  ? t("joinedLibraryPending", { library: libraryLabel })
                  : organiser
                    ? t("joinedOrganiser")
                    : preassign && libraryLabel
                      ? t("joinedLibrary", {
                          role: staffRole,
                          library: libraryLabel,
                        })
                      : t("joinedMember")}
              </span>
            </Notice>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {preassign && libraryReady ? (
              <Link
                href={staffLibraryHref(preassign.librarySlug)}
                className={PRIMARY}
              >
                {tUi("open_library", { library: libraryLabel ?? "" })}
                <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
              </Link>
            ) : null}
            <Link
              href={organiser ? "/staff/teams" : "/staff"}
              className={libraryReady ? OUTLINED : PRIMARY}
            >
              {t(organiser ? "openTeam" : "openStaff")}
              <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
            </Link>
            {libraryNeedsReview ? (
              <Link href="/contribute/submissions" className={OUTLINED}>
                {tUi("my_submissions")}
                <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
              </Link>
            ) : null}
          </div>
        </StaffPanel>
      ) : (
        <StaffPanel title={t("invitationTitle")} id="team-invitation">
          <p className="mt-0 mb-6 max-w-[68ch] text-[16px] leading-relaxed text-(--t-ink-dim)">
            {t("invitationIntro")}
          </p>
          <dl className="m-0 grid gap-x-8 gap-y-5 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5 sm:grid-cols-2 sm:p-6 [&_dd]:mt-1.5 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-[16px] [&_dd]:[overflow-wrap:anywhere] [&_dt]:text-[14px] [&_dt]:font-semibold [&_dt]:text-(--t-ink-dim)">
            <div>
              <dt>{tUi("team")}</dt>
              <dd className="font-serif text-[23px]! leading-tight">
                {invite.teamName}
              </dd>
            </div>
            <div>
              <dt>{t("invitedBy")}</dt>
              <dd>{invite.invitedByName}</dd>
            </div>
            <div>
              <dt>{t("sentTo")}</dt>
              <dd>{invite.emailMasked}</dd>
            </div>
            <div>
              <dt>{t("yourRole")}</dt>
              <dd>{t(organiser ? "organiser" : "member")}</dd>
            </div>
            {preassign ? (
              <div className="border-t border-(--t-border-line) pt-4 sm:col-span-2">
                <dt>{t("libraryAccess")}</dt>
                <dd>
                  {libraryLabel} · {staffRole}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-5 mb-0 max-w-[72ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
            {t(organiser ? "organiserDetail" : "memberDetail")}
          </p>
          <div className="mt-6 space-y-4">
            {existingTeamName ? (
              <Notice
                icon="mdi:account-group-outline"
                tone="info"
                title={t("existingTitle")}
              >
                <p className="m-0">
                  {t("existingDetail", { team: existingTeamName })}
                </p>
                <Link
                  href="/staff/teams"
                  className={`inline-flex min-h-11 items-center ${STAFF_LINK}`}
                >
                  {t("existingAction")}
                </Link>
              </Notice>
            ) : null}
            {invite.status === "expired" ? (
              <Notice
                icon="mdi:clock-alert-outline"
                tone="warn"
                title={tUi("this_invite_has_expired")}
              >
                <span className="text-(--t-ink-base)">
                  {t("expiredDetail", { inviter: invite.invitedByName })}
                </span>
              </Notice>
            ) : null}
            {invite.status === "team_inactive" ? (
              <Notice
                icon="mdi:pause-circle-outline"
                tone="warn"
                title={tUi("this_team_isnt_active_2")}
              >
                <span className="text-(--t-ink-base)">
                  {t("inactiveDetail", { inviter: invite.invitedByName })}
                </span>
              </Notice>
            ) : null}
            {invite.status === "open" && !invite.emailMatches ? (
              <Notice
                icon="mdi:account-alert-outline"
                tone="warn"
                title={tUi("sign_in_with_the_invited_email")}
              >
                <span className="text-(--t-ink-base)">
                  {t("wrongEmailDetail", { email: invite.emailMasked })}
                </span>
                <Link
                  href="/auth/signout"
                  className={`inline-flex min-h-11 items-center gap-2 self-start ${STAFF_LINK}`}
                >
                  {tUi("sign_out")}
                  <Icon aria-hidden="true" icon="mdi:logout" width={16} />
                </Link>
              </Notice>
            ) : null}
            {invite.status === "open" &&
            invite.emailMatches &&
            !emailVerified ? (
              <Notice
                icon="mdi:email-alert-outline"
                tone="warn"
                title={tUi("verify_your_email_first")}
              >
                <span className="text-(--t-ink-base)">{t("verifyDetail")}</span>
                <Link
                  href="/profile/settings"
                  className={`inline-flex min-h-11 items-center gap-2 self-start ${STAFF_LINK}`}
                >
                  {t("emailSettings")}
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
                </Link>
              </Notice>
            ) : null}
            {error ? (
              <p
                role="alert"
                className="m-0 text-[15px] text-(--t-accent-danger)"
              >
                {error}
              </p>
            ) : null}
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-(--t-border-line) pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="m-0 flex max-w-[48ch] items-start gap-2 text-[14px] leading-relaxed text-(--t-ink-dim)">
              <Icon
                aria-hidden="true"
                icon="mdi:shield-check-outline"
                width={18}
                className="mt-0.5 shrink-0"
              />
              {t("membershipNote")}
            </p>
            <Button
              variant="primary"
              size="pill"
              disabled={busy || blocked}
              aria-busy={busy}
              onClick={() => void join()}
            >
              <Icon
                aria-hidden="true"
                icon={busy ? "mdi:loading" : "mdi:account-plus-outline"}
                width={18}
                className={busy ? "motion-safe:animate-spin" : undefined}
              />
              {busy ? t("joining") : t("joinAction", { team: invite.teamName })}
            </Button>
          </div>
        </StaffPanel>
      )}

      <section aria-labelledby="invite-next-steps">
        <div className="mb-5 text-center">
          <h2
            id="invite-next-steps"
            className="m-0 font-serif text-[30px] leading-tight text-(--t-ink-base)"
          >
            {t(joined ? "nextTitleJoined" : "nextTitle")}
          </h2>
          <p className="mt-3 mb-0 text-[16px] leading-relaxed text-(--t-ink-dim)">
            {t("nextIntro")}
          </p>
        </div>
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {(
            [
              {
                id: "workspace",
                icon: "mdi:account-group-outline",
                title: organiser ? "organiserStepTitle" : "memberStepTitle",
                detail: organiser ? "organiserStepDetail" : "memberStepDetail",
              },
              {
                id: "libraries",
                icon: "mdi:library-outline",
                title: "librariesStepTitle",
                detail: organiser
                  ? "organiserLibrariesDetail"
                  : "memberLibrariesDetail",
              },
              {
                id: "updates",
                icon: "mdi:clipboard-edit-outline",
                title: "updatesStepTitle",
                detail: "updatesStepDetail",
              },
            ] as const
          ).map((step) => (
            <li
              key={step.id}
              className="min-w-0 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
            >
              <Icon
                aria-hidden="true"
                icon={step.icon}
                width={23}
                className="mb-4 text-(--t-accent-primary)"
              />
              <h3 className="m-0 font-serif text-[23px] leading-tight text-(--t-ink-base)">
                {t(step.title)}
              </h3>
              <p className="mt-3 mb-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
                {t(step.detail)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <StaffPanel title={t("guidesTitle")} id="team-invitation-guides" compact>
        {guides.length > 0 ? (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
            {guides.map((guide) => (
              <li key={guide.href} className="min-w-0">
                <Link
                  href={guide.href}
                  className="flex h-full min-h-14 items-center gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 text-[15px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary)/40 hover:text-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
                >
                  <Icon
                    aria-hidden="true"
                    icon="mdi:book-open-page-variant-outline"
                    width={20}
                    className="shrink-0 text-(--t-accent-primary)"
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {guide.title}
                  </span>
                  <Icon
                    aria-hidden="true"
                    icon="mdi:arrow-right"
                    width={16}
                    className="shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link
            href="/knowledge"
            className={`inline-flex min-h-11 items-center gap-2 ${STAFF_LINK}`}
          >
            {t("browseGuides")}
            <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
          </Link>
        )}
        <p className="mt-5 mb-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
          {t("helpDetail")}{" "}
          <Link href="/contribute/discussions" className={STAFF_LINK}>
            {t("askCommunity")}
          </Link>
        </p>
      </StaffPanel>
    </div>
  )
}
