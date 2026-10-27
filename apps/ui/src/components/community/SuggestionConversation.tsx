"use client"

import { DEFAULT_LOCALE } from "@repo/shared-data"
import { ChevronDown, ChevronUp, Link2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import type { DiscussionRecord } from "@/components/discussions/api"
import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import {
  DiscussionAvatar,
  DiscussionRelativeTime,
} from "@/components/discussions/DiscussionPresentation"
import { DiscussionThreadSkeleton } from "@/components/discussions/DiscussionSkeleton"
import {
  suggestionHref,
  type PublicSuggestion,
  type SuggestionConversationSummary,
} from "@/lib/community/suggestions"

const AttachedDiscussion = dynamic(
  () =>
    import("@/components/discussions/AttachedDiscussion").then(
      (module) => module.AttachedDiscussion
    ),
  { loading: () => <DiscussionThreadSkeleton embedded variant="suggestion" /> }
)

/** The board keeps only public summaries. Private drafts live inside the scoped discussion island. */
export function SuggestionConversation({
  suggestion,
  expanded,
  mounted,
  onToggle,
  panelId,
}: {
  readonly suggestion: PublicSuggestion
  readonly expanded: boolean
  readonly mounted: boolean
  readonly onToggle: () => void
  readonly panelId: string
}) {
  const t = useTranslations("optionSuggestions")
  const locale = useLocale()
  const [live, setLive] = useState<{
    source: PublicSuggestion["conversation"]
    value: SuggestionConversationSummary
  } | null>(null)
  const [copyMessage, setCopyMessage] = useState("")
  const summary =
    live && live.source === suggestion.conversation
      ? live.value
      : suggestion.conversation
  const count = summary?.count ?? suggestion.commentCount ?? 0
  const returnTo = `${locale === DEFAULT_LOCALE ? "" : `/${locale}`}${suggestionHref(suggestion.documentId)}`
  const onActivity = useCallback(
    (thread: DiscussionRecord, latest?: DiscussionRecord) => {
      if (thread.state !== "visible") return
      setLive({
        source: suggestion.conversation,
        value: {
          count: 1 + (thread.replyCount ?? 0),
          participants:
            thread.participants?.slice(0, 3) ??
            (thread.author ? [thread.author] : []),
          latestAt: thread.lastReplyAt ?? thread.createdAt,
          latestAuthor:
            latest?.author ?? (!thread.replyCount ? thread.author : undefined),
        },
      })
    },
    [suggestion.conversation]
  )

  const footer = (
    <div className="relative">
      <button
        type="button"
        className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 text-sm font-semibold text-(--t-ink-dim) hover:text-(--t-accent-primary) hover:underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(returnTo, window.location.origin).href
            )
            setCopyMessage(t("conversationCopied"))
          } catch {
            setCopyMessage(t("conversationCopyFailed"))
          }
        }}
      >
        <Link2 size={14} aria-hidden />
        {copyMessage || t("copyConversationLink")}
      </button>
      <span role="status" className="sr-only">
        {copyMessage}
      </span>
    </div>
  )

  return (
    <div className="border-t border-(--t-border-line)">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={`flex min-h-14 w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 text-left sm:px-6 ${expanded ? "bg-(--t-bg-surface)" : "bg-white"}`}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--t-ink-dim)">
          {!!summary?.participants.length && (
            <span className="flex -space-x-2">
              {summary.participants.map((author, index) => (
                <span
                  key={`${author.slug ?? author.name}:${index}`}
                  className="rounded-full ring-2 ring-white"
                >
                  <DiscussionAvatar author={author} size="feed" colourful />
                </span>
              ))}
            </span>
          )}
          <span>
            {t("conversationReplies", { count })}
            {summary?.latestAt && (
              <>
                {" "}
                · {t("conversationLatest")}{" "}
                <DiscussionRelativeTime value={summary.latestAt} />
                {summary.latestAuthor && (
                  <>
                    {" "}
                    {t("conversationBy", {
                      name: summary.latestAuthor.name,
                    })}{" "}
                    <AuthorBadges badges={summary.latestAuthor.badges} />
                  </>
                )}
              </>
            )}
          </span>
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-(--t-accent-primary)">
          {t(
            expanded
              ? "hideConversation"
              : count
                ? "readConversation"
                : "startConversation"
          )}
          {expanded ? (
            <ChevronUp size={17} aria-hidden />
          ) : (
            <ChevronDown size={17} aria-hidden />
          )}
        </span>
      </button>
      <div
        id={panelId}
        hidden={!expanded}
        className="border-t border-(--t-border-line) bg-(--t-bg-void) p-5 sm:p-6"
      >
        {mounted && (
          <AttachedDiscussion
            variant="suggestion"
            subjectSlug="suggestions"
            title={suggestion.name}
            language={locale}
            target={{
              uid: "plugin::content-moderation.option-suggestion",
              documentId: suggestion.documentId,
              locale: DEFAULT_LOCALE,
            }}
            returnTo={returnTo}
            footerAction={footer}
            onActivity={onActivity}
          />
        )}
      </div>
    </div>
  )
}
