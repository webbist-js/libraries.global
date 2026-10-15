"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  ANALYTICS_CONSENT_KEY,
  clearAnalyticsCookies,
  readAnalyticsChoice,
  saveAnalyticsChoice,
  type AnalyticsChoice,
} from "@/lib/analytics-consent"
import { analyticsPageAllowed } from "@/lib/google-analytics"

// This shell mounts outside NextIntlClientProvider, including the beta entrance.
const copy = {
  en: {
    title: "Your cookie choices",
    body: "Essential storage keeps the site working. With your permission, Google Analytics helps us understand visits and public-site actions. Analytics is optional; rejecting it does not affect beta access.",
    accept: "Accept analytics",
    reject: "Reject analytics",
    settings: "Cookie choices",
    close: "Close",
    cookies: "Cookie policy",
    privacy: "Privacy notice",
  },
  cs: {
    title: "Vaše volby cookies",
    body: "Nezbytné úložiště zajišťuje fungování webu. S vaším svolením nám Google Analytics pomáhá porozumět návštěvám a akcím na veřejných stránkách. Analytika je volitelná; její odmítnutí neovlivní přístup do bety.",
    accept: "Povolit analytiku",
    reject: "Odmítnout analytiku",
    settings: "Nastavení cookies",
    close: "Zavřít",
    cookies: "Zásady cookies",
    privacy: "Ochrana soukromí",
  },
  fr: {
    title: "Vos choix de cookies",
    body: "Le stockage essentiel permet au site de fonctionner. Avec votre accord, Google Analytics nous aide à comprendre les visites et les actions sur les pages publiques. L’analytique est facultative ; son refus ne modifie pas votre accès à la bêta.",
    accept: "Accepter l’analytique",
    reject: "Refuser l’analytique",
    settings: "Choix des cookies",
    close: "Fermer",
    cookies: "Politique de cookies",
    privacy: "Confidentialité",
  },
}

export function CookieConsent({ locale }: { readonly locale: string }) {
  const pathname = usePathname()
  const t = copy[locale as keyof typeof copy] ?? copy.en
  const prefix = locale === "en" ? "" : `/${locale}`
  const [ready, setReady] = useState(false)
  const [decided, setDecided] = useState(false)
  const [open, setOpen] = useState(false)
  const granted = useRef(false)
  const settingsButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    const restore = () => {
      clearTimeout(expiryTimer)
      let choice: AnalyticsChoice | undefined
      try {
        choice = readAnalyticsChoice(window.localStorage)
      } catch {
        // Access to localStorage itself can be blocked.
      }
      const wasGranted = granted.current
      granted.current = choice?.analytics === true
      window.librariesGlobalAnalytics?.setConsent(choice?.analytics === true)
      if (!choice?.analytics) clearAnalyticsCookies(document)
      setDecided(Boolean(choice))
      setReady(true)
      if (wasGranted && !choice?.analytics) {
        // Unload the SDK too: withdrawal must not leave background Google pings.
        window.location.reload()

        return
      }
      if (choice)
        expiryTimer = setTimeout(
          restore,
          Math.min(choice.expires - Date.now(), 2_147_000_000)
        )
    }
    const changed = (event: StorageEvent) => {
      if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) restore()
    }
    restore()
    window.addEventListener("storage", changed)
    window.addEventListener("focus", restore)

    return () => {
      clearTimeout(expiryTimer)
      window.removeEventListener("storage", changed)
      window.removeEventListener("focus", restore)
    }
  }, [])

  function choose(analytics: boolean) {
    const wasGranted = granted.current
    granted.current = analytics
    try {
      saveAnalyticsChoice(window.localStorage, analytics)
    } catch {
      // A session-only choice is valid when persistence is unavailable.
    }
    window.librariesGlobalAnalytics?.setConsent(analytics)
    if (!analytics) clearAnalyticsCookies(document)
    setDecided(true)
    setOpen(false)
    settingsButton.current?.focus()
    if (wasGranted && !analytics) window.location.reload()
  }

  if (!ready) return null
  const visible = open || (!decided && analyticsPageAllowed(pathname))

  return (
    <>
      <button
        ref={settingsButton}
        type="button"
        className="fixed bottom-3 left-3 z-[70] min-h-[44px] rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4 text-xs text-(--t-ink-base) shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4"
        onClick={() => setOpen(true)}
        aria-expanded={visible}
        aria-controls={visible ? "cookie-choices" : undefined}
      >
        {t.settings}
      </button>
      {visible && (
        <section
          id="cookie-choices"
          role="region"
          aria-labelledby="cookie-choices-title"
          className="fixed inset-x-3 bottom-3 z-[80] max-h-[85dvh] overflow-y-auto rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) shadow-xl sm:left-auto sm:w-[32rem] sm:p-6"
        >
          <h2 id="cookie-choices-title" className="text-lg font-semibold">
            {t.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed">{t.body}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm underline underline-offset-4">
            <a href={`${prefix}/legal/cookies`}>{t.cookies}</a>
            <a href={`${prefix}/legal/privacy`}>{t.privacy}</a>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="surface" size="pill" onClick={() => choose(false)}>
              {t.reject}
            </Button>
            <Button variant="surface" size="pill" onClick={() => choose(true)}>
              {t.accept}
            </Button>
            {decided && (
              <Button
                variant="ghost"
                size="pill"
                onClick={() => setOpen(false)}
              >
                {t.close}
              </Button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
