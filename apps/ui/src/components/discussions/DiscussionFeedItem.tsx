"use client"

import { Check, MessageCircle, Star } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

import { discussionAuthor, discussionHref, type DiscussionRecord } from "./api"
import {
  DiscussionAvatar,
  DiscussionRelativeTime,
} from "./DiscussionPresentation"

/** The same public thread presentation in library, drive and noticeboard feeds. */
export function DiscussionFeedItem({
  thread,
  featured = false,
  compact = false,
  contextLabel,
  actions,
}: {
  readonly thread: DiscussionRecord
  readonly featured?: boolean
  readonly compact?: boolean
  readonly contextLabel?: string
  readonly actions?: ReactNode
}) {
  const t = useTranslations("discussions")
  const author = discussionAuthor(thread.author, t("member"))
  const authorHref = discussionHref(author.url)
  const replies = thread.replyCount ?? 0
  // Matches the directory's unanswered filter: at least one published reply.
  const answered = replies > 0
  const displayFeatured = featured && !compact
  const profile = authorHref ? (
    <a
      href={authorHref}
      className="relative z-10 font-semibold text-(--t-ink-base) no-underline hover:underline"
    >
      {author.name}
    </a>
  ) : (
    <span
      className={
        displayFeatured ? "font-semibold text-(--t-ink-base)" : undefined
      }
    >
      {author.name}
    </span>
  )
  const avatar = (
    <DiscussionAvatar
      author={author}
      colourful
      size={displayFeatured ? "feed" : "md"}
    />
  )

  return (
    <article
      className={cn(
        "group relative isolate min-w-0",
        displayFeatured
          ? "rounded-[22px] border border-[#dedaf6] bg-[#f7f5fc] p-5 sm:p-6"
          : "flex flex-wrap items-center gap-x-4 gap-y-3 py-4"
      )}
    >
      {displayFeatured ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-(--t-accent-primary) uppercase">
            <Star size={14} fill="currentColor" aria-hidden />
            {t("feedFeatured")}
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <MessageCircle size={16} aria-hidden />
            {t("replyCount", { count: replies })}
          </span>
        </div>
      ) : (
        <div className="shrink-0">
          {authorHref ? (
            <a
              href={authorHref}
              aria-label={author.name}
              className="relative z-10 block rounded-full"
            >
              {avatar}
            </a>
          ) : (
            avatar
          )}
        </div>
      )}
      <div
        className={displayFeatured ? undefined : "min-w-0 flex-1 basis-[180px]"}
      >
        <h3 className="type-h3 m-0">
          <Link
            href={`/community/discussions/${encodeURIComponent(thread.id)}`}
            lang={thread.language}
            dir="auto"
            className="no-underline group-hover:text-(--t-accent-primary) after:absolute after:inset-0 after:rounded-[22px] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-(--t-accent-primary)"
          >
            {thread.title ?? t("untitled")}
          </Link>
        </h3>
        {displayFeatured && thread.excerpt ? (
          <p
            className="mt-4 mb-0 line-clamp-2 max-w-[90ch] text-base leading-relaxed text-(--t-ink-dim)"
            lang={thread.language}
            dir="auto"
          >
            {thread.excerpt}
          </p>
        ) : null}
        {contextLabel ? (
          <p className="mt-1 mb-0 line-clamp-1 text-xs font-semibold text-(--t-accent-primary)">
            {contextLabel}
          </p>
        ) : null}
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--t-ink-dim)",
            displayFeatured ? "mt-4" : "mt-1"
          )}
        >
          {displayFeatured ? (
            <span className="mr-1 shrink-0">
              {authorHref ? (
                <a
                  href={authorHref}
                  aria-label={author.name}
                  className="relative z-10 block rounded-full"
                >
                  {avatar}
                </a>
              ) : (
                avatar
              )}
            </span>
          ) : null}
          {profile}
          <AuthorBadges badges={author.badges} />
          {thread.createdAt ? (
            <>
              <span aria-hidden>·</span>
              <DiscussionRelativeTime value={thread.createdAt} />
            </>
          ) : null}
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 text-xs leading-none font-semibold uppercase",
              displayFeatured
                ? "border border-[#dedaf6] bg-white text-(--t-ink-dim)"
                : "bg-(--t-bg-muted)"
            )}
          >
            {thread.language}
          </span>
          {!displayFeatured && answered ? (
            <span className="inline-flex items-center gap-1 font-semibold text-(--t-accent-ok)">
              <Check size={15} aria-hidden />
              {t("feedAnswered")}
            </span>
          ) : null}
          {displayFeatured && thread.lastReplyAt ? (
            <span className="ml-auto flex flex-wrap items-center gap-1.5 text-sm">
              <span>{t("feedLastReply")}</span>
              <DiscussionRelativeTime value={thread.lastReplyAt} />
            </span>
          ) : null}
        </div>
      </div>
      {displayFeatured ? null : (
        <div className="ml-auto inline-flex shrink-0 items-center gap-4">
          <span
            aria-label={t("replyCount", { count: replies })}
            className="inline-flex items-center gap-1.5 text-sm text-(--t-ink-dim)"
          >
            <MessageCircle size={15} aria-hidden />
            {replies}
          </span>
          {actions ? <div className="relative z-10">{actions}</div> : null}
        </div>
      )}
      {displayFeatured && actions ? (
        <div className="relative z-10 mt-4 border-t border-dashed border-[#dedaf6] pt-4">
          {actions}
        </div>
      ) : null}
    </article>
  )
}
