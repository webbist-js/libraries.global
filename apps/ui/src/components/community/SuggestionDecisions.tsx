"use client"

import { useLocale, useTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import {
  suggestionHref,
  type PublicSuggestion,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

export function SuggestionDecisions({
  items,
}: {
  items: readonly PublicSuggestion[]
}) {
  const t = useTranslations("optionSuggestions")
  const locale = useLocale()
  const decided = items
    .filter(
      (s) =>
        (s.publicationStatus ?? "published") === "published" &&
        ["accepted", "declined"].includes(s.status) &&
        s.decidedAt &&
        Number.isFinite(Date.parse(s.decidedAt))
    )
    .sort((a, b) => Date.parse(b.decidedAt!) - Date.parse(a.decidedAt!))
  const months = [...new Set(decided.map((s) => s.decidedAt!.slice(0, 7)))]
  if (!months.length) return null

  return (
    <div className="grid gap-8">
      {months.map((month) => {
        const monthItems = decided
          .filter((s) => s.decidedAt!.startsWith(month))
          .sort(
            (a, b) =>
              Number(b.status === "accepted") - Number(a.status === "accepted")
          )
        const headingId = `suggestion-decisions-${month}`

        return (
          <section key={month} aria-labelledby={headingId}>
            <h2
              id={headingId}
              className="type-h2 mt-0 mb-5 text-(--t-ink-base)"
            >
              {t("decidedMonth", {
                month: new Intl.DateTimeFormat(locale, {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(new Date(`${month}-01T00:00:00Z`)),
              })}
            </h2>
            <ul
              className={cn(
                "m-0 grid list-none gap-4 p-0 sm:grid-cols-2",
                monthItems.length > 2 && "lg:grid-cols-3"
              )}
            >
              {monthItems.map((s) => (
                <li
                  key={s.documentId}
                  className={cn(
                    "flex h-full flex-col items-start rounded-[26px] p-5 sm:p-6",
                    s.status === "accepted"
                      ? "bg-[#e6f1eb]"
                      : "bg-(--t-bg-muted)"
                  )}
                >
                  <Badge
                    label={t(s.status === "accepted" ? "accepted" : "notAdded")}
                    color={s.status === "accepted" ? "ok" : "dim"}
                    size="md"
                    style={{
                      background: "white",
                      color: s.status === "accepted" ? T.accent.ok : T.ink.dim,
                    }}
                  />
                  <h3 className="type-h3 mt-4 mb-3 text-(--t-ink-base)">
                    <GlobalLink
                      href={suggestionHref(s.documentId)}
                      className="no-underline hover:underline"
                    >
                      {s.name}
                    </GlobalLink>
                  </h3>
                  <p className="m-0 text-base leading-[1.6] text-(--t-ink-dim)">
                    {s.decisionNote || t("legacyDecision")}
                  </p>
                  <p className="mt-auto mb-0 pt-5 text-sm leading-relaxed text-(--t-ink-dim)">
                    {t("votes", { count: s.votes })} ·{" "}
                    {t(`lists.${s.optionKey}`)} ·{" "}
                    {t("conversationReplies", {
                      count: s.commentCount ?? s.conversation?.count ?? 0,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
