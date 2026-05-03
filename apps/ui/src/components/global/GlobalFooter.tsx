import type { Data } from "@repo/strapi-types"
import type { Locale } from "next-intl"
import React from "react"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import { T } from "@/lib/design-tokens"

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
  const year = new Date().getFullYear()

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
          className="grid gap-12 border-b pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]"
          style={{ borderBottomColor: T.border.line }}
        >
          {/* Brand column */}
          <div className="space-y-4">
            {footer?.title ? (
              <h2
                className="text-[1.6rem] leading-[1.1] font-semibold tracking-[-0.02em]"
                style={{ fontFamily: T.font.serif, color: T.ink.base }}
              >
                {footer.title}
              </h2>
            ) : (
              <h2
                className="text-[1.6rem] leading-[1.1] font-semibold tracking-[-0.02em]"
                style={{ fontFamily: T.font.serif, color: T.ink.base }}
              >
                Libraries of the World
              </h2>
            )}

            {footer?.text ? (
              <p
                className="max-w-[28ch] text-[14px] leading-6"
                style={{ color: T.ink.low }}
              >
                {footer.text}
              </p>
            ) : null}
          </div>

          {/* Nav sections */}
          {sections.length > 0 ? (
            <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => (
                <div key={section.id ?? section.title} className="space-y-4">
                  <p
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "10px",
                      letterSpacing: ".22em",
                      textTransform: "uppercase",
                      color: T.ink.low,
                      margin: 0,
                    }}
                  >
                    {section.title}
                  </p>

                  <div className="space-y-3">
                    {section.links?.map((link, index) => (
                      <GlobalLink
                        key={link.id ?? link.page?.slug ?? link.href ?? index}
                        href={getStrapiLinkHref(link)}
                        className="block text-[15px] text-(--t-ink-base) opacity-80 transition-[opacity,color] hover:text-(--t-accent-aurora) hover:opacity-100"
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
          <p
            className="font-mono text-[10px] tracking-[0.18em] uppercase"
            style={{ color: T.ink.low }}
          >
            © {year} · Libraries of the World · Indexing the World&rsquo;s
            Libraries
          </p>

          {/* Right: legal links */}
          {links.length > 0 ? (
            <div className="flex items-center gap-3">
              {links.map((link, index) => (
                <React.Fragment
                  key={link.id ?? link.page?.slug ?? link.href ?? index}
                >
                  {index > 0 ? (
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: T.ink.ghost }}
                    >
                      ·
                    </span>
                  ) : null}
                  <GlobalLink
                    href={getStrapiLinkHref(link)}
                    className="font-mono text-[10px] tracking-[0.18em] text-(--t-ink-dim) uppercase transition-colors hover:text-(--t-ink-base)"
                  >
                    {link.label}
                  </GlobalLink>
                </React.Fragment>
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
