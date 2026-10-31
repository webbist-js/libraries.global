import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { WorkspaceHero as PageHero } from "@/components/dashboard/WorkspaceHero"

/** Compact hero within the independent moderation workspace. */
export function ModerationHero({
  title,
  lead,
  leaf,
  plainTitle,
  children,
}: {
  readonly title: string
  /** A contributor's text as the title: never parsed as `*italic*`. */
  readonly plainTitle?: boolean
  readonly lead?: ReactNode
  /** Breadcrumb leaf after "Moderation", on sub-pages. */
  readonly leaf?: string
  readonly children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  return (
    <PageHero
      variant="card"
      breadcrumb={[
        { label: tUi("home"), href: "/" },
        ...(leaf
          ? [{ label: "Moderation", href: "/moderation" }, { label: leaf }]
          : [{ label: "Moderation" }]),
      ]}
      eyebrow="Moderation"
      eyebrowIcon="mdi:shield-check-outline"
      title={title}
      plainTitle={plainTitle}
      lead={lead}
      compact
    >
      {children}
    </PageHero>
  )
}
