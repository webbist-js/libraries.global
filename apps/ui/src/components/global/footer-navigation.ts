import { membershipLink } from "@repo/shared-data"
import type { Data } from "@repo/strapi-types"

import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import type { LegalDocumentNavItem } from "@/lib/strapi-api/content/server"

export type FooterData =
  | Data.ContentType<"api::footer.footer">
  | null
  | undefined
type MenuLink = { key: string; label: string; href: string }

export type FooterNavigation = {
  sections: { key: string; title: string; links: MenuLink[] }[]
  links: MenuLink[]
}

/** One published navigation model for the footer and dashboard's More drawer. */
export function buildFooterNavigation(
  footer: FooterData,
  documents: LegalDocumentNavItem[],
  labels: { legal: string; plans: string }
): FooterNavigation {
  const sections = (Array.isArray(footer?.sections) ? footer.sections : []).map(
    (section, index) => ({
      key: String(section.id ?? index),
      title: section.title ?? "",
      links: (section.links ?? []).flatMap((link, index) => {
        const href = getStrapiLinkHref(link)
        if (!href || href === "#") return []

        return [
          {
            key: String(link.id ?? index),
            label:
              /^(?:https?:\/\/(?:www\.)?libraries\.global)?(?:\/(?:en|fr|cs))?\/plans(?:[?#]|$)/.test(
                membershipLink(href)
              )
                ? labels.plans
                : link.label || href,
            href,
          },
        ]
      }),
    })
  )
  const legal = documents.flatMap((doc) =>
    doc.slug && ["privacy", "accessibility"].includes(doc.slug)
      ? [
          {
            key: doc.documentId,
            label: doc.title ?? doc.slug,
            href: `/legal/${doc.slug}`,
          },
        ]
      : []
  )
  const cms = (Array.isArray(footer?.links) ? footer.links : []).flatMap(
    (link, index) => {
      const href = getStrapiLinkHref(link)
      if (
        !href ||
        href === "#" ||
        href === "/legal" ||
        href.startsWith("/legal/")
      )
        return []

      return [
        { key: String(link.id ?? index), label: link.label || href, href },
      ]
    }
  )

  return {
    sections,
    links: [
      ...(documents.some((doc) => doc.slug)
        ? [{ key: "legal-index", label: labels.legal, href: "/legal" }]
        : []),
      ...legal,
      ...cms,
    ],
  }
}
