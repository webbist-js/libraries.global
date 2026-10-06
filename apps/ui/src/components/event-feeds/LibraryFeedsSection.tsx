"use client"

import { useEffect, useRef } from "react"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { FeedRow } from "./FeedRow"
import type { LibraryFeeds } from "./types"

/** One claimed library's feeds: a white card with its rows and a Connect CTA. */
export function LibraryFeedsSection({
  entry,
  highlight = false,
}: {
  readonly entry: LibraryFeeds
  readonly highlight?: boolean
}) {
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
        outline: highlight ? `2px solid ${T.accent.primary}` : "none",
        outlineOffset: "2px",
        borderRadius: "20px",
        background: T.bg.deep,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <GlobalLink href={href} className="no-underline hover:underline">
            {library.name}
          </GlobalLink>
        </h2>
        <GlobalLink
          href={`/contribute/events/connect?library=${library.documentId}`}
          className="inline-flex items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-2.5 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
          style={{ fontFamily: T.font.sans, fontSize: "14px" }}
        >
          Connect a feed
        </GlobalLink>
      </div>

      {feeds.length === 0 ? (
        <EmptyState message="No event feeds yet. Connect one and its events appear on this library's page." />
      ) : (
        <div className="mt-2">
          {feeds.map((feed) => (
            <FeedRow
              key={feed.documentId}
              feed={feed}
              libraryName={library.name}
            />
          ))}
        </div>
      )}
    </section>
  )
}
