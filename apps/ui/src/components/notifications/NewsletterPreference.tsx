"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { ToggleSwitch } from "@/components/settings/ToggleSwitch"

export function NewsletterPreference() {
  const tUi = useUiTranslations("ui")

  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(true)
  const [suppressed, setSuppressed] = useState(false)
  const [error, setError] = useState("")
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/profile/me/newsletter", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unavailable")
        const data = await res.json()
        setSubscribed(data.subscribed)
        setSuppressed(data.suppressed)
        setLoaded(true)
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Newsletter preferences are unavailable. Please try again later."
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })

    return () => controller.abort()
  }, [])
  async function toggle(enabled: boolean) {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/profile/me/newsletter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error("Failed")
      setSubscribed(enabled)
    } catch {
      setError("Could not save your newsletter preference. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-medium">
            {tUi("newsletter_and_journal_dispatch")}
          </p>
          <p className="mt-1 text-sm text-(--t-ink-dim)">
            Project news and Journal articles, at most monthly, sent to your
            verified account email.
          </p>
        </div>
        <ToggleSwitch
          value={subscribed}
          onChange={(value) => void toggle(value)}
          label={tUi("newsletter_and_journal_dispatch")}
          disabled={busy || suppressed || !loaded}
        />
      </div>
      {suppressed && (
        <p className="mt-2 text-sm">
          Delivery to this address is blocked. Contact info@libraries.global
          before subscribing again.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
