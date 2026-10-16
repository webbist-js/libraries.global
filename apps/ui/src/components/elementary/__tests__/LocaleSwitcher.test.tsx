// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { Window as HappyDomWindow } from "happy-dom"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import LocaleSwitcher from "../LocaleSwitcher"

const { pathname, clientReplace } = vi.hoisted(() => ({
  pathname: vi.fn(),
  clientReplace: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace: clientReplace }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: vi.fn() }))
vi.mock("@/lib/analytics-events", () => ({ pushAnalyticsEvent: vi.fn() }))
vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange }: { onValueChange: (locale: string) => void }) => (
    <>
      {["en", "cs", "fr"].map((locale) => (
        <button key={locale} onClick={() => onValueChange(locale)}>
          {locale}
        </button>
      ))}
    </>
  ),
  SelectContent: () => null,
  SelectItem: () => null,
  SelectSeparator: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

it.each([
  { from: "fr", to: "en", path: "/fr", target: "/en" },
  { from: "cs", to: "en", path: "/cs", target: "/en" },
  { from: "en", to: "fr", path: "/", target: "/fr" },
  { from: "en", to: "cs", path: "/", target: "/cs" },
  {
    from: "fr",
    to: "en",
    path: "/fr/journal?view=list&section=data#all-articles",
    target: "/en/journal?view=list&section=data#all-articles",
  },
] as const)(
  "requests $target as a document so cached navigation cannot restore $from",
  ({ from, to, path, target }) => {
    ;(window as unknown as HappyDomWindow).happyDOM.setURL(
      `https://libraries.global${path}`
    )
    pathname.mockReturnValue(window.location.pathname)
    const replace = vi
      .spyOn(window.location, "replace")
      .mockImplementation(() => {})
    render(
      <NextIntlClientProvider
        locale={from}
        messages={{ translation: { language: "Language" } }}
        timeZone="Europe/London"
      >
        <LocaleSwitcher locale={from} />
      </NextIntlClientProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: to }))

    expect(replace).toHaveBeenCalledWith(target)
    expect(clientReplace).not.toHaveBeenCalled()
    replace.mockRestore()
  }
)
