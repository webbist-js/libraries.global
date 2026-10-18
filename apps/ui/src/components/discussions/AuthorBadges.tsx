"use client"

import { useTranslations } from "next-intl"
import type { PublicAuthorBadge } from "strapi-plugin-discussions/types"

import { Badge } from "@/components/ds/Badge"

/** Only server-projected tags are displayed; these never grant UI permissions. */
export function AuthorBadges({
  badges,
}: {
  badges?: readonly PublicAuthorBadge[]
}) {
  const t = useTranslations("authorBadges")
  const allowed = [...new Set(badges)].filter((badge) =>
    ["editorial_board", "editor", "moderator", "suggested_this"].includes(badge)
  )
  if (!allowed.length) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {allowed.map((badge) => (
        <Badge
          key={badge}
          size="xs"
          label={t(badge)}
          color={badge === "suggested_this" ? "dim" : "violet"}
          icon={badge === "moderator" ? "mdi:shield-check-outline" : undefined}
          style={
            badge === "editorial_board"
              ? { background: "var(--t-ink-base)", color: "white" }
              : undefined
          }
        />
      ))}
    </span>
  )
}
