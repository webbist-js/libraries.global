"use client"

import { Check, Pin } from "lucide-react"
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl"
import { useState } from "react"

import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import { avatarInitials, avatarSrc } from "@/lib/avatar"
import { COMMUNITY_TINTS } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import {
  discussionAuthor,
  discussionHref,
  type DiscussionImage,
  type DiscussionRecord,
  type Subject,
} from "./api"

export function DiscussionImages({
  images,
}: {
  images?: readonly DiscussionImage[]
}) {
  if (!images?.length) return null

  return (
    <div className="my-4 grid gap-4 sm:grid-cols-2">
      {images.map((image) => (
        <figure key={image.id} className="m-0">
          <img
            src={`/api/discussions/attachments/${encodeURIComponent(image.id)}`}
            alt={image.altText}
            width={image.width}
            height={image.height}
            loading="lazy"
            className="max-h-96 w-full rounded-xl object-contain"
          />
          {image.caption && (
            <figcaption className="mt-2 text-sm text-(--t-ink-dim)">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

const paletteKeys = [
  "violet",
  "coral",
  "mint",
  "amber",
  "blue",
  "rose",
] as const

export function subjectPalette(subject?: Pick<Subject, "slug">) {
  const value = [...(subject?.slug ?? "library-life")].reduce(
    (sum, letter) => sum + letter.codePointAt(0)!,
    0
  )

  return COMMUNITY_TINTS[paletteKeys[value % paletteKeys.length]!]
}

export function DiscussionAvatar({
  author,
  colourful = false,
  size = "md",
}: {
  author: DiscussionRecord["author"] | null
  colourful?: boolean
  size?: "sm" | "md" | "feed"
}) {
  const t = useTranslations("discussions")
  const safeAuthor = discussionAuthor(author, t("member"))
  const url = discussionHref(avatarSrc(safeAuthor.avatar) ?? undefined)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const palette = author?.background
    ? COMMUNITY_TINTS[author.background]
    : colourful
      ? subjectPalette({ slug: safeAuthor.name })
      : null

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${size === "sm" ? "size-6 text-[10px]" : size === "feed" ? "size-8 text-xs" : "size-10 text-sm"}`}
      style={{
        background: palette?.bg ?? "var(--t-bg-muted)",
        color: palette?.fg ?? "var(--t-ink-dim)",
      }}
    >
      {url && failedUrl !== url ? (
        <img
          src={url}
          alt={safeAuthor.avatar?.alternativeText ?? ""}
          className="size-full object-cover"
          width={40}
          height={40}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        avatarInitials(safeAuthor.name)
      )}
    </span>
  )
}

export function DiscussionTime({
  value,
  compact = false,
}: {
  value?: string
  compact?: boolean
}) {
  const locale = useLocale()
  if (compact) return <CompactDiscussionTime value={value} locale={locale} />
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return null

  return (
    <time dateTime={value}>
      {new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)}
    </time>
  )
}

function CompactDiscussionTime({
  value,
  locale,
}: {
  value?: string
  locale: string
}) {
  const t = useTranslations("discussions")
  const now = useNow({ updateInterval: 60_000 })
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return null
  const dateLocale = locale === "en" ? "en-GB" : locale
  const today =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  const day = today
    ? t("today")
    : new Intl.DateTimeFormat(dateLocale, {
        day: "numeric",
        month: "short",
        ...(date.getFullYear() !== now.getFullYear()
          ? { year: "numeric" as const }
          : {}),
      }).format(date)
  const time = new Intl.DateTimeFormat(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
  const full = new Intl.DateTimeFormat(dateLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)

  return (
    <time dateTime={value} title={full}>
      {day}, {time}
    </time>
  )
}

export function DiscussionRelativeTime({ value }: { value: string }) {
  const formatter = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null

  return (
    <time
      dateTime={value}
      title={formatter.dateTime(date, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    >
      {formatter.relativeTime(date, now)}
    </time>
  )
}

export function DiscussionPreview({
  record,
  subject,
}: {
  record: DiscussionRecord
  subject?: Subject
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const author = discussionAuthor(record.author, t("member"))
  const palette = subjectPalette(subject)
  const targetHref = discussionHref(record.target?.url)
  const authorHref = discussionHref(author.url)
  const participants = record.participants?.length
    ? record.participants.slice(0, 4)
    : [author]
  const timestamp = record.lastReplyAt ?? record.createdAt ?? record.activityAt

  return (
    <article className="group relative isolate grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-4 rounded-[22px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 transition-shadow hover:shadow-md sm:p-6">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
          {record.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-(--t-ink-base) px-3 py-1 text-(--t-bg-deep)">
              <Pin size={12} aria-hidden />
              {t("pinned")}
            </span>
          )}
          {subject && (
            <span
              className="rounded-full px-3 py-1"
              style={{ background: palette.bg, color: palette.fg }}
            >
              {subject.name}
            </span>
          )}
          {record.target && targetHref && (
            <a
              className="relative z-10 rounded-full bg-(--t-bg-muted) px-3 py-1 text-(--t-ink-dim) hover:underline"
              href={targetHref}
            >
              {record.target.title}
            </a>
          )}
          {record.locked && (
            <span className="rounded-full bg-(--t-bg-muted) px-3 py-1">
              {t("lockedLabel")}
            </span>
          )}
        </div>
        <h3 className="m-0 font-serif text-[1.6rem] leading-tight tracking-tight">
          <Link
            href={`/community/discussions/${encodeURIComponent(record.id)}`}
            className="no-underline after:absolute after:inset-0 after:rounded-[22px] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-(--t-accent-primary)"
            lang={record.language}
          >
            {record.title ?? t("untitled")}
          </Link>
        </h3>
        {record.excerpt && (
          <p
            className="mt-3 mb-0 line-clamp-2 text-base leading-relaxed text-(--t-ink-dim)"
            lang={record.language}
          >
            {record.excerpt}
          </p>
        )}
      </div>
      <div className="min-w-12 pt-1 text-right text-sm text-(--t-ink-dim)">
        {typeof record.replyCount === "number" && (
          <span>
            <span className="mb-2 block font-serif text-[32px] leading-none text-(--t-ink-base)">
              {record.replyCount}
            </span>
            {t("replyCountLabel", { count: record.replyCount })}
          </span>
        )}
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-(--t-ink-dim)">
          <div className="flex -space-x-3">
            {participants.map((participant, index) => {
              const href = discussionHref(participant.url)
              const avatar = <DiscussionAvatar author={participant} colourful />

              return href ? (
                <a
                  key={index}
                  href={href}
                  aria-label={participant.name}
                  className="relative z-10 rounded-full ring-2 ring-(--t-bg-deep) hover:z-20 focus-visible:z-20"
                >
                  {avatar}
                </a>
              ) : (
                <span
                  key={index}
                  className="rounded-full ring-2 ring-(--t-bg-deep)"
                  title={participant.name}
                >
                  {avatar}
                </span>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {authorHref ? (
              <a
                href={authorHref}
                className="relative z-10 font-bold text-(--t-ink-base) hover:underline"
              >
                {author.name}
              </a>
            ) : (
              <span className="font-bold text-(--t-ink-base)">
                {author.name}
              </span>
            )}
            <AuthorBadges badges={author.badges} />
            <span>· {languageName(record.language, [], locale)}</span>
            {timestamp && (
              <>
                <span>
                  · {record.lastReplyAt ? t("lastReply") : t("started")}
                </span>
                <DiscussionRelativeTime value={timestamp} />
              </>
            )}
          </div>
        </div>
        {record.subscribed && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-(--t-accent-primary)">
            <Check size={17} aria-hidden />
            {t("following")}
          </span>
        )}
      </div>
    </article>
  )
}
