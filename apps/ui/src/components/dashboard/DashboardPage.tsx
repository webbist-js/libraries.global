"use client"

import { useTranslations } from "next-intl"
import * as React from "react"

import { MainContent } from "@/components/ds/MainContent"
import { Link, usePathname } from "@/lib/navigation"

import { DashboardDrawer, useOptionalDashboardOverlay } from "./DashboardFrame"
import { useDashboardScroll } from "./useDashboardScroll"

// Next bundles React's transition API. Stable React test/embedded renderers and
// browsers without support still render the same semantic page immediately.
const Transition =
  React.ViewTransition ??
  (({ children }: { children?: React.ReactNode }) => <>{children}</>)
const direction = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "page-crossfade",
}

export type DashboardDestination = {
  href: string
  label: string
  count?: number
}

function ContextPanel({
  title,
  eyebrow,
  navigationHeading,
  navigation,
  context,
  overview,
  navigationFooter,
  navigationHidden,
  sectionLabel,
  contextLabel,
}: {
  title: string
  eyebrow?: string
  navigationHeading?: React.ReactNode
  navigation?: React.ReactNode
  context?: React.ReactNode
  overview?: React.ReactNode
  navigationFooter?: React.ReactNode
  navigationHidden: boolean
  sectionLabel: string
  contextLabel: string
}) {
  return (
    <aside
      className="dashboard-context-panel"
      hidden={navigationHidden}
      aria-label={sectionLabel}
    >
      {navigationHeading !== null ? (
        <div className="dashboard-context-heading">
          {navigationHeading ?? (
            <>
              {eyebrow ? <p className="hero-eyebrow">{eyebrow}</p> : null}
              <p className="type-page-inline">{title}</p>
            </>
          )}
        </div>
      ) : null}
      <div
        className="dashboard-sidebar-content"
        data-dashboard-scroll="navigation"
      >
        {navigation}
        {context && !overview ? (
          <a
            className="dashboard-context-shortcut"
            href="#dashboard-page-context"
          >
            {contextLabel}
          </a>
        ) : null}
      </div>
      {navigationFooter ? (
        <div className="dashboard-context-footer">{navigationFooter}</div>
      ) : null}
    </aside>
  )
}

function RecordContent({
  overview,
  header,
  context,
  children,
  contextLabel,
}: {
  overview: React.ReactNode
  header?: React.ReactNode
  context?: React.ReactNode
  children?: React.ReactNode
  contextLabel: string
}) {
  return (
    <MainContent
      className={`dashboard-record-grid ${header ? "dashboard-record-grid-with-header" : ""}`}
    >
      {header ? <div className="dashboard-record-header">{header}</div> : null}
      <div className="dashboard-record-overview">{overview}</div>
      {context ? (
        <aside
          id="dashboard-page-context"
          className="dashboard-record-aside"
          aria-label={contextLabel}
          tabIndex={-1}
        >
          {context}
        </aside>
      ) : null}
      {children ? (
        <div className="dashboard-record-sections">{children}</div>
      ) : null}
    </MainContent>
  )
}

function pageClasses(
  overview: boolean,
  context: boolean,
  hidden: boolean,
  className: string
) {
  return [
    "dashboard-page",
    overview
      ? "dashboard-record-page"
      : context
        ? "dashboard-page-with-context"
        : "",
    overview && !context ? "dashboard-record-without-context" : "",
    hidden ? "dashboard-navigation-hidden" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
}

/** Page-level boundaries move content while the shared layout/rail persists. */
export function DashboardPage({
  title,
  eyebrow,
  navigation,
  context,
  children,
  className = "",
  navigationHidden = false,
  navigationLoading = false,
  routeKey,
  overview,
  toolbar,
  navigationFooter,
  navigationHeading,
  mobileNavigationHeading,
  header,
  mobileSections,
}: {
  readonly title: string
  readonly eyebrow?: string
  readonly navigation?: React.ReactNode
  readonly context?: React.ReactNode
  readonly children?: React.ReactNode
  readonly className?: string
  readonly navigationHidden?: boolean
  readonly navigationLoading?: boolean
  readonly routeKey?: string
  /** Record pages share one scrolling canvas, including their supporting rail. */
  readonly overview?: React.ReactNode
  readonly toolbar?: React.ReactNode
  readonly navigationFooter?: React.ReactNode
  /** Optional identity/parent return path within a mobile section drawer. */
  readonly mobileNavigationHeading?: React.ReactNode
  /** Pass null when section navigation owns its own heading. */
  readonly navigationHeading?: React.ReactNode
  /** Compact section links below the record toolbar on phones and tablets. */
  readonly mobileSections?: readonly { href: string; label: string }[]
  /** Full-width record header above the main and supporting columns. */
  readonly header?: React.ReactNode
}) {
  const pathname = usePathname()
  const path = routeKey ?? pathname
  const root = useDashboardScroll(path)
  const recordHeader = React.useRef<HTMLDivElement>(null)
  const hasMobileSections = Boolean(mobileSections?.length)
  React.useEffect(() => {
    const header = recordHeader.current
    const page = root.current
    if (!header || !page || typeof ResizeObserver === "undefined") return
    const measure = () =>
      page.style.setProperty(
        "--dashboard-record-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`
      )
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    measure()

    return () => {
      observer.disconnect()
      page.style.removeProperty("--dashboard-record-header-height")
    }
  }, [path, hasMobileSections, root])
  const t = useTranslations("dashboard")
  const overlay = useOptionalDashboardOverlay()
  const pendingAnchor = React.useRef<string | null>(null)
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)")
    const close = () => {
      if (media.matches && overlay?.panel === "section") overlay.handleClose()
    }
    media.addEventListener("change", close)

    return () => media.removeEventListener("change", close)
  }, [overlay])

  return (
    <div
      ref={root}
      className={pageClasses(
        Boolean(overview),
        Boolean(context),
        navigationHidden,
        className
      )}
      data-dashboard-page={path}
      data-has-shell={Boolean(overlay)}
    >
      {overlay && navigation && !navigationHidden && !navigationLoading ? (
        <>
          <button
            type="button"
            className="dashboard-section-toggle"
            aria-haspopup="dialog"
            aria-expanded={overlay.panel === "section"}
            onClick={(event) =>
              overlay.handleToggle("section", event.currentTarget)
            }
          >
            {t("sectionNavigation")} · {title}
          </button>
          <DashboardDrawer
            panel="section"
            title={title}
            onAfterClose={() => {
              const id = pendingAnchor.current
              pendingAnchor.current = null
              const destination = id ? document.getElementById(id) : null
              destination?.scrollIntoView({ block: "start" })
              destination?.setAttribute("tabindex", "-1")
              destination?.focus({ preventScroll: true })
            }}
          >
            <div
              className="dashboard-section-panel"
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return
                const anchor = (
                  event.target as HTMLElement
                ).closest<HTMLAnchorElement>("a")
                const href = anchor?.getAttribute("href")
                if (!href) return
                if (href.startsWith("#")) pendingAnchor.current = href.slice(1)
                // Query-driven queues share a pathname, so they cannot rely
                // on the shell's pathname-change effect to dismiss the drawer.
                overlay.handleClose()
              }}
            >
              {mobileNavigationHeading ? (
                <div className="dashboard-context-heading dashboard-mobile-context-heading">
                  {mobileNavigationHeading}
                </div>
              ) : null}
              <div className="dashboard-sidebar-content">
                {navigation}
                {context ? (
                  <a
                    className="dashboard-context-shortcut"
                    href="#dashboard-page-context"
                  >
                    {t("pageContext")}
                  </a>
                ) : null}
              </div>
              {navigationFooter ? (
                <div className="dashboard-context-footer">
                  {navigationFooter}
                </div>
              ) : null}
            </div>
          </DashboardDrawer>
        </>
      ) : null}
      <Transition
        key={`${path}:context`}
        name="dashboard-context"
        share="morph"
        enter="fade-in"
        exit="fade-out"
        default="none"
      >
        <ContextPanel
          title={title}
          eyebrow={eyebrow}
          navigationHeading={navigationHeading}
          navigation={navigation}
          context={context}
          overview={overview}
          navigationFooter={navigationFooter}
          navigationHidden={navigationHidden}
          sectionLabel={t("sectionNavigation")}
          contextLabel={t("pageContext")}
        />
      </Transition>
      <Transition
        key={`${path}:content`}
        name="dashboard-content"
        share={direction}
        enter={direction}
        exit={direction}
        default="none"
      >
        <div className="dashboard-page-body" data-dashboard-scroll="content">
          {hasMobileSections ? (
            <div ref={recordHeader} className="dashboard-record-toolbar">
              {toolbar}
              <nav
                className="dashboard-mobile-sections"
                aria-label={t("sectionNavigation")}
              >
                {mobileSections?.map((section) => (
                  <a key={section.href} href={section.href}>
                    {section.label}
                  </a>
                ))}
              </nav>
            </div>
          ) : (
            toolbar
          )}
          {overview ? (
            <RecordContent
              overview={overview}
              header={header}
              context={context}
              contextLabel={t("pageContext")}
            >
              {children}
            </RecordContent>
          ) : (
            children
          )}
        </div>
      </Transition>
      {context && !overview ? (
        <aside
          id="dashboard-page-context"
          className="dashboard-page-context"
          aria-label={t("pageContext")}
          tabIndex={-1}
        >
          {context}
        </aside>
      ) : null}
    </div>
  )
}

export function DashboardPlaceNavigation({
  parents,
  destinations,
  childrenLabel,
  actions,
}: {
  readonly parents: readonly DashboardDestination[]
  readonly destinations?: readonly DashboardDestination[]
  readonly childrenLabel?: string
  readonly actions?: React.ReactNode
}) {
  const t = useTranslations("dashboard")

  return (
    <>
      {parents.length ? (
        <nav
          aria-label={t("placeHierarchy")}
          className="dashboard-place-navigation"
        >
          {parents.map((parent) => (
            <Link
              key={parent.href}
              href={parent.href}
              className="dashboard-navigation-link"
            >
              ← {parent.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {actions ? (
        <div className="dashboard-context-actions">{actions}</div>
      ) : null}
      {destinations?.length ? (
        <details className="dashboard-place-children" open>
          <summary>{childrenLabel ?? t("browsePlaces")}</summary>
          <nav aria-label={childrenLabel ?? t("browsePlaces")}>
            {destinations.map((destination) => (
              <Link
                key={destination.href}
                href={destination.href}
                className="dashboard-navigation-link"
              >
                <span>{destination.label}</span>{" "}
                <span className="dashboard-destination-count">
                  {destination.count?.toLocaleString() ?? "→"}
                </span>
              </Link>
            ))}
          </nav>
        </details>
      ) : null}
    </>
  )
}
