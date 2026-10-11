import { Icon } from "@iconify/react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { SuggestionsWorkspace } from "@/components/community/SuggestionsWorkspace"
import { getSessionSSR } from "@/lib/auth-server"
import {
  formatBoardReview,
  isVotable,
  LIST_LABELS,
  nextBoardReview,
  type PublicSuggestion,
} from "@/lib/community/suggestions"
import {
  fetchOptionNames,
  fetchPublicSuggestions,
} from "@/lib/community/suggestions-server"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { openDriveCount } from "@/lib/drives/drive-view-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Suggested additions",
    description:
      "Accessibility features, services, facilities and library types people want added to the lists. Vote for the ones you’d use.",
    path: "community/suggestions",
    locale,
  })
}

const NEXT_STEPS = [
  "Others vote for options they’d use.",
  "The editorial board reviews the top options each month.",
  "Accepted options appear in every library’s checklist.",
]

const RECENT_SHOWN = 5

/** The most recently accepted suggestions, newest decision first. */
function recentlyAdded(list: readonly PublicSuggestion[]): PublicSuggestion[] {
  return list
    .filter((s) => s.status === "accepted")
    .sort(
      (a, b) =>
        (b.decidedAt ? Date.parse(b.decidedAt) : 0) -
        (a.decidedAt ? Date.parse(a.decidedAt) : 0)
    )
    .slice(0, RECENT_SHOWN)
}

function WhatHappensNext({ review }: { readonly review: string }) {
  return (
    <section
      aria-labelledby="what-happens-next"
      className="flex flex-col gap-3"
      style={{
        background: T.bg.surface,
        border: `1px solid ${T.border.divider}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <h2
        id="what-happens-next"
        className="m-0 text-[17px] font-bold"
        style={{ color: T.ink.base }}
      >
        What happens next
      </h2>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {NEXT_STEPS.map((text, i) => (
          <li
            key={text}
            className="flex items-start gap-2.5 text-[15px] leading-normal"
            style={{ color: T.ink.base }}
          >
            <span
              aria-hidden="true"
              className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
              style={{
                background: T.accent.chip,
                color: T.accent.primaryHover,
              }}
            >
              {i + 1}
            </span>
            {text}
          </li>
        ))}
      </ol>
      <p
        className="m-0 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Next board review: {review}
      </p>
    </section>
  )
}

function RecentlyAdded({
  items,
}: {
  readonly items: readonly PublicSuggestion[]
}) {
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="recently-added"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <h2
        id="recently-added"
        className="m-0 mb-1.5 text-[17px] font-bold"
        style={{ color: T.ink.base }}
      >
        Recently added to the lists
      </h2>
      <ul className="m-0 list-none p-0">
        {items.map((s) => (
          <li
            key={s.documentId}
            className="flex items-center gap-2.5"
            style={{
              borderTop: `1px solid ${T.border.divider}`,
              padding: "9px 0",
            }}
          >
            <span
              aria-hidden="true"
              className="flex size-[30px] shrink-0 items-center justify-center rounded-full"
              style={{
                background: TYPE_TINT.public.bg,
                color: TYPE_TINT.public.fg,
              }}
            >
              <Icon height={14} icon="mdi:check" width={14} />
            </span>
            <span
              className="min-w-0 flex-1 text-[15px] font-semibold"
              style={{ color: T.ink.base }}
            >
              {s.name}
            </span>
            <span className="text-[14px]" style={{ color: T.ink.dim }}>
              {LIST_LABELS[s.optionKey] ?? s.optionKey}
              {s.decidedAt
                ? ` · ${new Date(s.decidedAt).toLocaleDateString("en-GB", {
                    month: "short",
                    timeZone: "UTC",
                  })}`
                : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale } = await params
  const [suggestions, optionNames, session, openDrives] = await Promise.all([
    fetchPublicSuggestions(),
    fetchOptionNames(),
    getSessionSSR(await headers()),
    openDriveCount(locale),
  ])
  const now = new Date()
  const votableCount = suggestions.filter(isVotable).length

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section={tUi("suggestions")}
        title="What should the lists *include?*"
        lead="Name a feature or service the lists don’t have yet. Vote for the ones you’d use; the editorial board decides monthly."
        counts={{ noticeboard: openDrives, suggestions: votableCount }}
      >
        <div className="flex flex-wrap gap-2.5">
          <a
            href="#suggest-option"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-3 text-[16px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
            style={{
              border: `1px solid ${T.border.hi}`,
              background: T.bg.deep,
              color: T.ink.base,
            }}
          >
            <Icon aria-hidden="true" height={17} icon="mdi:plus" width={17} />
            Suggest an option
          </a>
        </div>
      </CommunitySectionHeader>

      <SuggestionsWorkspace
        initial={suggestions}
        optionNames={optionNames}
        signedIn={Boolean(session?.user)}
        now={now.toISOString()}
      >
        <WhatHappensNext review={formatBoardReview(nextBoardReview(now))} />
        <RecentlyAdded items={recentlyAdded(suggestions)} />
      </SuggestionsWorkspace>
    </div>
  )
}
