import { headers } from "next/headers"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"
import { getTranslations as getUiTranslations } from "next-intl/server"

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

const NAV_LINKS = [
  { label: "atlas", href: "/map" },
  { label: "find_libraries", href: "/libraries" },
  { label: "community", href: "/community" },
  { label: "journal", href: "/journal" },
  { label: "knowledge", href: "/knowledge" },
] as const

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
  const tUi = await getUiTranslations({ locale, namespace: "ui" })
  const links: NavLink[] = NAV_LINKS.map((link) => ({
    ...link,
    label: tUi(link.label),
  }))
  const requestHeaders = await headers()
  // Public beta/legal pages deliberately have no application query providers.
  if (requestHeaders.get("x-beta-public-shell") === "true")
    return <PublicBetaHeader locale={locale} />

  const sessionSSR = await getSessionSSR(requestHeaders)
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
      triggerClassName="h-9 w-auto gap-1 rounded-full border-(--t-border-line) bg-(--t-bg-deep) px-3.5 text-sm font-medium uppercase text-(--t-ink-base) shadow-none hover:border-(--t-border-hi) [&_svg]:text-(--t-ink-base) [&_svg]:opacity-100"
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
      className="global-header sticky top-0 z-[60] w-full border-b border-(--t-border-hi) backdrop-blur-xl"
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
              {tUi("libraries")}{" "}
              <em className="font-normal text-(--t-accent-primary) italic">
                Global
              </em>
            </span>
          </GlobalLink>
        </div>

        {/* Centre (or beside the logo in the app header): main nav, lg and up */}
        <GlobalNavLinks links={links} align={app ? "start" : "center"} />

        {/* Pushes the actions right when the nav is collapsed */}
        <span className="flex-1 lg:hidden" aria-hidden="true" />

        {/* One Contribute panel across desktop and tablet breakpoints. On
            phones its shortcuts remain in the compact navigation menu. */}
        <div data-header-stable="" className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            {localeSwitcher}
            {auth}
          </div>
          <GlobalContributeMenu className="hidden sm:inline-flex" />
          <GlobalMobileMenu
            links={links}
            shortcuts={<GlobalContributorShortcuts />}
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

function PublicBetaHeader({ locale }: { locale: Locale }) {
  const tUi = useUiTranslations("ui")

  return (
    <header
      className="border-b border-(--t-border-hi)"
      style={{ background: T.bg.void }}
    >
      <div className="mx-auto flex min-h-16 max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <GlobalLink
          href="/beta"
          className="text-[1.2rem] text-(--t-ink-base)"
          style={{ fontFamily: T.font.serif }}
        >
          {tUi("libraries")}{" "}
          <em className="font-normal text-(--t-accent-primary) italic">
            Global
          </em>
        </GlobalLink>
        <div className="flex items-center gap-4">
          <LocaleSwitcher locale={locale} />
          <GlobalLink
            href="/beta"
            className="text-sm font-medium text-(--t-accent-primary) underline underline-offset-4"
          >
            {tUi("back_to_the_beta")}
          </GlobalLink>
        </div>
      </div>
    </header>
  )
}

GlobalHeader.displayName = "GlobalHeader"

export default GlobalHeader
