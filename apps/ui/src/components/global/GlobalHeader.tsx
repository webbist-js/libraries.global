import { headers } from "next/headers"
import type { Locale } from "next-intl"

import AppLink from "@/components/elementary/AppLink"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalLink from "@/components/global/GlobalLink"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import GlobalNavLinks, {
  type NavLink,
} from "@/components/global/GlobalNavLinks"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

const NAV_LINKS: NavLink[] = [
  { label: "Find libraries", href: "/index" },
  { label: "Journal", href: "/blog" },
  { label: "Events", href: "/events" },
  { label: "Docs", href: "/docs" },
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

export async function GlobalHeader({ locale }: { readonly locale: Locale }) {
  const sessionSSR = await getSessionSSR(await headers())
  const profileSnippet = sessionSSR?.user
    ? await fetchProfileSnippet(sessionSSR.user.id)
    : null

  return (
    <header
      data-global-header=""
      className="global-header sticky top-0 z-[60] w-full border-b border-(--t-border-line) backdrop-blur-xl"
      style={{ background: "var(--t-header-bg)" }}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1360px] items-center gap-4 px-4 sm:px-8">
        {/* Left: logo */}
        <div className="flex shrink-0 items-center">
          <GlobalLink
            href="/"
            className="flex items-center text-(--t-ink-base)"
          >
            <span
              className="text-[1.2rem] leading-none font-medium text-(--t-ink-base)"
              style={{ fontFamily: T.font.serif }}
            >
              Libraries <em className="font-normal italic">of the </em>
              World
            </span>
          </GlobalLink>
        </div>

        {/* Center: main nav (active section renders as an ink pill) */}
        <GlobalNavLinks links={NAV_LINKS} />

        {/* Right: locale + auth + contribute */}
        <div data-header-stable="" className="flex shrink-0 items-center gap-2">
          <LocaleSwitcher
            locale={locale}
            triggerClassName="h-9 w-auto gap-1 rounded-full border-(--t-border-line) bg-(--t-bg-deep) px-3.5 text-[14px] font-medium uppercase text-(--t-ink-base) shadow-none hover:border-(--t-border-hi) [&_svg]:text-(--t-ink-base) [&_svg]:opacity-100"
          />
          <GlobalNavbarAuthSection
            sessionSSR={sessionSSR}
            profileSnippet={profileSnippet}
          />
          <AppLink
            href="/contribute"
            size="sm"
            className="h-9 rounded-full border-0 bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"
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
