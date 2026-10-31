"use client"

import {
  BookOpen,
  Code2,
  Globe,
  Library,
  ListChecks,
  Menu,
  NotebookText,
  Network,
  Sparkles,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { AppearanceControl } from "@/components/appearance/AppearanceControl"
import {
  DashboardDrawer,
  useDashboardOverlay,
} from "@/components/dashboard/DashboardFrame"
import LocaleSwitcher from "@/components/elementary/LocaleSwitcher"
import { useFooterNavigation } from "@/components/global/FooterNavigationContext"
import type { GLOBAL_NAVIGATION } from "@/components/global/global-navigation"
import { ContributeMenuPanel } from "@/components/global/GlobalContributeMenu"
import GlobalLink from "@/components/global/GlobalLink"
import type { NavLink } from "@/components/global/GlobalNavLinks"
import { LibrariesGlobalMark } from "@/components/global/LibrariesGlobalMark"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useContributeMenu } from "@/hooks/useContributeMenu"
import { useHydratedSession } from "@/lib/access-client"
import { hasCapability } from "@/lib/access-server"
import {
  analyticsAttributes,
  navigationAttributes,
} from "@/lib/analytics-events"
import { usePathname } from "@/lib/navigation"
import { hasStaffWorkspace } from "@/lib/staff/workspace-access"
import { workspaceNavigationAttributes } from "@/lib/workspace-analytics"

// Critical global controls remain visible when an icon CDN is unavailable.
const NAVIGATION_ICONS = {
  atlas: Globe,
  libraries: Library,
  networks: Network,
  community: Users,
  journal: NotebookText,
  knowledge: BookOpen,
  api: Code2,
  staff: ShieldCheck,
  moderation: ListChecks,
}
type Destination = NavLink & {
  icon: (typeof GLOBAL_NAVIGATION)[number]["icon"] | "staff" | "moderation"
}

export function DashboardNavigation({
  links,
  auth,
}: {
  readonly links: Destination[]
  readonly auth: ReactNode
}) {
  const t = useTranslations("ui")
  const d = useTranslations("dashboard")
  const contributeNav = useTranslations("contributeNav")
  const locale = useLocale()
  const { data: session, isPending, error } = useHydratedSession()
  const staffVisible = !isPending && !error && hasStaffWorkspace(session?.user)
  const moderationVisible =
    !isPending && !error && hasCapability(session?.user, "moderate.queue")
  const destinationsForViewer: Destination[] = [...links]
  if (staffVisible)
    destinationsForViewer.push({
      href: "/staff",
      label: t("staff_area"),
      icon: "staff",
    })
  if (moderationVisible)
    destinationsForViewer.push({
      href: "/moderation",
      label: contributeNav("moderation"),
      icon: "moderation",
    })
  const pathname = usePathname()
  const pageLabel =
    destinationsForViewer.find(
      (link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
    )?.label ??
    (
      [
        ["/plans", t("plans_and_pricing")],
        ["/legal", t("legal_policies")],
        ["/about", t("about_the_project")],
        ["/events", t("events")],
        ["/contribute", t("contribute")],
        ["/staff", t("staff_area")],
        ["/profile", t("profile")],
      ] as const
    ).find(
      ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )?.[1] ??
    d("libraries")
  const overlay = useDashboardOverlay()
  const menu = useContributeMenu(overlay.panel === "contribute")
  const footer = useFooterNavigation()
  // Shared destinations are rendered explicitly in the rail or drawer.
  // CMS footer groups can repeat those links, so keep only additional entries.
  const seen = new Set([
    ...destinationsForViewer.map((link) => link.href),
    "/plans",
  ])
  const additional = (link: { href: string }) => {
    if (seen.has(link.href)) return false
    seen.add(link.href)

    return true
  }
  const additionalLinks = footer.links.filter(additional)
  const additionalSections = footer.sections
    .map((section) => ({ ...section, links: section.links.filter(additional) }))
    .filter((section) => section.links.length > 0)
  const footerDestinations = new Set([
    ...footer.links.map((link) => link.href),
    ...footer.sections.flatMap((section) =>
      section.links.map((link) => link.href)
    ),
  ])
  const destinationLink = (link: Destination, rail: boolean) => {
    const NavigationIcon = NAVIGATION_ICONS[link.icon]
    const active =
      pathname === link.href || pathname.startsWith(`${link.href}/`)

    const item = (
      <GlobalLink
        key={link.href}
        href={link.href}
        {...navigationAttributes(link.href)}
        {...workspaceNavigationAttributes(link.href)}
        aria-current={active ? "page" : undefined}
        aria-label={link.label}
        title={rail ? undefined : link.label}
        onClick={overlay.handleClose}
        className={rail ? "dashboard-rail-item" : "dashboard-navigation-link"}
      >
        <NavigationIcon width={22} height={22} aria-hidden />
        <span>
          {rail && link.href === "/libraries"
            ? d("libraries")
            : rail && link.href === "/staff"
              ? d("staff")
              : link.label}
        </span>
      </GlobalLink>
    )

    return rail ? (
      <Tooltip key={link.href} delayDuration={1000}>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={28}
          className="dashboard-rail-tooltip"
        >
          {link.label}
        </TooltipContent>
      </Tooltip>
    ) : (
      item
    )
  }
  const workspaceDestinations = destinationsForViewer.filter((link) =>
    ["staff", "moderation"].includes(link.icon)
  )
  const drawerOnlyDestinations = destinationsForViewer.filter(
    (link) => link.icon === "api"
  )
  const destinations = (rail: boolean) => (
    <nav
      aria-label={t("main")}
      className={rail ? "dashboard-destinations" : "flex flex-col gap-1"}
    >
      {destinationsForViewer
        .filter(
          (link) =>
            link.icon !== "api" &&
            (rail
              ? !["staff", "moderation"].includes(link.icon)
              : !["/map", "/community", "/journal"].includes(link.href))
        )
        .map((link) => destinationLink(link, rail))}
    </nav>
  )
  const contribute = (
    <button
      type="button"
      aria-label={t("contribute")}
      title={t("contribute")}
      {...(overlay.panel !== "contribute"
        ? analyticsAttributes("navigation_action", {
            interaction_source: "navigation",
            action_type: "open",
            destination: "contribute",
          })
        : {})}
      aria-haspopup="dialog"
      aria-expanded={overlay.panel === "contribute"}
      onClick={(event) =>
        overlay.handleToggle("contribute", event.currentTarget)
      }
      className="dashboard-rail-item dashboard-square dashboard-contribute"
    >
      <Plus width={22} height={22} aria-hidden />
    </button>
  )

  return (
    <>
      <header
        className={
          workspaceDestinations.length
            ? "dashboard-navigation dashboard-navigation-with-workspaces"
            : "dashboard-navigation"
        }
        aria-label={d("navigation")}
        style={{ viewTransitionName: "persistent-nav" }}
      >
        <GlobalLink
          href="/"
          aria-label={t("home")}
          title="Libraries Global"
          className="dashboard-brand"
        >
          <LibrariesGlobalMark />
        </GlobalLink>
        <div className="dashboard-desktop-links">{destinations(true)}</div>
        <span className="dashboard-mobile-title">{pageLabel} </span>
        <div className="dashboard-global-actions">
          {destinationsForViewer
            .filter((link) =>
              ["/map", "/community", "/journal"].includes(link.href)
            )
            .map((link) => {
              const MobileIcon = NAVIGATION_ICONS[link.icon]

              return (
                <GlobalLink
                  key={link.href}
                  href={link.href}
                  {...navigationAttributes(link.href)}
                  onClick={overlay.handleClose}
                  aria-current={
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`)
                      ? "page"
                      : undefined
                  }
                  className={`dashboard-mobile-destination dashboard-rail-item ${link.href === "/journal" ? "dashboard-mobile-journal" : ""}`}
                >
                  <MobileIcon size={22} aria-hidden />
                  <span>{link.label}</span>
                </GlobalLink>
              )
            })}
          {workspaceDestinations.length ? (
            <div className="dashboard-workspace-links dashboard-destinations">
              {workspaceDestinations.map((link) => destinationLink(link, true))}
            </div>
          ) : null}
          <button
            type="button"
            aria-label={d("navigation")}
            title={d("navigation")}
            {...(overlay.panel !== "navigation"
              ? analyticsAttributes("navigation_action", {
                  interaction_source: "navigation",
                  action_type: "open",
                  destination: "navigation",
                })
              : {})}
            aria-haspopup="dialog"
            aria-expanded={overlay.panel === "navigation"}
            onClick={(event) =>
              overlay.handleToggle("navigation", event.currentTarget)
            }
            className="dashboard-rail-item dashboard-square dashboard-more"
          >
            <Menu width={22} height={22} aria-hidden />
          </button>
          {contribute}
          <div className="dashboard-account-action">{auth}</div>
        </div>
      </header>

      <DashboardDrawer
        panel="navigation"
        title={d("navigation")}
        footer={
          <div className="dashboard-navigation-footer">
            <LocaleSwitcher
              locale={locale}
              triggerClassName="w-32 gap-2 rounded-full border-(--t-border-line) bg-(--t-bg-deep) px-4 font-semibold uppercase text-(--t-ink-base) shadow-none [&_svg]:text-(--t-ink-base) [&_svg]:opacity-100"
            />
            <AppearanceControl className="rounded-full" />
          </div>
        }
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <GlobalLink
            href="/plans"
            {...navigationAttributes("/plans")}
            onClick={overlay.handleClose}
            className="dashboard-plan-promotion"
          >
            <Sparkles size={22} aria-hidden />
            <span>
              <strong>{t("plans_and_pricing")}</strong>
              <small>{d("plansDescription")}</small>
            </span>
            <span aria-hidden>→</span>
          </GlobalLink>
          <div className="mb-5 border-b border-(--t-border-line) pb-4 md:hidden">
            {destinations(false)}
          </div>
          <nav aria-label={t("help")} className="flex flex-col gap-1">
            {drawerOnlyDestinations.map((link) => destinationLink(link, false))}
            {[
              ["/events", t("events")],
              ["/about", t("about_the_project")],
              ["/legal", t("legal_policies")],
            ].map(([href, label]) =>
              !footerDestinations.has(href!) ? (
                <GlobalLink
                  key={href}
                  href={href}
                  {...navigationAttributes(href!)}
                  onClick={overlay.handleClose}
                  className="dashboard-navigation-link"
                >
                  {label}
                </GlobalLink>
              ) : null
            )}
            {additionalLinks.map((link) => (
              <GlobalLink
                key={link.key}
                href={link.href}
                {...navigationAttributes(link.href)}
                onClick={overlay.handleClose}
                className="dashboard-navigation-link"
              >
                {link.label}
              </GlobalLink>
            ))}
          </nav>
          {additionalSections.map((section) => (
            <nav
              key={section.key}
              aria-label={section.title}
              className="mt-5 flex flex-col gap-1 border-t border-(--t-border-line) pt-4"
            >
              <p className="m-0 px-3 py-2 text-sm font-semibold text-(--t-ink-dim)">
                {section.title}
              </p>
              {section.links.map((link) => (
                <GlobalLink
                  key={link.key}
                  href={link.href}
                  {...navigationAttributes(link.href)}
                  onClick={overlay.handleClose}
                  className="dashboard-navigation-link"
                >
                  {link.label}
                </GlobalLink>
              ))}
            </nav>
          ))}
        </div>
      </DashboardDrawer>

      <DashboardDrawer panel="contribute" title={t("contribute")}>
        <ContributeMenuPanel
          menu={menu}
          onNavigate={overlay.handleClose}
          layout="sidebar"
        />
      </DashboardDrawer>
    </>
  )
}
