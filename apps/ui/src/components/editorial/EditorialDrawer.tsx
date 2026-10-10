"use client"

import { Icon } from "@iconify/react"
import type { Capability } from "@repo/access"

import { Drawer } from "@/components/ds/Drawer"
import {
  DRAWER_CARD as CARD,
  DrawerLinkCard,
  DrawerTile as Tile,
} from "@/components/ds/DrawerCards"
import { describeScopes } from "@/components/moderation/submissionMeta"
import {
  useFeaturedDrive,
  useModerationWaiting,
} from "@/hooks/useContributeMenu"
import { useHydratedSession } from "@/lib/access-client"
import { sessionCapabilities } from "@/lib/access-server"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { driveHref } from "@/lib/drives/drive-view"
import { closeEditorialDrawer } from "@/lib/editorial/drawer"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

/** The capabilities that open the editorial drawer. */
export const EDITORIAL_CAPABILITIES: readonly Capability[] = [
  "docs.directEdit",
  "journal.directEdit",
  "moderate.queue",
  "drives.manage",
]

/** "every language", or the editor's languages by name. */
function languagesOf(locales: "all" | ReadonlySet<string>): string {
  if (locales === "all") return "In every language"
  const names = [...locales].map((code) => languageName(code))

  return names.length ? `In ${names.join(", ")}` : ""
}

function SectionHeading({
  id,
  children,
  sub,
}: {
  readonly id: string
  readonly children: string
  readonly sub?: string
}) {
  return (
    <div className="mb-2.5">
      <h3
        id={id}
        className="m-0 text-[14px] font-semibold"
        style={{ color: T.ink.dim }}
      >
        {children}
      </h3>
      {sub ? (
        <p className="m-0 mt-0.5 text-[13px]" style={{ color: T.ink.dim }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The editorial drawer: the staff drawer's counterpart for editors,
 * Moderators and the editorial board. Each section follows one
 * capability, so a Knowledge editor sees Knowledge, a Moderator the queue,
 * and the board everything plus drives and option suggestions. UI only:
 * every route behind these links re-checks access.
 */
export function EditorialDrawer() {
  const { data } = useHydratedSession()
  const c = sessionCapabilities(data?.user)
  const has = (cap: Capability) => c.set.has(cap)
  const board = has("drives.manage")
  const moderates = has("moderate.queue")
  const docs = has("docs.directEdit")
  const journal = has("journal.directEdit")
  const { data: waiting = null } = useModerationWaiting(moderates)
  const { data: featuredDrive = null } = useFeaturedDrive(board)

  const roles = board
    ? ["Editorial board"]
    : [
        docs ? "Knowledge editor" : null,
        journal ? "Journal editor" : null,
        moderates ? "Moderator" : null,
      ].filter((r): r is string => r !== null)
  const scopeLocales = Object.fromEntries(
    c.moderation.flatMap((s) =>
      s.locale ? [[s.locale, languageName(s.locale)]] : []
    )
  )

  return (
    <Drawer
      size="md"
      titleId="editorial-drawer-title"
      title="Editorial"
      eyebrow={
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] font-semibold"
          style={{
            background: T.bg.deep,
            borderColor: T.border.line,
            color: T.ink.base,
          }}
        >
          <Icon
            aria-hidden="true"
            height={16}
            icon="mdi:check"
            style={{ color: T.accent.ok }}
            width={16}
          />
          {roles.join(" · ")}
        </span>
      }
      footer={
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t px-5 py-3"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
          <Link
            href={
              moderates ? "/contribute/moderation" : "/contribute/knowledge"
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            onClick={closeEditorialDrawer}
          >
            {moderates ? "Open the queue" : "Open the editor"}
            <Icon
              aria-hidden="true"
              height={15}
              icon="mdi:arrow-right"
              width={15}
            />
          </Link>
          <span className="text-[13px]" style={{ color: T.ink.dim }}>
            Shortcut:{" "}
            <kbd
              className="rounded-md border px-1.5 py-0.5 font-semibold"
              style={{
                borderColor: T.border.hi,
                background: T.bg.surface,
                fontFamily: T.font.mono,
                color: T.ink.base,
              }}
            >
              Alt E
            </kbd>
          </span>
        </div>
      }
      onClose={closeEditorialDrawer}
    >
      <div className="flex flex-col gap-5 px-5 py-4">
        {moderates ? (
          <section aria-labelledby="editorial-drawer-review-h">
            <SectionHeading
              id="editorial-drawer-review-h"
              sub={`You review ${describeScopes(c.moderation, scopeLocales)}.`}
            >
              Review
            </SectionHeading>
            <div aria-live="polite" className="mb-2.5">
              {waiting ? (
                <Link
                  href="/contribute/moderation"
                  className={`${CARD} flex items-center gap-3 px-3.5 py-3.5 no-underline transition-colors hover:bg-(--t-bg-surface)`}
                  style={{ background: T.bg.deep, borderColor: T.edge.danger }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] font-bold tabular-nums"
                    style={{
                      background: TYPE_TINT.special.bg,
                      color: T.accent.danger,
                    }}
                  >
                    {waiting}
                  </span>
                  <span
                    className="min-w-0 flex-1 text-[15px] leading-snug font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {waiting} {waiting === 1 ? "submission" : "submissions"}{" "}
                    waiting for review
                  </span>
                  <Icon
                    aria-hidden="true"
                    height={18}
                    icon="mdi:chevron-right"
                    style={{ color: T.ink.dim }}
                    width={18}
                  />
                </Link>
              ) : (
                <p
                  className="m-0 flex items-center gap-2 px-1 text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  <Icon
                    aria-hidden="true"
                    height={15}
                    icon={
                      waiting === 0
                        ? "mdi:check-circle-outline"
                        : "mdi:progress-clock"
                    }
                    style={{ color: waiting === 0 ? T.accent.ok : T.ink.dim }}
                    width={15}
                  />
                  {waiting === 0
                    ? "Nothing waiting for review"
                    : "Checking the queue…"}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                href="/contribute/moderation"
                icon="mdi:shield-check-outline"
                label="Moderation queue"
              />
              {board ? (
                <Tile
                  href="/contribute/moderation/suggestions"
                  icon="mdi:lightbulb-on-outline"
                  label="Option suggestions"
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {docs ? (
          <section aria-labelledby="editorial-drawer-knowledge-h">
            <SectionHeading
              id="editorial-drawer-knowledge-h"
              sub={languagesOf(c.editorLocales.docs)}
            >
              Knowledge
            </SectionHeading>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                href="/contribute/knowledge/new?type=knowledge"
                icon="mdi:file-document-plus-outline"
                label="Write an article"
              />
              <Tile
                href="/contribute/knowledge"
                icon="mdi:pencil-outline"
                label="Edit articles"
              />
              <Tile
                href="/knowledge"
                icon="mdi:book-open-page-variant-outline"
                label="Knowledge"
              />
            </div>
          </section>
        ) : null}

        {journal ? (
          <section aria-labelledby="editorial-drawer-journal-h">
            <SectionHeading
              id="editorial-drawer-journal-h"
              sub={languagesOf(c.editorLocales.journal)}
            >
              Journal
            </SectionHeading>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                href="/contribute/knowledge/new?type=journal"
                icon="mdi:file-document-plus-outline"
                label="Write an article"
              />
              <Tile
                href="/contribute/knowledge?type=journal"
                icon="mdi:pencil-outline"
                label="Edit articles"
              />
              <Tile
                href="/journal"
                icon="mdi:newspaper-variant-outline"
                label="Journal"
              />
            </div>
          </section>
        ) : null}

        {board ? (
          <section aria-labelledby="editorial-drawer-drives-h">
            <SectionHeading id="editorial-drawer-drives-h">
              Drives
            </SectionHeading>
            <div className="grid grid-cols-2 gap-2.5">
              <Tile
                href="/community/drives/new"
                icon="mdi:flag-plus-outline"
                label="New drive"
              />
              <Tile
                href="/community"
                icon="mdi:flag-outline"
                label="All drives"
              />
            </div>
            {featuredDrive ? (
              <div className="mt-2.5">
                <DrawerLinkCard
                  href={driveHref(featuredDrive.slug)}
                  title={featuredDrive.title}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </Drawer>
  )
}
