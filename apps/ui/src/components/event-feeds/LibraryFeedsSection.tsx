"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef } from "react"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"

import { PRIMARY_PILL } from "./feed-ui"
import { FeedRow } from "./FeedRow"
import type { LibraryFeeds } from "./types"

/**
 * One claimed library's feeds: a white card with its rows and a Connect
 * CTA. On the dashboard the card is headed by the library's name; inside
 * that library's own staff shell pass `heading` ("Connected feeds") so the
 * name isn't repeated under the hero, and `intro` for the card's sub-line.
 */
export function LibraryFeedsSection({
  entry,
  highlight = false,
  heading,
  intro,
}: {
  readonly entry: LibraryFeeds
  readonly highlight?: boolean
  /** Replaces the library-name heading inside the staff shell. */
  readonly heading?: string
  /** One line under the heading. */
  readonly intro?: string
}) {
  const tUi = useUiTranslations("ui")

  const ref = useRef<HTMLElement>(null)
  const { library, feeds } = entry

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "start" })
  }, [highlight])

  const href = `/libraries?q=${encodeURIComponent(library.slug ?? library.name)}`

  return (
    <section
      ref={ref}
      id={`library-${library.documentId}`}
      aria-labelledby={`library-${library.documentId}-heading`}
      className="p-5 sm:p-8"
      style={{
        border: `1px solid ${T.border.line}`,
        outline: highlight ? `2px solid ${T.accent.primary}` : undefined,
        outlineOffset: highlight ? "2px" : undefined,
        borderRadius: "20px",
        background: T.bg.deep,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`library-${library.documentId}-heading`}
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(20px, 2.4vw, 24px)",
              fontWeight: 500,
              color: T.ink.base,
              margin: 0,
            }}
          >
            {heading ?? (
              <GlobalLink href={href} className="no-underline hover:underline">
                {library.name}
              </GlobalLink>
            )}
          </h2>
          {intro ? (
            <p
              className="m-0 mt-1 max-w-[60ch] text-[15px]"
              style={{ color: T.ink.dim }}
            >
              {intro}
            </p>
          ) : null}
        </div>
        {feeds.length > 0 ? (
          <GlobalLink
            href={staffLibraryHref(library.slug, "/events/connect")}
            className={PRIMARY_PILL}
          >
            Connect a feed
          </GlobalLink>
        ) : null}
      </div>

      {feeds.length === 0 ? (
        <EmptyState
          compact
          icon="mdi:calendar-sync-outline"
          lead={tUi("nothing_connected_yet")}
          detail="Connect your events platform and its events appear on this library’s page after a moderator checks the connection."
          action={
            <GlobalLink
              href={staffLibraryHref(library.slug, "/events/connect")}
              className={PRIMARY_PILL}
            >
              Connect a feed
            </GlobalLink>
          }
        />
      ) : (
        <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
          {feeds.map((feed) => (
            <FeedRow
              key={feed.documentId}
              feed={feed}
              libraryDocumentId={library.documentId}
              librarySlug={library.slug}
              libraryName={library.name}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
