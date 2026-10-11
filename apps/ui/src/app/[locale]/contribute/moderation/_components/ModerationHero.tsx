import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { PageHero } from "@/components/ds"

import { ContributeNavBar } from "../../_components/ContributeNavBar"

/** The Moderation tab's compact hero, with the Contribute tabs below it. */
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
      breadcrumb={[
        { label: tUi("home"), href: "/" },
        { label: tUi("contribute"), href: "/contribute" },
        ...(leaf
          ? [
              { label: "Moderation", href: "/contribute/moderation" },
              { label: leaf },
            ]
          : [{ label: "Moderation" }]),
      ]}
      eyebrow="Moderation"
      eyebrowIcon="mdi:shield-check-outline"
      title={title}
      plainTitle={plainTitle}
      lead={lead}
      compact
      tabs={<ContributeNavBar />}
    >
      {children}
    </PageHero>
  )
}
