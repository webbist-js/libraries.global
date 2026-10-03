import type { ReactNode } from "react"

import { PageHero } from "@/components/ds"

import { ContributeNavBar } from "../../_components/ContributeNavBar"

/** The Moderation tab's compact hero, with the Contribute tabs below it. */
export function ModerationHero({
  title,
  lead,
  leaf,
  children,
}: {
  readonly title: string
  readonly lead?: ReactNode
  /** Breadcrumb leaf after "Moderation", on sub-pages. */
  readonly leaf?: string
  readonly children?: ReactNode
}) {
  return (
    <PageHero
      breadcrumb={[
        { label: "Home", href: "/" },
        { label: "Contribute", href: "/contribute" },
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
      lead={lead}
      compact
      tabs={<ContributeNavBar />}
    >
      {children}
    </PageHero>
  )
}
