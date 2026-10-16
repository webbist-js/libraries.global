// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import type * as NextIntl from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_JOURNAL_QUERY } from "./journalLanding.helpers"
import { JournalListControls } from "./JournalListControls"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))
vi.mock("next-intl", async (original) => {
  const actual = await original<typeof NextIntl>()
  const messages = (await import("../../../locales/en.json")).default

  return {
    ...actual,
    useLocale: () => "en",
    useTranslations: (namespace: "ui" | "editorial" | "discovery") =>
      actual.createTranslator({ locale: "en", messages, namespace }),
  }
})
afterEach(cleanup)

describe("Journal content language selection", () => {
  it("shows All languages as the actual default for a Spanish-only collection", () => {
    render(
      <JournalListControls
        query={DEFAULT_JOURNAL_QUERY}
        lang="all"
        languages={[{ code: "es", name: "Spanish" }]}
      />
    )
    expect(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
        .value
    ).toBe("all")
  })
  it("retains an explicit zero-result English language instead of visually selecting All languages", () => {
    render(
      <JournalListControls
        query={{ ...DEFAULT_JOURNAL_QUERY, lang: "en" }}
        lang="en"
        languages={[{ code: "es", name: "Spanish" }]}
      />
    )
    const select = screen.getByRole("combobox", {
      name: "Language",
    }) as HTMLSelectElement
    expect(select.value).toBe("en")
    expect(screen.getByRole("option", { name: "English" })).toBeTruthy()
  })
})
