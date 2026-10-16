// @vitest-environment happy-dom
import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
} from "@repo/shared-data"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type * as NextIntl from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ArticleDiscoveryFilters } from "./ArticleDiscoveryFilters"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
  session: null as { user: { id: string } } | null,
}))
vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))
vi.mock("next-intl", async (original) => {
  const actual = await original<typeof NextIntl>()
  const messages = (await import("../../../locales/en.json")).default

  return {
    ...actual,
    useLocale: () => "en",
    useTranslations: (namespace: "discovery") =>
      actual.createTranslator({ locale: "en", messages, namespace }),
  }
})
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: mocks.session }) },
}))

const story: ArticleBrowseItem = {
  documentId: "one",
  title: "Story",
  locale: "es",
  slug: "story",
  summary: null,
  author: null,
  authorUsername: null,
  publicationOrigin: "community",
  publishedAt: "2026-10-16",
  updatedAt: null,
  featured: false,
  readingTimeMinutes: 3,
  place: "Colombia",
  section: null,
  sectionSlugs: [],
  heroImage: null,
  facets: {
    countries: [
      { value: "co", label: "Colombia", slug: "colombia", code: "CO" },
    ],
    regions: [
      {
        value: "bogota",
        label: "Bogotá",
        countryDocumentId: "co",
        continentDocumentId: "sa",
      },
    ],
    continents: [{ value: "sa", label: "South America" }],
    areas: [
      {
        value: "centre",
        label: "Centre",
        regionDocumentId: "bogota",
        countryDocumentId: "co",
        continentDocumentId: "sa",
      },
    ],
    languages: [{ value: "es", label: "Spanish" }],
    origins: [{ value: "community", label: "Community Journal" }],
  },
}
const discovery = aggregateArticleBrowse(
  [story],
  parseArticleBrowseQuery({ lang: "es" })
)
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.params = new URLSearchParams()
  mocks.session = null
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("article reader preferences", () => {
  it.each(["journal", "knowledge"] as const)(
    "keeps an explicit unavailable language selected in %s filters",
    (kind) => {
      mocks.params = new URLSearchParams("lang=en")
      const unavailable = aggregateArticleBrowse(
        [story],
        parseArticleBrowseQuery({ lang: "en" })
      )
      render(<ArticleDiscoveryFilters discovery={unavailable} kind={kind} />)
      fireEvent.click(screen.getByRole("button", { name: "Filters · 1" }))
      const choice = screen.getByRole("checkbox", {
        name: "English (0)",
        hidden: true,
      }) as HTMLInputElement
      expect(choice.checked).toBe(true)
      fireEvent.click(choice)
      expect(mocks.push).toHaveBeenCalledWith(`/${kind}?lang=all`, {
        scroll: false,
      })
    }
  )

  it("offers a saved country only after explicit selection and preserves unrelated filters", async () => {
    mocks.params = new URLSearchParams("lang=es&section=stories&page=3")
    localStorage.setItem(
      "libraries-global:article-country:v1",
      JSON.stringify({ version: 1, countries: ["colombia"] })
    )
    render(<ArticleDiscoveryFilters discovery={discovery} kind="journal" />)
    const suggestion = await screen.findByRole("button", {
      name: "Explore content about Colombia",
    })
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    fireEvent.click(suggestion)
    expect(mocks.push).toHaveBeenCalledWith(
      "/journal?lang=es&section=stories&country=co",
      { scroll: false }
    )
  })

  it("lets an explicit worldwide URL override a saved preference", () => {
    mocks.params = new URLSearchParams("country=all")
    localStorage.setItem(
      "libraries-global:article-country:v1",
      JSON.stringify({ version: 1, countries: ["colombia"] })
    )
    render(<ArticleDiscoveryFilters discovery={discovery} kind="journal" />)
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("country changes clear child filters and pagination, preserving unrelated facets", () => {
    mocks.params = new URLSearchParams(
      "lang=es&region=bogota&area=centre&topic=reading&page=3"
    )
    render(<ArticleDiscoveryFilters discovery={discovery} kind="journal" />)
    fireEvent.click(screen.getByRole("button", { name: "Filters · 1" }))
    fireEvent.click(screen.getByRole("checkbox", { name: "Colombia (1)" }))
    expect(mocks.push).toHaveBeenCalledWith(
      "/journal?lang=es&topic=reading&country=co",
      { scroll: false }
    )
    expect(
      JSON.parse(localStorage.getItem("libraries-global:article-country:v1")!)
    ).toEqual({ version: 1, countries: ["co"] })
  })

  it("offers an account-country suggestion without changing the interface or silently filtering", async () => {
    mocks.session = { user: { id: "reader" } }
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { country: "CO" } }),
      })
    )
    render(<ArticleDiscoveryFilters discovery={discovery} kind="journal" />)
    expect(
      await screen.findByRole("button", {
        name: "Explore content about Colombia",
      })
    ).toBeTruthy()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})

it("stages mobile filters, hides stale counts and only navigates on Show results", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal("fetch", fetcher)
  mocks.params = new URLSearchParams("lang=es")
  render(<ArticleDiscoveryFilters discovery={discovery} kind="journal" />)
  fireEvent.click(screen.getByRole("button", { name: "Filters · 1" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "Centre (1)" }))
  expect(mocks.push).not.toHaveBeenCalled()
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect(screen.getByRole("checkbox", { name: "Centre" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Show results" }))
  expect(mocks.push).toHaveBeenCalledWith(
    "/journal?lang=es&area=centre&continent=sa&country=co&region=bogota",
    { scroll: false }
  )
  expect(fetcher.mock.calls[0]![0]).toMatch(
    /^\/api\/public-proxy\/api\/blog-articles\/browse\?/
  )
  const init = fetcher.mock.calls[0]![1] as RequestInit
  expect(init.signal?.aborted).toBe(true)
})
