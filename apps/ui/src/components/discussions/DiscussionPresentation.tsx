"use client"

import { MessageCircle, Pin } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

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
}: {
  author: DiscussionRecord["author"] | null
}) {
  const t = useTranslations("discussions")
  const safeAuthor = discussionAuthor(author, t("member"))
  const url = discussionHref(safeAuthor.avatar?.url)
  const palette = author?.background ? COMMUNITY_TINTS[author.background] : null

  return (
    <span
      className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
      style={{
        background: palette?.bg ?? "var(--t-bg-muted)",
        color: palette?.fg ?? "var(--t-ink-dim)",
      }}
    >
      {url ? (
        <img
          src={url}
          alt={safeAuthor.avatar?.alternativeText ?? ""}
          className="size-full object-cover"
          width={40}
          height={40}
        />
      ) : (
        safeAuthor.name
          .replace(/^@+/, "")
          .trim()
          .split(/[\s_-]+/)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()
      )}
    </span>
  )
}

export function DiscussionTime({ value }: { value?: string }) {
  const locale = useLocale()
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

  return (
    <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 rounded-[22px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 transition-shadow hover:shadow-md sm:p-6">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
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
              className="rounded-full bg-(--t-bg-muted) px-3 py-1 text-(--t-ink-dim)"
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
            className="hover:underline"
            lang={record.language}
          >
            {record.title ?? t("untitled")}
          </Link>
        </h3>
        {record.excerpt && (
          <p
            className="mt-2 mb-0 line-clamp-3 text-base leading-relaxed text-(--t-ink-dim)"
            lang={record.language}
          >
            {record.excerpt}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-(--t-ink-dim)">
          <DiscussionAvatar author={record.author} />
          <span className="font-semibold text-(--t-ink-base)">
            {author.name}
          </span>
          <span>· {languageName(record.language, [], locale)}</span>
          {record.activityAt && (
            <>
              <span>·</span>
              <DiscussionTime value={record.activityAt} />
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end justify-between gap-4 text-right text-sm">
        {typeof record.replyCount === "number" && (
          <span className="inline-flex items-center gap-2">
            <MessageCircle size={17} aria-hidden />
            <span>
              <b className="block font-serif text-3xl leading-none">
                {record.replyCount}
              </b>
              {t("replyCountLabel", { count: record.replyCount })}
            </span>
          </span>
        )}
        {record.subscribed && (
          <span className="text-xs font-semibold text-(--t-accent-primary)">
            {t("following")}
          </span>
        )}
      </div>
    </article>
  )
}
