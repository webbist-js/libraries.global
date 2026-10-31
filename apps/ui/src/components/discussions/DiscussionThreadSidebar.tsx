"use client"

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  History,
  Link2,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  Pin,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import { Badge } from "@/components/ds/Badge"
import { Skeleton } from "@/components/ui/skeleton"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import { discussionAuthor, discussionHref, type DiscussionRecord } from "./api"
import { DiscussionContextActions } from "./DiscussionContextActions"
import {
  DiscussionAvatar,
  DiscussionTime,
  subjectPalette,
} from "./DiscussionPresentation"
import type { useThreadModeration } from "./useThreadModeration"

function SidebarPanel({
  title,
  icon: Icon,
  meta,
  children,
}: {
  title: string
  icon: LucideIcon
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5"
    >
      <header className="mb-4 flex items-center gap-2.5">
        <Icon
          size={18}
          className="shrink-0 text-(--t-accent-primary)"
          aria-hidden
        />
        <h2 className="type-panel-title m-0 min-w-0 flex-1 text-(--t-ink-base)">
          {title}
        </h2>
        {meta}
      </header>
      {children}
    </section>
  )
}

const auditActions = {
  approved: { message: "auditActions.approved", icon: Check, tone: "ok" },
  rejected: { message: "auditActions.rejected", icon: X, tone: "warn" },
  changes_requested: {
    message: "auditActions.changes_requested",
    icon: MessageCircle,
    tone: "warn",
  },
  removed: { message: "auditActions.removed", icon: X, tone: "danger" },
  pin: { message: "auditActions.pin", icon: Pin, tone: "violet" },
  unpin: { message: "auditActions.unpin", icon: Pin, tone: "dim" },
  lock: { message: "auditActions.lock", icon: LockKeyhole, tone: "dim" },
  unlock: {
    message: "auditActions.unlock",
    icon: MessageCircle,
    tone: "violet",
  },
  sanction_applied: {
    message: "auditActions.sanction_applied",
    icon: ShieldCheck,
    tone: "danger",
  },
  sanction_lifted: {
    message: "auditActions.sanction_lifted",
    icon: ShieldCheck,
    tone: "ok",
  },
} as const

const auditTints = {
  ok: { background: "var(--t-palette-mint-soft)", color: T.accent.ok },
  warn: {
    background: "var(--t-palette-amber-soft)",
    color: "var(--t-palette-amber-fg)",
  },
  danger: { background: "var(--t-palette-coral-soft)", color: T.accent.danger },
  violet: { background: T.accent.chip, color: T.accent.primary },
  dim: { background: T.bg.muted, color: T.ink.dim },
}

const contextLink =
  "inline-flex min-h-10 items-center justify-between gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-3.5 py-2 text-sm font-semibold text-(--t-accent-primary) hover:border-(--t-accent-primary)"

export function DiscussionThreadSidebar({
  thread,
  related,
  moderation,
  hideMemberContext = false,
  onContextChanged,
  memberPreview = false,
}: {
  thread: DiscussionRecord
  related: readonly DiscussionRecord[]
  moderation?: ReturnType<typeof useThreadModeration>
  hideMemberContext?: boolean
  onContextChanged?: () => void
  memberPreview?: boolean
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const formatter = useFormatter()
  const participants = thread.participants?.length
    ? thread.participants
    : [discussionAuthor(thread.author, t("member"))]
  const targetHref = discussionHref(thread.target?.url)
  const palette = subjectPalette(thread.subject)
  const reviewer = memberPreview ? undefined : moderation
  const log =
    reviewer?.audit
      .flatMap((event) => {
        const action = auditActions[event.action as keyof typeof auditActions]

        return action ? [{ ...event, ...action }] : []
      })
      .slice(0, 5) ?? []
  const contexts = (thread.contexts ?? []).filter(
    (link) => !memberPreview || link.public !== false
  )
  const primaryContext = targetHref
    ? contexts.find((link) => discussionHref(link.url) === targetHref)
    : undefined
  const additionalContexts = contexts.filter(
    (link) => link.id !== primaryContext?.id
  )
  const queueCount = reviewer?.total || reviewer?.globalTotal
  const showQueue =
    reviewer &&
    (reviewer.total === null || Boolean(queueCount) || Boolean(reviewer.error))
  if (hideMemberContext) return null

  return (
    <aside
      className="grid content-start gap-4 text-base [--spacing:0.25rem]"
      aria-label={t("conversationDetails")}
    >
      {reviewer && (
        <>
          {showQueue && (
            <section
              aria-label={t("reviewQueue")}
              className="rounded-[24px] bg-(--t-bg-inverse) p-5 text-white"
            >
              <header className="mb-5 flex items-center gap-2.5">
                <ShieldCheck size={19} className="text-[#d9d5ff]" aria-hidden />
                <h2 className="type-panel-title m-0">{t("reviewQueue")}</h2>
              </header>
              {reviewer.error ? (
                <p
                  role="alert"
                  className="m-0 text-sm leading-relaxed text-[#e5e2f5]"
                >
                  {t("error")}
                </p>
              ) : (
                <div className="flex items-center gap-4">
                  {queueCount === null || queueCount === undefined ? (
                    <Skeleton className="h-14 w-16 bg-white/15" />
                  ) : (
                    <span className="shrink-0 font-sans text-[64px] leading-none tracking-tight">
                      {formatter.number(queueCount)}
                    </span>
                  )}
                  <p className="m-0 text-sm leading-relaxed text-[#e5e2f5]">
                    {queueCount === null || queueCount === undefined
                      ? t("loading")
                      : t(
                          reviewer.total
                            ? "messagesWaiting"
                            : "messagesWaitingAll",
                          { count: queueCount }
                        )}
                  </p>
                </div>
              )}
              {Boolean(reviewer.total) &&
                reviewer.globalTotal !== null &&
                !reviewer.error && (
                  <p className="mt-4 mb-0 border-t border-white/15 pt-3 text-xs text-[#e5e2f5]">
                    {t("waitingAll", { count: reviewer.globalTotal })}
                  </p>
                )}
              <Link
                href="/moderation?tab=discussions"
                className="mt-4 flex min-h-11 items-center justify-between gap-2 rounded-full bg-(--t-bg-deep) px-4 py-2.5 text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-palette-violet-bg)"
              >
                {t("openFullQueue")}
                <ArrowUpRight size={16} aria-hidden />
              </Link>
            </section>
          )}
          <SidebarPanel title={t("moderationLog")} icon={History}>
            <ol
              className={`relative m-0 grid list-none gap-4 p-0 ${log.length > 1 ? "before:absolute before:top-3 before:bottom-3 before:left-[14px] before:w-px before:bg-(--t-border-line)" : ""}`}
            >
              {log.map((event) => {
                const Icon = event.icon
                const actorHref = discussionHref(event.actor?.url)

                return (
                  <li
                    key={event.id}
                    className="relative flex items-start gap-3"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={auditTints[event.tone]}
                    >
                      <Icon size={14} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm leading-relaxed font-semibold">
                        {t(event.message)}
                      </p>
                      {event.actor?.name && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-(--t-ink-dim)">
                          {actorHref ? (
                            <a
                              href={actorHref}
                              className="hover:text-(--t-accent-primary) hover:underline"
                            >
                              {event.actor.name}
                            </a>
                          ) : (
                            <span>{event.actor.name}</span>
                          )}
                          <AuthorBadges badges={event.actor.badges} />
                        </div>
                      )}
                      <div className="mt-1 text-xs text-(--t-ink-dim)">
                        <DiscussionTime value={event.createdAt} compact />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
            {!log.length && (
              <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {t("noModerationActions")}
              </p>
            )}
            <p className="mt-4 mb-0 flex items-start gap-1.5 border-t border-(--t-border-line) pt-3 text-xs leading-relaxed text-(--t-ink-dim)">
              <LockKeyhole size={13} className="mt-0.5 shrink-0" aria-hidden />
              {t("moderationLogPrivacy")}
            </p>
          </SidebarPanel>
        </>
      )}
      <SidebarPanel
        title={t("inConversation")}
        icon={UsersRound}
        meta={
          <Badge
            color="dim"
            size="xs"
            label={formatter.number(
              thread.participantCount ?? participants.length
            )}
          />
        }
      >
        <ul className="m-0 grid list-none gap-2 p-0">
          {participants.map((participant, index) => {
            const href = discussionHref(participant.url)
            const content = (
              <>
                <DiscussionAvatar author={participant} colourful />
                <div className="grid min-w-0 gap-1">
                  <span className="text-sm leading-snug font-semibold break-words">
                    {participant.name}
                  </span>
                  <AuthorBadges badges={participant.badges} />
                </div>
              </>
            )
            const row = "flex items-center gap-3 rounded-xl p-1.5"

            return (
              <li key={`${participant.slug ?? participant.name}:${index}`}>
                {href ? (
                  <a href={href} className={`${row} hover:bg-(--t-bg-surface)`}>
                    {content}
                  </a>
                ) : (
                  <div className={row}>{content}</div>
                )}
              </li>
            )
          })}
        </ul>
        {(thread.participantCount ?? 0) > participants.length && (
          <p className="mt-3 mb-0 text-xs text-(--t-ink-dim)">
            {t("moreParticipants", {
              count: thread.participantCount! - participants.length,
            })}
          </p>
        )}
      </SidebarPanel>
      {(targetHref || additionalContexts.length > 0) && (
        <SidebarPanel title={t("aboutConversation")} icon={Link2}>
          {thread.target && targetHref && (
            <div className="grid gap-3">
              <p
                className="m-0 text-base leading-relaxed font-semibold"
                lang={thread.language}
              >
                {thread.target.title}
              </p>
              <div className="flex flex-wrap gap-2">
                <a href={targetHref} className={contextLink}>
                  {t("visitPage")}
                  <ArrowUpRight size={14} aria-hidden />
                </a>
                {thread.target.links?.map((link) => {
                  const href = discussionHref(link.url)

                  return href ? (
                    <a key={href} href={href} className={contextLink}>
                      {href.startsWith("/journal?")
                        ? t("readStories")
                        : link.label}
                      <ArrowUpRight size={14} aria-hidden />
                    </a>
                  ) : null
                })}
              </div>
              {primaryContext &&
                onContextChanged &&
                !memberPreview &&
                primaryContext.canManage && (
                  <div className="border-t border-dashed border-(--t-border-line) pt-3">
                    <DiscussionContextActions
                      link={primaryContext}
                      onChanged={onContextChanged}
                    />
                  </div>
                )}
            </div>
          )}
          {additionalContexts.length > 0 && (
            <div
              className={
                targetHref
                  ? "mt-4 border-t border-(--t-border-line) pt-4"
                  : undefined
              }
            >
              <h3 className="type-label mt-0 mb-3 text-(--t-ink-dim) uppercase">
                {t("linkedContexts")}
              </h3>
              <ul className="m-0 grid list-none gap-3 p-0">
                {additionalContexts.map((link) => {
                  const href = discussionHref(link.url)

                  return (
                    <li key={link.id} className="grid gap-2">
                      {href ? (
                        <a
                          href={href}
                          className="flex items-start justify-between gap-2 text-sm leading-relaxed font-semibold hover:text-(--t-accent-primary)"
                        >
                          {link.title}
                          <ArrowUpRight
                            size={15}
                            className="mt-0.5 shrink-0"
                            aria-hidden
                          />
                        </a>
                      ) : (
                        <span className="text-sm font-semibold">
                          {link.title}
                        </span>
                      )}
                      {onContextChanged && !memberPreview && (
                        <DiscussionContextActions
                          link={link}
                          onChanged={onContextChanged}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </SidebarPanel>
      )}
      {thread.state === "visible" && thread.subject && (
        <section
          className="rounded-[24px] border p-5"
          style={{ background: palette.soft, borderColor: palette.bg }}
        >
          <header
            className="mb-4 flex items-start gap-2.5"
            style={{ color: palette.fg }}
          >
            <MessagesSquare size={18} className="mt-1 shrink-0" aria-hidden />
            <h2 className="type-panel-title m-0">
              {t("moreInSubject", { subject: thread.subject.name })}
            </h2>
          </header>
          <ul className="m-0 grid list-none divide-y divide-(--t-border-line) border-t border-(--t-border-line) p-0">
            {related.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={`/community/discussions/${encodeURIComponent(item.id)}`}
                  className="flex items-start justify-between gap-2 text-base leading-snug font-semibold text-(--t-accent-primary) underline underline-offset-4 hover:text-(--t-accent-primary-hover)"
                  lang={item.language}
                >
                  {item.title ?? t("untitled")}
                  <ArrowUpRight
                    size={15}
                    className="mt-0.5 shrink-0"
                    aria-hidden
                  />
                </Link>
                <p className="mt-1.5 mb-0 flex items-center gap-1.5 text-xs text-(--t-ink-dim)">
                  <MessageCircle size={12} aria-hidden />
                  {t("replyTotal", { count: item.replyCount ?? 0 })} ·{" "}
                  {languageName(item.language, [], locale)}
                </p>
              </li>
            ))}
          </ul>
          {!related.length && thread.subject.description && (
            <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {thread.subject.description}
            </p>
          )}
          <Link
            href={`/community/discussions?subject=${encodeURIComponent(thread.subjectId)}`}
            className={`${contextLink} mt-4 flex w-full`}
          >
            {t("browseSubject")}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </section>
      )}
    </aside>
  )
}
