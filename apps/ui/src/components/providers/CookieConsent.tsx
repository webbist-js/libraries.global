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
import { analyticsConsentPromptAllowed } from "@/lib/google-analytics"

// This shell mounts outside NextIntlClientProvider, including the beta entrance.
const copy = {
  en: {
    title: "Your cookie choices",
    body: "Essential storage keeps the site working. With your permission, Google Analytics measures visits, menus and searches, plus use of account, Staff, Contribute and Moderation tools. We send categories and action outcomes, not private URLs, private record IDs, search text or what you write. Analytics is optional; rejecting it does not affect access.",
    accept: "Accept analytics",
    reject: "Reject analytics",
    settings: "Cookie choices",
    close: "Close",
    cookies: "Cookie policy",
    privacy: "Privacy notice",
  },
  cs: {
    title: "Vaše volby cookies",
    body: "Nezbytné úložiště zajišťuje fungování webu. S vaším svolením Google Analytics měří návštěvy, nabídky a vyhledávání i používání účtu, nástrojů pro zaměstnance, přispívání a moderování. Odesíláme kategorie a výsledky akcí, nikoli soukromé adresy URL, identifikátory soukromých záznamů, hledané výrazy ani text, který píšete. Analytika je volitelná; odmítnutí neovlivní přístup.",
    accept: "Povolit analytiku",
    reject: "Odmítnout analytiku",
    settings: "Nastavení cookies",
    close: "Zavřít",
    cookies: "Zásady cookies",
    privacy: "Ochrana soukromí",
  },
  fr: {
    title: "Vos choix de cookies",
    body: "Le stockage essentiel permet au site de fonctionner. Avec votre accord, Google Analytics mesure les visites, les menus et les recherches, ainsi que l’utilisation du compte et des outils de personnel, de contribution et de modération. Nous envoyons des catégories et les résultats des actions, sans URL privées, identifiants de dossiers privés, termes recherchés ni textes saisis. L’analytique est facultative ; la refuser ne modifie pas votre accès.",
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
  const visible = open || (!decided && analyticsConsentPromptAllowed(pathname))

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
          <h2 id="cookie-choices-title" className="type-h2">
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
