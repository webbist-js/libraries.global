import { headers } from "next/headers"
import type { Locale } from "next-intl"

import AppLink from "@/components/elementary/AppLink"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalLink from "@/components/global/GlobalLink"
import GlobalMobileMenu from "@/components/global/GlobalMobileMenu"
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

/** The map's app header also links the Atlas itself, first. */
const APP_NAV_LINKS: NavLink[] = [
  { label: "Atlas", href: "/map" },
  ...NAV_LINKS,
]

export async function GlobalHeader({
  locale,
  variant = "site",
}: {
  readonly locale: Locale
  /**
   * "site": centred nav in a max-width container (every page).
   * "app": full-bleed, nav beside the logo, for full-screen tools like the map.
   */
  readonly variant?: "site" | "app"
}) {
  const sessionSSR = await getSessionSSR(await headers())
  const profileSnippet = sessionSSR?.user
    ? await fetchProfileSnippet(sessionSSR.user.id)
    : null
  const app = variant === "app"
  const links = app ? APP_NAV_LINKS : NAV_LINKS

  const localeSwitcher = (
    <LocaleSwitcher
      locale={locale}
      triggerClassName="h-9 w-auto gap-1 rounded-full border-(--t-border-line) bg-(--t-bg-deep) px-3.5 text-[14px] font-medium uppercase text-(--t-ink-base) shadow-none hover:border-(--t-border-hi) [&_svg]:text-(--t-ink-base) [&_svg]:opacity-100"
    />
  )
  const auth = (
    <GlobalNavbarAuthSection
      sessionSSR={sessionSSR}
      profileSnippet={profileSnippet}
    />
  )
  const contribute = (className = "") => (
    <AppLink
      href="/contribute"
      size="sm"
      className={`h-9 rounded-full border-0 bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) ${className}`}
    >
      Contribute
    </AppLink>
  )

  return (
    <header
      data-global-header=""
      className="global-header sticky top-0 z-[60] w-full border-b border-(--t-border-line) backdrop-blur-xl"
      style={{ background: app ? "var(--t-bg-void)" : "var(--t-header-bg)" }}
    >
      <div
        className={
          app
            ? "relative flex h-14 w-full items-center gap-6 px-4 sm:px-5"
            : "relative mx-auto flex h-14 w-full max-w-[1360px] items-center gap-4 px-4 sm:px-8"
        }
      >
        {/* Left: logo */}
        <div className="flex min-w-0 shrink-0 items-center">
          <GlobalLink
            href="/"
            className="flex items-center text-(--t-ink-base)"
          >
            <span
              className="text-[1.2rem] leading-none font-medium whitespace-nowrap text-(--t-ink-base)"
              style={{ fontFamily: T.font.serif }}
            >
              Libraries <em className="font-normal italic">Global</em>
            </span>
          </GlobalLink>
        </div>

        {/* Centre (or beside the logo in the app header): main nav, lg and up */}
        <GlobalNavLinks links={links} align={app ? "start" : "center"} />

        {/* Pushes the actions right when the nav is collapsed */}
        <span className="flex-1 lg:hidden" aria-hidden="true" />

        {/* Right: locale + auth + contribute, lg and up */}
        <div
          data-header-stable=""
          className="hidden shrink-0 items-center gap-2 lg:flex"
        >
          {localeSwitcher}
          {auth}
          {contribute()}
        </div>

        {/* Below lg: Contribute stays visible from sm; everything else is in the menu */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          {contribute("hidden sm:inline-flex")}
          <GlobalMobileMenu
            links={links}
            actions={
              <>
                {localeSwitcher}
                {auth}
                {contribute("sm:hidden")}
              </>
            }
          />
        </div>
      </div>
    </header>
  )
}

GlobalHeader.displayName = "GlobalHeader"

export default GlobalHeader
