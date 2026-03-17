import type { Data } from "@repo/strapi-types"
import type { Locale } from "next-intl"

import AppLink from "@/components/elementary/AppLink"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { StrapiBasicImage } from "@/components/page-builder/components/utilities/StrapiBasicImage"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import { cn } from "@/lib/styles"

type NavbarData = Data.ContentType<"api::navbar.navbar"> | null | undefined

export function GlobalHeader({
  locale: _locale,
  navbar,
}: {
  readonly locale: Locale
  readonly navbar: NavbarData
}) {
  const links = Array.isArray(navbar?.links) ? navbar.links : []
  const logoHref = getStrapiLinkHref(navbar?.logoImage?.link) ?? "/"

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/10 backdrop-blur-xl">
      <Container className="flex h-18 items-center justify-between gap-6 py-3">
        <div className="flex items-center gap-8">
          <GlobalLink
            href={logoHref}
            className="flex items-center gap-3 text-white"
            fallbackAs="div"
          >
            {navbar?.logoImage?.image ? (
              <StrapiBasicImage
                component={navbar.logoImage.image}
                forcedSizes={{ width: 150, height: 40 }}
                className="h-auto max-h-10 w-auto"
                hideWhenMissing
              />
            ) : (
              <>
                <span className="flex size-3 rounded-[4px] bg-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.8)]" />
                <span className="text-sm font-semibold tracking-[0.02em] text-white/95 sm:text-base">
                  Global Library Explorer
                </span>
              </>
            )}
          </GlobalLink>

          {links.length > 0 ? (
            <nav className="hidden items-center gap-2 md:flex">
              {links.map((link, index) => (
                <GlobalLink
                  key={link.id ?? link.page?.slug ?? link.href ?? index}
                  href={getStrapiLinkHref(link)}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm text-white/68 transition-colors hover:text-white",
                    index === 0 &&
                      "bg-white/6 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  )}
                >
                  {link.label}
                </GlobalLink>
              ))}
            </nav>
          ) : null}
        </div>

        <AppLink
          href="/auth/signin"
          variant="outline"
          size="sm"
          className="border-white/14 bg-white/95 text-slate-950 shadow-[0_14px_40px_rgba(0,0,0,0.18)] hover:bg-white"
        >
          Sign in
        </AppLink>
      </Container>
    </header>
  )
}

GlobalHeader.displayName = "GlobalHeader"

export default GlobalHeader
