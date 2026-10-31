// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GoogleAnalytics } from "@/components/providers/GoogleAnalytics"
import {
  ANALYTICS_CONSENT_KEY,
  readAnalyticsChoice,
  saveAnalyticsChoice,
} from "@/lib/analytics-consent"

const route = vi.hoisted(() => ({ path: "/beta" }))
vi.mock("next/navigation", () => ({ usePathname: () => route.path }))

beforeEach(() => {
  route.path = "/beta"
  window.location.href = "https://libraries.global/beta?invite=PRIVATE_CODE"
  localStorage.clear()
  vi.spyOn(document.head, "append").mockImplementation(() => {})
  vi.spyOn(window.location, "reload").mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  delete window.librariesGlobalAnalytics
  delete window.gtag
  delete window.dataLayer
  localStorage.clear()
  document.cookie = "lg-beta-access=; Max-Age=0; Path=/"
  vi.restoreAllMocks()
})

const messages = () =>
  window.dataLayer as { event?: string; analytics?: unknown }[]

describe("beta cookie choices", () => {
  it("loads no Google script or event until a choice; rejection persists without affecting beta access", () => {
    document.cookie = "lg-beta-access=essential; Path=/; Secure"
    document.cookie = "_ga=old; Path=/; Secure"
    document.cookie =
      "_ga_8M465CHXJ6=old; Domain=libraries.global; Path=/; Secure"
    render(<GoogleAnalytics />)
    expect(
      screen.getByRole("region", { name: "Your cookie choices" })
    ).toBeDefined()
    expect(document.head.append).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Reject analytics" }))
    expect(readAnalyticsChoice(localStorage)?.analytics).toBe(false)
    expect(document.cookie).not.toContain("_ga")
    expect(document.cookie).toContain("lg-beta-access=essential")
    expect(messages().filter((item) => item.event === "lg_analytics")).toEqual(
      []
    )
  })

  it("restores a saved grant after controller installation, loads GTM once and emits no direct sends", () => {
    saveAnalyticsChoice(localStorage, true)
    render(
      <StrictMode>
        <GoogleAnalytics nonce="test-nonce" />
      </StrictMode>
    )
    expect(document.head.append).toHaveBeenCalledTimes(1)
    expect(vi.mocked(document.head.append).mock.calls[0]?.[0]).toMatchObject({
      src: "https://www.googletagmanager.com/gtm.js?id=GTM-M8GLG9F2",
      nonce: "test-nonce",
    })
    expect(
      messages().filter((item) => item.event === "lg_analytics_ready")
    ).toHaveLength(1)
    expect(
      messages().filter((item) => item.event === "lg_analytics")
    ).toHaveLength(1)
    expect(
      messages().find((item) => item.event === "lg_analytics")?.analytics
    ).toMatchObject({
      event_name: "page_view",
      transport: "gtm",
      page_location: "https://libraries.global/beta",
    })
    const commands = window.dataLayer!.map((item) =>
      Array.from(item as IArguments)
    )
    expect(
      commands.some((item) => item[0] === "config" || item[0] === "event")
    ).toBe(false)
    expect(JSON.stringify(window.dataLayer)).not.toContain("PRIVATE_CODE")
  })

  it("lets a visitor withdraw through the always-available control and unloads the SDK", () => {
    render(<GoogleAnalytics />)
    fireEvent.click(screen.getByRole("button", { name: "Accept analytics" }))
    expect(document.head.append).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Cookie choices" }))
    fireEvent.click(screen.getByRole("button", { name: "Reject analytics" }))
    expect(window["ga-disable-G-8M465CHXJ6"]).toBe(true)
    expect(readAnalyticsChoice(localStorage)?.analytics).toBe(false)
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it("honours withdrawal from another tab", () => {
    saveAnalyticsChoice(localStorage, true)
    render(<GoogleAnalytics />)
    saveAnalyticsChoice(localStorage, false)
    fireEvent(
      window,
      new StorageEvent("storage", { key: ANALYTICS_CONSENT_KEY })
    )
    expect(window["ga-disable-G-8M465CHXJ6"]).toBe(true)
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it("keeps the installed controller active across same-route shell renders", () => {
    saveAnalyticsChoice(localStorage, true)
    const view = render(<GoogleAnalytics nonce="document-nonce" />)
    view.rerender(<GoogleAnalytics nonce="route-payload-nonce" locale="fr" />)
    expect(window.librariesGlobalAnalytics?.hasConsent()).toBe(true)
    expect(document.head.append).toHaveBeenCalledTimes(1)
    expect(
      messages().filter((item) => item.event === "lg_analytics")
    ).toHaveLength(1)
  })

  it("sends only categorized account views with the renewed consent", () => {
    route.path = "/fr/profile/settings"
    window.location.pathname = route.path
    saveAnalyticsChoice(localStorage, true)
    render(<GoogleAnalytics locale="fr" workspaceEnabled />)
    expect(document.head.append).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(window.dataLayer)).toContain(
      "/workspace/account/page/settings"
    )
    expect(JSON.stringify(window.dataLayer)).not.toContain("/profile/settings")
    fireEvent.click(screen.getByRole("button", { name: "Choix des cookies" }))
    expect(
      screen
        .getByRole("link", { name: "Politique de cookies" })
        .getAttribute("href")
    ).toBe("/fr/legal/cookies")
    fireEvent.click(
      screen.getByRole("button", { name: "Refuser l’analytique" })
    )
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it("does not treat missing, malformed, expired or unsupported saved preferences as consent", () => {
    const now = Date.now()
    for (const value of [
      "invalid",
      "null",
      JSON.stringify({ version: 3, analytics: true, expires: now + 1000 }),
      JSON.stringify({ version: 1, analytics: true, expires: now + 1000 }),
      JSON.stringify({ version: 1, analytics: "true", expires: now + 1000 }),
      JSON.stringify({ version: 1, analytics: true, expires: now - 1 }),
    ]) {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, value)
      expect(readAnalyticsChoice(localStorage, now)).toBeUndefined()
    }
    expect(
      readAnalyticsChoice({
        getItem: () => {
          throw new Error("blocked")
        },
      })
    ).toBeUndefined()
  })

  it("asks again for the wider purpose but preserves previous refusals", () => {
    const expires = Date.now() + 10_000
    localStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      JSON.stringify({ version: 1, analytics: true, expires })
    )
    render(<GoogleAnalytics />)
    expect(
      screen.getByRole("region", { name: "Your cookie choices" })
    ).toBeDefined()
    expect(document.head.append).not.toHaveBeenCalled()
    cleanup()
    localStorage.setItem(
      ANALYTICS_CONSENT_KEY,
      JSON.stringify({ version: 1, analytics: false, expires })
    )
    render(<GoogleAnalytics />)
    expect(
      screen.queryByRole("region", { name: "Your cookie choices" })
    ).toBeNull()
    expect(document.head.append).not.toHaveBeenCalled()
  })
})
