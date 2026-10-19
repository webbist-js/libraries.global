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

describe("Journal list presentation", () => {
  it("keeps sorting separate from the single shared filter panel", () => {
    render(<JournalListControls query={DEFAULT_JOURNAL_QUERY} />)
    expect(screen.queryByRole("combobox", { name: "Language" })).toBeNull()
    expect(
      screen.getByRole("combobox", { name: "Sort" }).textContent
    ).toContain("Newest")
    expect(screen.getByRole("group", { name: "Layout" })).toBeTruthy()
  })
})
