import { useTranslations } from "next-intl"

import {
  buildFooterNavigation,
  type FooterData,
} from "@/components/global/footer-navigation"
import GlobalLink from "@/components/global/GlobalLink"
import type { LegalDocumentNavItem } from "@/lib/strapi-api/content/server"

const isAllowedFooterHref = (href: string) => {
  try {
    const parsed = new URL(href, "https://libraries.global")
    const hostname = parsed.hostname.toLowerCase()
    const pathname = parsed.pathname.toLowerCase()
    const isGithubHost =
      hostname === "github.com" || hostname.endsWith(".github.com")
    const isAllowedPath =
      pathname.includes("methodology") ||
      pathname.includes("how-the-data") ||
      pathname.includes("data-licence")

    return isGithubHost || isAllowedPath
  } catch {
    return false
  }
}

/** The homepage closes with the published footer’s policy links and project references. */
export function HomeFooter({
  footer,
  legalDocuments,
}: {
  readonly footer: FooterData
  readonly legalDocuments: LegalDocumentNavItem[]
}) {
  const t = useTranslations("ui")
  const navigation = buildFooterNavigation(footer, legalDocuments, {
    legal: t("legal_policies"),
    plans: t("plans_and_pricing"),
  })
  const links = [
    ...navigation.links,
    ...navigation.sections
      .flatMap((section) => section.links)
      .filter((link) => isAllowedFooterHref(link.href)),
  ]
  const unique = [...new Map(links.map((link) => [link.href, link])).values()]

  return (
    <footer className="home-footer">
      <div className="home-frame">
        <p>
          © {new Date().getFullYear()} Libraries Global · An independent,
          open-source project
        </p>
        <nav aria-label="Project and policies">
          <GlobalLink href="/about">{t("about_the_project")}</GlobalLink>
          {unique.map((link) => (
            <GlobalLink key={link.href} href={link.href}>
              {link.label}
            </GlobalLink>
          ))}
        </nav>
      </div>
    </footer>
  )
}
