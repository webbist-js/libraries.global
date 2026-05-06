import { headers } from "next/headers"
import type { Locale } from "next-intl"

import AppLink from "@/components/elementary/AppLink"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalLink from "@/components/global/GlobalLink"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Atlas", href: "/" },
  { label: "Index", href: "/index" },
  { label: "Map", href: "/map" },
  { label: "Wiki", href: "/wiki" },
  { label: "Journal", href: "/blog" },
  { label: "Events", href: "/events" },
]

type ProfileSnippet = {
  avatarUrl?: string | null
  username?: string | null
  isVerifiedLibrarian?: boolean | null
}

async function fetchProfileSnippet(
  baUserId: string
): Promise<ProfileSnippet | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const params = new URLSearchParams({
      "filters[baUserId][$eq]": baUserId,
      "fields[0]": "username",
      "fields[1]": "isVerifiedLibrarian",
      "populate[avatar][fields][0]": "url",
    })
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?${params.toString()}`,
      {
        cache: "no-store",
        headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: {
        username?: string | null
        isVerifiedLibrarian?: boolean | null
        avatar?: { url?: string | null } | null
      }[]
    }
    const item = json.data?.[0]
    if (!item) return null

    return {
      username: item.username ?? null,
      isVerifiedLibrarian: item.isVerifiedLibrarian ?? null,
      avatarUrl: item.avatar?.url ?? null,
    }
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

export async function GlobalHeader({ locale }: { readonly locale: Locale }) {
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
            href="/"
            className="flex items-center text-(--t-ink-base)"
          >
            <span
              className="text-[1rem] leading-none font-semibold text-(--t-ink-base)"
              style={{ fontFamily: T.font.serif }}
            >
              Libraries{" "}
              <em className="font-normal text-(--t-ink-dim) italic">of the </em>
              World
            </span>
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

        {/* Center: hardcoded nav */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => (
            <GlobalLink
              key={link.href}
              href={link.href}
              className="rounded-md px-3.5 py-2 text-sm text-(--t-ink-dim) transition-colors hover:text-(--t-ink-base)"
            >
              {link.label}
            </GlobalLink>
          ))}
        </nav>

        {/* Right: locale + auth + contribute */}
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
