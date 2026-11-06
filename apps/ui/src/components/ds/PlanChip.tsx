"use client"

import type { AccessStanding } from "@repo/access"
import { useTranslations } from "next-intl"

import { useEntitlements } from "@/lib/access-client"

import { Badge } from "./Badge"

/**
 * The viewer's free standing: Explorer, Contributor or Supporter, and
 * nothing when signed out. It labels recognition only: staff authority comes
 * from verified claims, and nothing here is bought. Pass `standing` to show
 * a fixed value (stories, server-known profiles).
 */
export function PlanChip({ standing }: { readonly standing?: AccessStanding }) {
  const t = useTranslations("accessLocks.standing")
  const viewer = useEntitlements()
  const shown = standing ?? (viewer.ready ? viewer.standing : "public")

  if (shown !== "explorer" && shown !== "contributor" && shown !== "supporter")
    return null

  return (
    <Badge
      label={t(shown)}
      color={shown === "supporter" ? "aurora" : "dim"}
      icon={shown === "supporter" ? "mdi:heart-outline" : undefined}
    />
  )
}
