import { SUPPORTED_LOCALES } from "@repo/shared-data"

import {
  notifyAnalyticsConsent,
  sanitizeAnalyticsEvent,
} from "@/lib/analytics-events"

export const GOOGLE_ANALYTICS_ID = "G-8M465CHXJ6"
export const ANALYTICS_ORIGIN = "https://libraries.global"
const DISABLE_KEY = "ga-disable-G-8M465CHXJ6"
const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`)
const PRIVATE_PATH =
  /^\/(?:auth|api|profile|staff|contribute|live|dev|email)(?:\/|$)/
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

  return !PRIVATE_PATH.test(path) && !PRIVATE_COMMUNITY.test(path)
}

function pageTypeFor(path: string): string {
  const parts = path.split("/").filter(Boolean)
  const section = parts[0] ?? "home"
  if (section === "libraries") return "library_index"
  if (section === "map") return "atlas"
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
    return parts.length === 4 ? "library" : "geography"

  return "other"
}

function pageContext(browser: Window) {
  const { origin, pathname } = browser.location
  const path = analyticsPathKey(pathname)
  const pageType = pageTypeFor(path)
  const locale = pathname.match(LOCALE_PREFIX)?.[0].slice(1) ?? "en"
  const context: Record<string, string> = {
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

/** The consent provider owns persistence; this controller starts denied. */
export function installGoogleAnalytics(
  browser: Window,
  nonce?: string
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
    analyticsPageAllowed(browser.location.pathname)
  const emit = (name: string, context: Record<string, string>) => {
    // Mirror only consented, sanitized events for the later GTM takeover.
    // The direct Google tag remains the single collection owner for now.
    browser.dataLayer!.push(
      { analytics: null },
      {
        event: "lg_analytics",
        analytics: { event_name: name, ...context, schema_version: 1 },
      }
    )
    gtag("event", name, { ...context, send_to: GOOGLE_ANALYTICS_ID })
  }
  const pageView = () => {
    const { origin, pathname } = browser.location
    if (
      !granted ||
      origin !== ANALYTICS_ORIGIN ||
      !analyticsPageAllowed(pathname)
    ) {
      pause()

      return
    }
    browser[DISABLE_KEY] = false
    paused = false
    const page = `${origin}${pathname}`
    if (page === previousPage) {
      currentContext = {
        ...pageContext(browser),
        page_referrer: currentContext?.page_referrer ?? "",
      }

      return
    }
    let referrer = previousPage ?? ""
    if (!referrer && browser.document.referrer) {
      try {
        const url = new URL(browser.document.referrer)
        if (url.origin !== origin) referrer = url.origin
      } catch {
        // An invalid referrer provides no useful acquisition information.
      }
    }
    const context: Record<string, string> = {
      ...pageContext(browser),
      page_referrer: referrer,
    }
    currentContext = context
    // Entity IDs are event-scoped; do not leave them in global gtag state.
    const baseContext = {
      page_location: context.page_location,
      page_title: context.page_title,
      page_referrer: referrer,
      page_type: context.page_type,
      content_locale: context.content_locale,
    }
    gtag("set", baseContext)
    if (!loaded) {
      gtag("js", new Date())
      gtag("config", GOOGLE_ANALYTICS_ID, {
        ...baseContext,
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      })
      const script = browser.document.createElement("script")
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`
      if (nonce) script.nonce = nonce
      browser.document.head.append(script)
      loaded = true
    }
    emit("page_view", context)
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
