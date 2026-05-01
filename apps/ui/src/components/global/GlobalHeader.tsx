import type { Data } from "@repo/strapi-types"
import { headers } from "next/headers"
import type { Locale } from "next-intl"

import AppLink from "@/components/elementary/AppLink"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalLink from "@/components/global/GlobalLink"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { StrapiBasicImage } from "@/components/page-builder/components/utilities/StrapiBasicImage"
import { getStrapiLinkHref } from "@/components/page-builder/components/utilities/StrapiLink"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

type NavbarData = Data.ContentType<"api::navbar.navbar"> | null | undefined

type ProfileSnippet = { avatarUrl?: string | null; username?: string | null }

async function fetchProfileSnippet(
  baUserId: string
): Promise<ProfileSnippet | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&fields[0]=avatarUrl&fields[1]=username`,
      {
        next: { revalidate: 30 },
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: ProfileSnippet[] }

    return json.data?.[0] ?? null
  } catch {
    return null
  }
}

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
  const profileSnippet = sessionSSR?.user
    ? await fetchProfileSnippet(sessionSSR.user.id)
    : null

  return (
    <header
      data-global-header=""
      className="global-header sticky top-0 z-[60] w-full border-b border-(--t-border-line) backdrop-blur-xl"
      style={{ background: "var(--t-header-bg)" }}
    >
      <div className="flex h-14 w-full items-center gap-4 px-6 md:px-10">
        {/* Left: logo + live badge */}
        <div className="flex shrink-0 items-center gap-3">
          <GlobalLink
            href={logoHref}
            className="flex items-center text-(--t-ink-base)"
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
                className="text-[1rem] leading-none font-semibold text-(--t-ink-base)"
                style={{ fontFamily: T.font.serif }}
              >
                Libraries{" "}
                <em className="font-normal text-(--t-ink-dim) italic">
                  of the{" "}
                </em>
                World
              </span>
            )}
          </GlobalLink>

          {libraryCount != null ? (
            <div
              data-header-stable=""
              className="hidden items-center gap-1.5 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-(--t-ink-faint) uppercase sm:flex"
            >
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
                className="rounded-md px-3.5 py-2 text-sm text-(--t-ink-dim) transition-colors hover:text-(--t-ink-base)"
              >
                {link.label}
              </GlobalLink>
            ))}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right: locale + sign in + contribute */}
        <div data-header-stable="" className="flex shrink-0 items-center gap-1">
          <LocaleSwitcher
            locale={locale}
            triggerClassName="h-8 w-auto gap-1 border-transparent bg-transparent px-2.5 text-xs font-semibold uppercase tracking-wider text-(--t-ink-faint) hover:text-(--t-ink-dim)"
          />
          <GlobalNavbarAuthSection
            sessionSSR={sessionSSR}
            profileSnippet={profileSnippet}
          />
          <AppLink
            href="/contribute"
            size="sm"
            className="ml-1 rounded-full border-0 bg-(--t-ink-base) px-4 py-2 text-[13px] font-semibold text-(--t-bg-void) shadow-[0_1px_12px_rgba(0,0,0,0.15)] transition-all hover:opacity-90"
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
