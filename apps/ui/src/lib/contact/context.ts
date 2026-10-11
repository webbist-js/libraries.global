import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

import { type ContactContext, contextPath } from "@/lib/contact/model"

/** A single snapshot when the modal opens; no cookies, persistent ID or background tracking. */
export function captureContactContext(
  timeOnPageSeconds: number
): ContactContext {
  let referrer: string | undefined
  try {
    const url = new URL(document.referrer)
    if (url.origin === window.location.origin)
      referrer = contextPath(url.pathname)
  } catch {
    // Direct visits have no referrer.
  }

  return {
    page: contextPath(window.location.pathname),
    referrer,
    locale: isSupportedLocale(document.documentElement.lang)
      ? document.documentElement.lang
      : DEFAULT_LOCALE,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: window.screen.width, height: window.screen.height },
    pixelRatio: window.devicePixelRatio,
    language: navigator.language.slice(0, 120),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    pointer: window.matchMedia("(pointer: coarse)").matches
      ? "coarse"
      : window.matchMedia("(pointer: fine)").matches
        ? "fine"
        : "none",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
    timeOnPageSeconds: Math.min(
      604800,
      Math.max(0, Math.round(timeOnPageSeconds))
    ),
  }
}
