import { Icon } from "@iconify/react"
import type { Data } from "@repo/strapi-types"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import { KOFI_URL, SITE_NAME } from "@/lib/constants"
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
  /** Published legal documents — always listed in the bottom bar. */
  readonly legalDocuments?: LegalDocumentNavItem[]
}) {
  const sections = Array.isArray(footer?.sections) ? footer.sections : []
  const year = new Date().getFullYear()

  // The bottom bar lists every published legal document, so it never points
  // at an unpublished one. Extra CMS links follow, minus any with nowhere to
  // go and any /legal/ link (those come from the documents themselves).
  const legalLinks = legalDocuments.flatMap((doc) =>
    doc.slug
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
      if (!href || href === "#" || href.startsWith("/legal/")) return []

      return [{ key: String(link.id ?? index), label: link.label, href }]
    }
  )
  const links = [...legalLinks, ...cmsLinks]

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
              href={KOFI_URL}
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-[15px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary)"
              style={{ borderColor: T.border.hi }}
            >
              <Icon icon="simple-icons:kofi" className="size-4" aria-hidden />
              Support us on Ko-fi
              <span className="sr-only"> (opens in a new tab)</span>
            </GlobalLink>
          </div>

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

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: copyright + tagline */}
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            © {year} {SITE_NAME} · Indexing the world&rsquo;s libraries
          </p>

          {/* Right: legal links */}
          {links.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {links.map((link) => (
                <GlobalLink
                  key={link.key}
                  href={link.href}
                  className="text-[15px] text-(--t-ink-dim) underline underline-offset-4 transition-colors hover:text-(--t-accent-primary)"
                >
                  {link.label}
                </GlobalLink>
              ))}
            </div>
          ) : null}
        </div>
      </Container>
    </footer>
  )
}

GlobalFooter.displayName = "GlobalFooter"

export default GlobalFooter
