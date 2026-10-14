import { SUPPORTED_LOCALES } from "@repo/shared-data"

export const GOOGLE_ANALYTICS_ID = "G-N6DLE0CK0Y"
export const ANALYTICS_ORIGIN = "https://libraries.global"
const DISABLE_KEY = "ga-disable-G-N6DLE0CK0Y"
const LOCALE_PREFIX = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})(?=/|$)`)
const PRIVATE_PATH =
  /^\/(?:auth|api|profile|staff|contribute|live|dev|email)(?:\/|$)/

export function productionAnalyticsEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.APP_ENV === "production" &&
    process.env.APP_PUBLIC_URL?.replace(/\/$/, "") === ANALYTICS_ORIGIN
  )
}

export function analyticsPageAllowed(pathname: string): boolean {
  return !PRIVATE_PATH.test(pathname.replace(LOCALE_PREFIX, "") || "/")
}

export interface AnalyticsConsentController {
  setConsent: (granted: boolean) => void
  pageView: () => void
  pause: () => void
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    librariesGlobalAnalytics?: AnalyticsConsentController
    "ga-disable-G-N6DLE0CK0Y"?: boolean
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
    previousPage = undefined
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
    const page = `${origin}${pathname}`
    if (page === previousPage) return
    let referrer = previousPage ?? ""
    if (!referrer && browser.document.referrer) {
      try {
        const url = new URL(browser.document.referrer)
        if (url.origin !== origin) referrer = url.origin
      } catch {
        // An invalid referrer provides no useful acquisition information.
      }
    }
    const context = {
      page_location: page,
      page_referrer: referrer,
      page_title: browser.document.title,
    }
    gtag("set", context)
    if (!loaded) {
      gtag("js", new Date())
      gtag("config", GOOGLE_ANALYTICS_ID, {
        ...context,
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
    gtag("event", "page_view", { ...context, send_to: GOOGLE_ANALYTICS_ID })
    previousPage = page
  }
  const controller: AnalyticsConsentController = {
    setConsent: (value) => {
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
  }
  browser.librariesGlobalAnalytics = controller

  return controller
}
