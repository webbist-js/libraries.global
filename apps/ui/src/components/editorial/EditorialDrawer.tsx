"use client"

import { Icon } from "@iconify/react"
import { reviewCategoriesInScope, type Capability } from "@repo/access"
import { useTranslations as useUiTranslations } from "next-intl"

import { Drawer } from "@/components/ds/Drawer"
import {
  DRAWER_PILL,
  DrawerAction,
  DrawerFooter,
  DrawerSection,
} from "@/components/ds/DrawerCards"
import { describeScopes } from "@/components/moderation/submissionMeta"
import { useFeaturedDrive } from "@/hooks/useContributeMenu"
import { useModerationSummary } from "@/hooks/useModerationSummary"
import { useHydratedSession } from "@/lib/access-client"
import { sessionCapabilities } from "@/lib/access-server"
import { T } from "@/lib/design-tokens"
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

const REVIEW_ICON = {
  libraries: "mdi:bookshelf",
  articles: "mdi:book-open-page-variant-outline",
  claims: "mdi:badge-account-outline",
  drives: "mdi:flag-outline",
  applications: "mdi:account-check-outline",
  discussions: "mdi:forum-outline",
} as const

/** "every language", or the editor's languages by name. */
function languagesOf(locales: "all" | ReadonlySet<string>): string {
  if (locales === "all") return "In every language"
  const names = [...locales].map((code) => languageName(code))

  return names.length ? `In ${names.join(", ")}` : ""
}

/**
 * The editorial drawer: the staff drawer's counterpart for editors,
 * Moderators and the editorial board. Each section follows one
 * capability, so a Knowledge editor sees Knowledge, a Moderator the queue,
 * and the board everything plus drives and option suggestions. UI only:
 * every route behind these links re-checks access.
 */
export function EditorialDrawer() {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("workspaceDrawer")
  const review = useUiTranslations("moderationWorkspace")

  const { data } = useHydratedSession()
  const c = sessionCapabilities(data?.user)
  const has = (cap: Capability) => c.set.has(cap)
  const board = has("drives.manage")
  const moderates = has("moderate.queue")
  const docs = has("docs.directEdit")
  const journal = has("journal.directEdit")
  const summary = useModerationSummary(moderates)
  const categories = reviewCategoriesInScope(c.moderation)
  const reviewIds = [
    ...categories,
    ...(c.moderation.some(
      (scope) => scope.queue === "all" || scope.queue === "discussions"
    )
      ? ["discussions" as const]
      : []),
  ]
  const countFor = (id: string) =>
    summary.data?.find((row) => row.id === id)?.pending ?? null
  const waiting = reviewIds.reduce((sum, id) => sum + (countFor(id) ?? 0), 0)
  const countsKnown =
    reviewIds.length > 0 && reviewIds.every((id) => countFor(id) !== null)
  const allScopes = c.moderation.some(
    (scope) => scope.queue === "all" && scope.locale === null
  )
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
      title={tUi("editorial")}
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
      subtitle={t("editorialLead")}
      footer={
        <DrawerFooter
          href={
            moderates
              ? "/contribute/moderation"
              : docs
                ? "/contribute/knowledge"
                : journal
                  ? "/contribute/knowledge?type=journal"
                  : "/community/drives/new"
          }
          label={moderates ? t("openWorkspace") : t("openEditor")}
          shortcut="Alt E"
          onClose={closeEditorialDrawer}
        />
      }
      onClose={closeEditorialDrawer}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        {moderates ? (
          <DrawerSection
            id="editorial-drawer-review-h"
            title={t("review")}
            description={`You review ${describeScopes(c.moderation, scopeLocales)}.`}
          >
            <div
              aria-live="polite"
              className="mb-2 rounded-[16px] bg-[#19172c] px-3.5 py-3 text-white"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#c5bdf8]">
                  <Icon
                    aria-hidden
                    icon={
                      countsKnown && !waiting
                        ? "mdi:shield-check-outline"
                        : "mdi:clipboard-text-clock-outline"
                    }
                    width={19}
                    height={19}
                  />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[15px] font-semibold">
                    {waiting > 0
                      ? t("waiting", { count: waiting })
                      : countsKnown
                        ? tUi("nothing_waiting_for_review")
                        : summary.isPending
                          ? t("checking")
                          : t("countsUnavailable")}
                  </p>
                  <p className="m-0 mt-0.5 text-[12px] leading-relaxed text-[#d1cedd]">
                    {summary.isPending || countsKnown
                      ? t("reviewPrivacy")
                      : t("partialCounts")}
                  </p>
                </div>
              </div>
            </div>
            <nav
              aria-label={review("reviewQueues")}
              className="divide-y divide-(--t-divider)"
            >
              {reviewIds.map((id) => (
                <DrawerAction
                  key={id}
                  href={
                    id === "discussions"
                      ? "/contribute/moderation?tab=discussions"
                      : `/contribute/moderation?category=${id}`
                  }
                  icon={REVIEW_ICON[id]}
                  label={review(id)}
                  count={
                    countFor(id) ?? (
                      <span
                        aria-label={
                          summary.isPending
                            ? t("checking")
                            : review("countUnavailable")
                        }
                      >
                        —
                      </span>
                    )
                  }
                  onClick={closeEditorialDrawer}
                />
              ))}
            </nav>
            {allScopes ? (
              <div className="mt-2 border-t border-(--t-border-line) pt-2">
                <DrawerAction
                  href="/contribute/moderation/suggestions"
                  icon="mdi:lightbulb-on-outline"
                  label={review("optionSuggestions")}
                  onClick={closeEditorialDrawer}
                />
              </div>
            ) : null}
          </DrawerSection>
        ) : null}

        {docs || journal ? (
          <DrawerSection
            id="editorial-drawer-publishing-h"
            title={t("publishing")}
          >
            <div className="divide-y divide-(--t-border-line)">
              {(["docs", "journal"] as const)
                .filter((kind) => (kind === "docs" ? docs : journal))
                .map((kind) => (
                  <div key={kind} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-2.5 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-(--t-ink-base)">
                          <Icon
                            aria-hidden
                            icon={
                              kind === "docs"
                                ? "mdi:book-open-page-variant-outline"
                                : "mdi:newspaper-variant-outline"
                            }
                            width={17}
                            height={17}
                            className="text-(--t-accent-primary)"
                          />
                          {tUi(kind === "docs" ? "knowledge" : "journal")}
                        </h4>
                        <p className="m-0 mt-1 text-[12px] text-(--t-ink-dim)">
                          {languagesOf(c.editorLocales[kind])}
                        </p>
                      </div>
                      <Link
                        href={kind === "docs" ? "/knowledge" : "/journal"}
                        onClick={closeEditorialDrawer}
                        className="inline-flex min-h-8 items-center text-[12px] font-semibold text-(--t-accent-primary) underline underline-offset-4"
                      >
                        {t("browse")}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/contribute/knowledge/new?type=${kind === "docs" ? "knowledge" : "journal"}`}
                        className={DRAWER_PILL}
                        onClick={closeEditorialDrawer}
                      >
                        <Icon
                          aria-hidden
                          icon="mdi:plus"
                          width={15}
                          height={15}
                        />
                        {tUi("write_an_article")}
                      </Link>
                      <Link
                        href={
                          kind === "docs"
                            ? "/contribute/knowledge"
                            : "/contribute/knowledge?type=journal"
                        }
                        className={DRAWER_PILL}
                        onClick={closeEditorialDrawer}
                      >
                        <Icon
                          aria-hidden
                          icon="mdi:pencil-outline"
                          width={15}
                          height={15}
                        />
                        {tUi("edit_articles")}
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </DrawerSection>
        ) : null}

        {board ? (
          <DrawerSection
            id="editorial-drawer-drives-h"
            title={tUi("drives")}
            description={t("drivesLead")}
          >
            <div className="flex flex-wrap gap-2">
              <Link
                href="/community/drives/new"
                className={DRAWER_PILL}
                onClick={closeEditorialDrawer}
              >
                <Icon aria-hidden icon="mdi:plus" width={15} height={15} />
                {tUi("new_drive")}
              </Link>
              <Link
                href="/community"
                className={DRAWER_PILL}
                onClick={closeEditorialDrawer}
              >
                {tUi("all_drives")}
              </Link>
            </div>
            {featuredDrive ? (
              <div className="mt-3 border-t border-(--t-border-line) pt-2">
                <DrawerAction
                  href={driveHref(featuredDrive.slug)}
                  icon="mdi:pin-outline"
                  label={featuredDrive.title}
                  description={t("featuredDrive")}
                  onClick={closeEditorialDrawer}
                />
              </div>
            ) : null}
          </DrawerSection>
        ) : null}
      </div>
    </Drawer>
  )
}
