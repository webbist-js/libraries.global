import type { Data } from "@repo/strapi-types"
import type { Locale } from "next-intl"
import { headers } from "next/headers"

import AppLink from "@/components/elementary/AppLink"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalLink from "@/components/global/GlobalLink"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { StrapiBasicImage } from "@/components/page-builder/components/utilities/StrapiBasicImage"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import { T } from "@/lib/design-tokens"
import { getSessionSSR } from "@/lib/auth-server"

type NavbarData = Data.ContentType<"api::navbar.navbar"> | null | undefined

async function fetchLibraryCount(): Promise<number | null> {
  try {
    const res = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/libraries?pagination[pageSize]=1&fields[0]=id&status=published`,
      { next: { revalidate: 300 } }
    )
    const data = (await res.json()) as {
      meta?: { pagination?: { total?: number } }
    }

    return data?.meta?.pagination?.total ?? null
  } catch {
    return null
  }
}

export async function GlobalHeader({
  locale,
  navbar,
}: {
  readonly locale: Locale
  readonly navbar: NavbarData
}) {
  const links = Array.isArray(navbar?.links) ? navbar.links : []
  const logoHref = getStrapiLinkHref(navbar?.logoImage?.link) ?? "/"
  const [libraryCount, sessionSSR] = await Promise.all([
    fetchLibraryCount(),
    getSessionSSR(await headers()),
  ])

  return (
    <header
      data-global-header=""
      className="global-header sticky top-0 z-[60] w-full border-b border-white/[0.08] bg-[rgba(5,8,22,.80)] backdrop-blur-xl"
    >
      <div className="flex h-14 w-full items-center gap-4 px-6 md:px-10">
        {/* Left: logo + live badge */}
        <div className="flex shrink-0 items-center gap-3">
          <GlobalLink
            href={logoHref}
            className="flex items-center text-white"
            fallbackAs="div"
          >
            {navbar?.logoImage?.image ? (
              <StrapiBasicImage
                component={navbar.logoImage.image}
                forcedSizes={{ width: 150, height: 36 }}
                className="h-auto max-h-9 w-auto"
                hideWhenMissing
              />
            ) : (
              <span
                className="text-[1rem] leading-none font-semibold text-white"
                style={{ fontFamily: T.font.serif }}
              >
                Libraries{" "}
                <em className="font-normal text-white/68 italic">of the </em>
                World
              </span>
            )}
          </GlobalLink>

          {libraryCount != null ? (
            <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-white/38 uppercase sm:flex">
              <span className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]" />
              LIVE INDEX · {libraryCount.toLocaleString("en-US")}
            </div>
          ) : null}
        </div>

        {/* Center: nav */}
        {links.length > 0 ? (
          <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
            {links.map((link, index) => (
              <GlobalLink
                key={link.id ?? link.page?.slug ?? link.href ?? index}
                href={getStrapiLinkHref(link)}
                className="rounded-md px-3.5 py-2 text-sm text-white/55 transition-colors hover:text-white/90"
              >
                {link.label}
              </GlobalLink>
            ))}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right: locale + sign in + contribute */}
        <div className="flex shrink-0 items-center gap-1">
          <LocaleSwitcher
            locale={locale}
            triggerClassName="h-8 w-auto gap-1 border-transparent bg-transparent px-2.5 text-xs font-semibold uppercase tracking-wider text-white/45 hover:text-white/75"
          />
          <GlobalNavbarAuthSection sessionSSR={sessionSSR} />
          <AppLink
            href="/contribute"
            size="sm"
            className="ml-1 rounded-full border-0 bg-white px-4 py-2 text-[13px] font-semibold text-slate-950 shadow-[0_2px_16px_rgba(255,255,255,0.12)] transition-all hover:bg-white/90"
          >
            Contribute
          </AppLink>
        </div>
      </div>
    </header>
  )
}

GlobalHeader.displayName = "GlobalHeader"

export default GlobalHeader
