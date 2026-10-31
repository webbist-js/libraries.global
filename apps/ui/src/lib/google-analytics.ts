import { SUPPORTED_LOCALES } from "@repo/shared-data"

import {
  notifyAnalyticsConsent,
  sanitizeAnalyticsEvent,
} from "@/lib/analytics-events"
import { sanitizeCheckoutEvent } from "@/lib/checkout-analytics"
import {
  sanitizeWorkspaceEvent,
  workspacePageContext,
  workspaceRoute,
  type WorkspaceOutcome,
} from "@/lib/workspace-analytics"

export const GOOGLE_ANALYTICS_ID = "G-8M465CHXJ6"
export const GOOGLE_TAG_MANAGER_ID = "GTM-M8GLG9F2"
export const ANALYTICS_ORIGIN = "https://libraries.global"
const DISABLE_KEY = "ga-disable-G-8M465CHXJ6"
const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`)
const PRIVATE_PATH =
  /^\/(?:auth|api|profile|staff|moderation|contribute|live|dev|email)(?:\/|$)/
const PRIVATE_COMMUNITY =
  /^\/community\/(?:propose(?:\/|$)|drives\/(?:new(?:\/|$)|[^/]+\/edit(?:\/|$)))/

export const analyticsPathKey = (pathname: string) =>
  pathname.replace(LOCALE_PREFIX, "") || "/"

export function productionAnalyticsEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.APP_ENV === "production" &&
    process.env.APP_PUBLIC_URL?.replace(/\/$/, "") === ANALYTICS_ORIGIN
  )
}

export function analyticsPageAllowed(pathname: string): boolean {
  const path = pathname.replace(LOCALE_PREFIX, "") || "/"

  return (
    !PRIVATE_PATH.test(path) &&
    !PRIVATE_COMMUNITY.test(path) &&
    !workspaceRoute(path)
  )
}

export const analyticsConsentPromptAllowed = (pathname: string) =>
  analyticsPageAllowed(pathname) || Boolean(workspaceRoute(pathname))

function geographicPageType(parts: string[]) {
  return parts.length === 4 ? "library" : "geography"
}

function pageTypeFor(path: string): string {
  const parts = path.split("/").filter(Boolean)
  const section = parts[0] ?? "home"
  const directTypes: Record<string, string> = {
    libraries: "library_index",
    map: "atlas",
    plans: "membership",
  }
  if (Object.hasOwn(directTypes, section)) return directTypes[section]!
  if (section === "library-networks")
    return parts.length > 1 ? "network" : "network_index"
  if (parts[2] === "library-services")
    return parts.length > 3 ? "network" : "network_index"
  if (section === "community")
    return parts[1] === "drives" && parts.length === 3 ? "drive" : "community"
  if (
    ["home", "beta", "journal", "knowledge", "events", "about"].includes(
      section
    )
  )
    return section
  if (["legal", "privacy", "terms"].includes(section)) return "legal"
  if (
    [
      "africa",
      "asia",
      "europe",
      "north-america",
      "south-america",
      "oceania",
      "antarctica",
    ].includes(section)
  )
    return geographicPageType(parts)

  return "other"
}

type PublicPageContext = Record<string, string> & {
  page_location: string
  page_title: string
  page_type: string
  content_locale: string
}

function pageContext(browser: Window) {
  const { origin, pathname } = browser.location
  const path = analyticsPathKey(pathname)
  const pageType = pageTypeFor(path)
  const locale = pathname.match(LOCALE_PREFIX)?.[0].slice(1) ?? "en"
  const context: PublicPageContext = {
    page_location: `${origin}${pathname}`,
    page_title: pageType,
    page_type: pageType,
    content_locale: locale,
  }
  const marker = browser.document.querySelector?.<HTMLElement>(
    "[data-analytics-page]"
  )
  const markerPath = marker?.dataset.analyticsPath?.replace(LOCALE_PREFIX, "")
  // An old page can remain visible during navigation: never reuse its IDs.
  if (markerPath === path) {
    for (const [attribute, key] of [
      ["data-analytics-library-id", "library_document_id"],
      ["data-analytics-content-id", "content_id"],
    ]) {
      const id = marker?.getAttribute(attribute!)
      if (id && /^[A-Za-z0-9_-]{1,128}$/.test(id)) context[key!] = id
    }
  }

  return context
}

export interface AnalyticsConsentController {
  setConsent: (granted: boolean) => void
  pageView: () => void
  pause: () => void
  hasConsent: () => boolean
  consentVersion: () => number
  trackCheckout?: (name: string, parameters: unknown) => boolean
  prepareCheckout?: (name: string, parameters: unknown) => () => boolean
  trackWorkspace?: (name: string, parameters: unknown) => boolean
  prepareWorkspace?: (
    parameters: unknown
  ) => (outcome: WorkspaceOutcome) => boolean
  track: (name: string, parameters: unknown) => boolean
  prepare: (
    name: string,
    parameters: unknown
  ) => (additional?: unknown) => boolean
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    librariesGlobalAnalytics?: AnalyticsConsentController
    "ga-disable-G-8M465CHXJ6"?: boolean
  }
}

/** Basic consent mode: even the GTM container waits for an explicit grant. */
export function installGoogleAnalytics(
  browser: Window,
  nonce?: string,
  checkoutEnabled = false
): AnalyticsConsentController | undefined {
  if (browser.location.origin !== ANALYTICS_ORIGIN) return
  if (browser.librariesGlobalAnalytics) return browser.librariesGlobalAnalytics

  let granted = false
  let loaded = false
  let previousPage: string | undefined
  let currentContext: Record<string, string> | undefined
  let paused = true
  let generation = 0
  const denied = {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  }
  browser[DISABLE_KEY] = true
  browser.dataLayer ??= []
  browser.gtag ??= function (..._args: unknown[]) {
    // Google processes gtag commands as arguments objects, not GTM events.
    // eslint-disable-next-line prefer-rest-params
    browser.dataLayer!.push(arguments)
  }
  const gtag = browser.gtag
  // Queued before loading GTM, following Google's basic consent-mode sequence.
  gtag("consent", "default", denied)

  const pause = () => {
    browser[DISABLE_KEY] = true
    paused = true
    generation++
    previousPage = undefined
    currentContext = undefined
    notifyAnalyticsConsent()
  }
  const hasConsent = () =>
    granted &&
    !paused &&
    browser.location.origin === ANALYTICS_ORIGIN &&
    analyticsPageAllowed(browser.location.pathname) &&
    !workspaceRoute(browser.location.pathname)
  const envelope = (
    event: string,
    context: Record<string, unknown>,
    name?: string
  ) => {
    browser.dataLayer!.push(
      { analytics: null },
      {
        event,
        analytics: {
          ...(name ? { event_name: name } : {}),
          ...context,
          schema_version: 1,
          transport: "gtm",
        },
      }
    )
  }
  const emit = (name: string, context: Record<string, string>) =>
    envelope("lg_analytics", context, name)
  const initializeTag = (baseContext: Record<string, string>) => {
    if (!loaded) {
      browser.dataLayer!.push({
        "gtm.start": Date.now(),
        event: "gtm.js",
      })
      const script = browser.document.createElement("script")
      script.async = true
      script.src = `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`
      if (nonce) script.nonce = nonce
      browser.document.head.append(script)
      loaded = true
      envelope("lg_analytics_ready", baseContext)
    }
  }
  const pageView = () => {
    const { origin, pathname } = browser.location
    const workspace = workspaceRoute(pathname)
    if (
      !granted ||
      origin !== ANALYTICS_ORIGIN ||
      (!analyticsPageAllowed(pathname) && !workspace)
    ) {
      pause()

      return
    }
    browser[DISABLE_KEY] = false
    paused = false
    const page = `${origin}${pathname}`
    if (page === previousPage) {
      if (workspace) return
      currentContext = {
        ...pageContext(browser),
        page_referrer: currentContext?.page_referrer ?? "",
      }

      return
    }
    // Previous workspace URLs can contain private IDs: only public URLs qualify.
    let referrer =
      previousPage && analyticsPageAllowed(new URL(previousPage).pathname)
        ? previousPage
        : ""
    if (!referrer && browser.document.referrer) {
      try {
        const url = new URL(browser.document.referrer)
        if (url.origin !== origin) referrer = url.origin
      } catch {
        // An invalid referrer provides no useful acquisition information.
      }
    }
    const locale = pathname.match(LOCALE_PREFIX)?.[0].slice(1) ?? "en"
    const context = workspace
      ? { ...workspacePageContext(workspace, locale, origin), ...workspace }
      : { ...pageContext(browser), page_referrer: referrer }
    currentContext = context
    // Entity IDs are event-scoped; do not leave them in global gtag state.
    const baseContext = {
      page_location: context.page_location,
      page_title: context.page_title,
      page_referrer: context.page_referrer,
      page_type: context.page_type,
      content_locale: context.content_locale,
    }
    gtag("set", baseContext)
    initializeTag(baseContext)
    emit(workspace ? "workspace_view" : "page_view", context)
    previousPage = page
    generation++
    notifyAnalyticsConsent()
  }
  const track = (name: string, parameters: unknown): boolean => {
    const clean = sanitizeAnalyticsEvent(name, parameters)
    if (!clean || !hasConsent()) return false
    pageView()
    if (!currentContext) return false
    emit(name, { ...currentContext, ...clean })

    return true
  }
  const workspaceConsent = () =>
    granted &&
    browser.location.origin === ANALYTICS_ORIGIN &&
    analyticsConsentPromptAllowed(browser.location.pathname)
  const trackWorkspace = (name: string, parameters: unknown): boolean => {
    const clean = sanitizeWorkspaceEvent(name, parameters)
    if (!clean || !workspaceConsent()) return false
    // Updates global tag context before any workspace event or automatic ping.
    pageView()
    if (paused) return false
    const locale =
      browser.location.pathname.match(LOCALE_PREFIX)?.[0].slice(1) ?? "en"
    emit(name, {
      ...workspacePageContext(clean, locale, ANALYTICS_ORIGIN),
      ...clean,
    })

    return true
  }
  const checkoutRouteAllowed = (name: string) => {
    const path = analyticsPathKey(browser.location.pathname)

    return name === "pricing_action"
      ? path === "/plans"
      : [
          "/plans",
          "/staff/teams/new",
          "/staff/teams/billing",
          "/developers",
          "/developers/keys",
          "/developers/usage",
          "/staff/teams/api",
          "/contribute/membership/checkout",
        ].includes(path)
  }
  const checkoutConsent = (name: string) =>
    checkoutEnabled &&
    granted &&
    browser.location.origin === ANALYTICS_ORIGIN &&
    checkoutRouteAllowed(name)
  const trackCheckout = (name: string, parameters: unknown) => {
    const clean = sanitizeCheckoutEvent(name, parameters)
    if (!clean || !checkoutConsent(name)) return false
    const path = browser.location.pathname
    const locale = path.match(LOCALE_PREFIX)?.[0].slice(1) ?? "en"
    // Private URLs, titles, referrers and IDs never enter the checkout channel.
    const context = {
      page_location: `${ANALYTICS_ORIGIN}${locale === "en" ? "" : `/${locale}`}/${name === "pricing_action" ? "plans" : "checkout"}`,
      page_title: name === "pricing_action" ? "membership" : "checkout",
      page_type: name === "pricing_action" ? "membership" : "checkout",
      page_referrer: "",
      content_locale: locale,
    }
    browser[DISABLE_KEY] = false
    gtag("set", context)
    initializeTag(context)
    envelope(
      "lg_checkout",
      {
        ...context,
        ...clean,
        ...(name === "begin_checkout"
          ? {
              items: [
                {
                  item_id: clean.product,
                  item_variant: clean.billing_interval,
                },
              ],
            }
          : {}),
      },
      name
    )

    return true
  }
  const controller: AnalyticsConsentController = {
    setConsent: (value) => {
      if (granted !== (value === true)) generation++
      granted = value === true
      if (!granted) pause()
      gtag("consent", "update", {
        ...denied,
        analytics_storage: granted ? "granted" : "denied",
      })
      pageView()
    },
    pageView,
    pause,
    hasConsent,
    consentVersion: () => (hasConsent() ? generation : 0),
    track,
    trackWorkspace,
    prepareWorkspace: (parameters) => {
      // A placeholder outcome validates the categories before asynchronous work.
      const clean = sanitizeWorkspaceEvent("workspace_action", {
        ...(parameters && typeof parameters === "object" ? parameters : {}),
        action_outcome: "success",
      })
      if (!clean || !workspaceConsent()) return () => false
      pageView()
      const epoch = generation
      const path = browser.location.pathname
      let completed = false

      return (outcome) => {
        if (
          completed ||
          epoch !== generation ||
          path !== browser.location.pathname ||
          !workspaceConsent()
        )
          return false
        completed = true

        return trackWorkspace("workspace_action", {
          ...clean,
          action_outcome: outcome,
        })
      }
    },
    trackCheckout,
    prepareCheckout: (name, parameters) => {
      const clean = sanitizeCheckoutEvent(name, parameters)
      if (!clean || !checkoutConsent(name)) return () => false
      const epoch = generation
      const path = browser.location.pathname
      let completed = false

      return () => {
        if (
          completed ||
          epoch !== generation ||
          path !== browser.location.pathname ||
          !checkoutConsent(name)
        )
          return false
        completed = true

        return trackCheckout(name, clean)
      }
    },
    prepare: (name, parameters) => {
      const clean = sanitizeAnalyticsEvent(name, parameters, true)
      if (!clean || !hasConsent()) return () => false
      pageView()
      const epoch = generation
      const path = browser.location.pathname
      let completed = false

      return (additional) => {
        if (
          completed ||
          epoch !== generation ||
          path !== browser.location.pathname ||
          !hasConsent()
        )
          return false
        completed = true

        return track(name, {
          ...clean,
          ...(additional && typeof additional === "object" ? additional : {}),
        })
      }
    },
  }
  browser.librariesGlobalAnalytics = controller
  notifyAnalyticsConsent()

  return controller
}
