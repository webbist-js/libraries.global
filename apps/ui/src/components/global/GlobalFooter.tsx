import type { Data } from "@repo/strapi-types"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import { SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"
import type { LegalDocumentNavItem } from "@/lib/strapi-api/content/server"

type FooterData = Data.ContentType<"api::footer.footer"> | null | undefined

export function GlobalFooter({
  locale: _locale,
  footer,
  legalDocuments = [],
}: {
  readonly locale: Locale
  readonly footer: FooterData
  /** Published documents determine the direct links; the index lists them all. */
  readonly legalDocuments?: LegalDocumentNavItem[]
}) {
  const tUi = useUiTranslations("ui")

  const sections = Array.isArray(footer?.sections) ? footer.sections : []
  const year = new Date().getFullYear()

  // Keep frequent destinations direct. The legal index lists every published
  // policy, including documents added later, without growing the bottom bar.
  const legalLinks = legalDocuments.flatMap((doc) =>
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
  const cmsLinks = (Array.isArray(footer?.links) ? footer.links : []).flatMap(
    (link, index) => {
      const href = getStrapiLinkHref(link)
      if (
        !href ||
        href === "#" ||
        href === "/legal" ||
        href.startsWith("/legal/")
      )
        return []

      return [{ key: String(link.id ?? index), label: link.label, href }]
    }
  )
  const links = [
    ...(legalDocuments.some((doc) => doc.slug)
      ? [{ key: "legal-index", label: tUi("legal_policies"), href: "/legal" }]
      : []),
    ...legalLinks,
    ...cmsLinks,
  ]

  return (
    <footer
      className="relative z-20"
      style={{
        borderTop: `1px solid ${T.border.line}`,
        background: T.bg.space,
      }}
    >
      <Container className="py-14 sm:py-16">
        {/* Main grid: logo col + sections */}
        <div
          className="grid gap-12 border-b pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]"
          style={{ borderBottomColor: T.border.line }}
        >
          {/* Brand column */}
          <div className="flex flex-col items-start">
            <h2
              className="m-0 mb-3 text-[30px] leading-[1.15] font-medium tracking-[-0.015em]"
              style={{ fontFamily: T.font.serif, color: T.ink.base }}
            >
              {footer?.title || SITE_NAME}
            </h2>

            {footer?.text ? (
              <p
                className="m-0 max-w-[34ch] text-[15px] leading-[1.7]"
                style={{ color: T.ink.dim }}
              >
                {footer.text}
              </p>
            ) : null}

            <GlobalLink
              href="/about"
              className="mt-5 text-[14px] text-(--t-ink-base) underline underline-offset-4 transition-colors hover:text-(--t-accent-primary)"
            >
              {tUi("about_the_project")}
            </GlobalLink>
          </div>

          <div className="flex flex-col gap-10">
            {/* Nav sections */}
            {sections.length > 0 ? (
              <div className="grid gap-10 sm:grid-cols-3">
                {sections.map((section) => (
                  <div
                    key={section.id ?? section.title}
                    className="flex flex-col gap-5"
                  >
                    <p
                      className="m-0 text-[18px] font-bold"
                      style={{ color: T.ink.dim }}
                    >
                      {section.title}
                    </p>

                    <div className="space-y-2.5">
                      {section.links?.map((link, index) => (
                        <GlobalLink
                          key={link.id ?? link.page?.slug ?? link.href ?? index}
                          href={getStrapiLinkHref(link)}
                          className="block w-fit text-[17px] text-(--t-ink-base) transition-colors hover:text-(--t-accent-primary)"
                        >
                          {link.label}
                        </GlobalLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-x-8 gap-y-3 pt-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: copyright + tagline */}
          <p
            className="m-0 text-[13px] leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            © {year} {SITE_NAME} · Indexing the world&rsquo;s libraries
          </p>

          {/* Right: legal links */}
          {links.length > 0 ? (
            <nav
              aria-label={tUi("legal_documents")}
              className="flex flex-wrap items-center gap-x-5 gap-y-1"
            >
              {links.map((link) => (
                <GlobalLink
                  key={link.key}
                  href={link.href}
                  className="inline-flex min-h-11 items-center text-[13px] text-(--t-ink-dim) underline underline-offset-4 transition-colors hover:text-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {link.label}
                </GlobalLink>
              ))}
            </nav>
          ) : null}
        </div>
      </Container>
    </footer>
  )
}

GlobalFooter.displayName = "GlobalFooter"

export default GlobalFooter
