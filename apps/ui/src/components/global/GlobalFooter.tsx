import type { Data } from "@repo/strapi-types"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import FooterSocialIcon from "@/components/global/FooterSocialIcon"
import GlobalLink from "@/components/global/GlobalLink"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"

type FooterData = Data.ContentType<"api::footer.footer"> | null | undefined

export function GlobalFooter({
  locale: _locale,
  footer,
}: {
  readonly locale: Locale
  readonly footer: FooterData
}) {
  const sections = Array.isArray(footer?.sections) ? footer.sections : []
  const links = Array.isArray(footer?.links) ? footer.links : []
  const socialLinks = Array.isArray(footer?.socialLinks)
    ? footer.socialLinks
    : []
  const copyRight =
    footer?.copyRight?.replace("{YEAR}", new Date().getFullYear().toString()) ??
    null

  return (
    <footer className="relative z-20 border-t border-white/10 bg-[#0b1117]">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-12 border-b border-white/10 pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <div className="space-y-4">
              {footer?.title ? (
                <h2 className="text-[clamp(1.35rem,2.2vw,1.95rem)] leading-[1.02] font-semibold tracking-[-0.04em] text-white">
                  {footer.title}
                </h2>
              ) : null}

              {footer?.text ? (
                <p className="block text-lg text-white/58 transition-colors">
                  {footer.text}
                </p>
              ) : null}
            </div>
          </div>

          {sections.length > 0 ? (
            <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => (
                <div key={section.id ?? section.title} className="space-y-4">
                  <h2 className="text-sm font-semibold tracking-[0.2em] text-white uppercase">
                    {section.title}
                  </h2>

                  <div className="space-y-3">
                    {section.links?.map((link, index) => (
                      <GlobalLink
                        key={link.id ?? link.page?.slug ?? link.href ?? index}
                        href={getStrapiLinkHref(link)}
                        className="block text-lg text-white/58 transition-colors hover:text-white"
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

        {links.length > 0 || socialLinks.length > 0 || copyRight ? (
          <div className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              {links.length > 0 ? (
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-base text-white/58">
                  {links.map((link, index) => (
                    <GlobalLink
                      key={link.id ?? link.page?.slug ?? link.href ?? index}
                      href={getStrapiLinkHref(link)}
                      className="transition-colors hover:text-white"
                    >
                      {link.label}
                    </GlobalLink>
                  ))}
                </div>
              ) : null}

              {copyRight ? (
                <p className="text-sm text-white/34">
                  &copy; {new Date().getFullYear()} {copyRight}
                </p>
              ) : null}
            </div>

            {socialLinks.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                {socialLinks.map((socialLink, index) => (
                  <GlobalLink
                    key={
                      socialLink.id ??
                      socialLink.url ??
                      `${socialLink.platform}-${index}`
                    }
                    href={socialLink.url}
                    aria-label={
                      socialLink.label ?? socialLink.platform ?? "Social link"
                    }
                    className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-white"
                  >
                    <FooterSocialIcon platform={socialLink.platform} />
                    <span className="sr-only">
                      {socialLink.label ?? socialLink.platform ?? "Social link"}
                    </span>
                  </GlobalLink>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Container>
    </footer>
  )
}

GlobalFooter.displayName = "GlobalFooter"

export default GlobalFooter
