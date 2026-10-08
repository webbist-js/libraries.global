import { headers } from "next/headers"
import type { Locale } from "next-intl"

import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import GlobalContributeMenu from "@/components/global/GlobalContributeMenu"
import GlobalContributorShortcuts from "@/components/global/GlobalContributorShortcuts"
import GlobalLink from "@/components/global/GlobalLink"
import GlobalMobileMenu from "@/components/global/GlobalMobileMenu"
import { GlobalNavbarAuthSection } from "@/components/global/GlobalNavbarAuthSection"
import GlobalNavLinks, {
  type NavLink,
} from "@/components/global/GlobalNavLinks"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchOwnProfileSnippet } from "@/lib/own-profile-server"

const NAV_LINKS: NavLink[] = [
  { label: "Atlas", href: "/map" },
  { label: "Find libraries", href: "/libraries" },
  { label: "Community", href: "/community" },
  { label: "Journal", href: "/journal" },
  { label: "Events", href: "/events" },
  { label: "Knowledge", href: "/knowledge" },
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
  // The username comes from the session (buildSessionAccess); avatar and
  // librarian flag from the owner-scoped bridge read. `baUserId` is private,
  // so the public REST filter on it no longer works.
  const profileSnippet = sessionSSR?.user
    ? await fetchOwnProfileSnippet(sessionSSR.user)
    : null
  const app = variant === "app"

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
        <GlobalNavLinks links={NAV_LINKS} align={app ? "start" : "center"} />

        {/* Pushes the actions right when the nav is collapsed */}
        <span className="flex-1 lg:hidden" aria-hidden="true" />

        {/* Right: locale + auth + contribute, lg and up */}
        <div
          data-header-stable=""
          className="hidden shrink-0 items-center gap-2 lg:flex"
        >
          {localeSwitcher}
          {auth}
          <GlobalContributeMenu />
        </div>

        {/* Below lg: Contribute stays visible from sm; below that the menu's
            Contribute section covers it, and everything else is in the menu */}
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <GlobalContributeMenu className="hidden sm:inline-flex" />
          <GlobalMobileMenu
            links={NAV_LINKS}
            shortcuts={<GlobalContributorShortcuts variant="mobile" />}
            actions={
              <>
                {localeSwitcher}
                {auth}
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
