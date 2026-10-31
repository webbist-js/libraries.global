// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, render, screen, fireEvent, waitFor } from "@/test/render"

import { KnowledgeEditorLanding } from "../KnowledgeEditorLanding"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: "author", name: "Private name" } },
    isPending: false,
    error: null,
  }),
  useCapabilities: () => ({ ready: true, canDirectEdit: () => false }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("allows ordinary Journal creation and gives an older search hit an edit doorway only after private ownership proof", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.startsWith("/api/contribute/journal-ownership"))
      return Response.json({ data: { eligibility: { "older-story": true } } })

    return Response.json({
      items: [
        {
          documentId: "older",
          slug: "older-story",
          title: "An older story",
          locale: "es",
          publishedAt: "2026-10-16",
          updatedAt: null,
          section: { slug: "feature" },
          sectionSlugs: [],
          facets: {},
        },
      ],
    })
  })
  vi.stubGlobal("fetch", fetcher)
  render(
    <KnowledgeEditorLanding
      articles={[]}
      drafts={[]}
      initialKind="journal"
      kinds={["journal"]}
      creatableKinds={["journal"]}
    />
  )
  expect(
    screen
      .getByRole("link", { name: "Start a Journal story" })
      .getAttribute("href")
  ).toBe("/contribute/knowledge/new?type=journal&locale=en")
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "older" },
  })
  expect(
    (
      await screen.findByRole("link", { name: "Translate to English" })
    ).getAttribute("href")
  ).toBe("/contribute/knowledge/journal/older-story?locale=en&sourceLocale=es")
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url]) => url === "/api/contribute/journal-ownership?slug=older-story"
      )
    ).toBe(true)
  )
  expect(
    fetcher.mock.calls.some(([url]) =>
      url.startsWith("/api/public-proxy/api/blog-articles/browse?")
    )
  ).toBe(true)
  expect(screen.queryByText("Private name")).toBeNull()
})

it("groups translations once, defaults to the chosen content language and asks the server for missing translations", async () => {
  const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({ items: [], total: 0, pageCount: 0 })
  )
  vi.stubGlobal("fetch", fetcher)
  const article = {
    kind: "knowledge" as const,
    documentId: "one",
    slug: "one",
    title: "English title",
    sections: [],
    publishedAt: "2026-10-01",
    updatedAt: null,
    locale: "en",
  }
  render(
    <KnowledgeEditorLanding
      articles={[
        article,
        { ...article, locale: "fr", title: "Titre français" },
      ]}
      drafts={[]}
      initialKind="journal"
      kinds={["journal", "knowledge"]}
      creatableKinds={["journal"]}
      locales={[
        { code: "en", name: "English", isDefault: true },
        { code: "fr", name: "French", isDefault: false },
      ]}
      initialLocale="fr"
    />
  )
  expect(
    screen.getAllByRole("heading", { name: "Titre français" })
  ).toHaveLength(1)
  expect(screen.queryByRole("heading", { name: "English title" })).toBeNull()
  expect(
    screen
      .getByRole("link", { name: "Start a Journal story" })
      .getAttribute("href")
  ).toContain("locale=fr")
  fireEvent.click(screen.getByRole("button", { name: "Missing in French" }))
  await waitFor(() => expect(fetcher).toHaveBeenCalled())
  expect(
    fetcher.mock.calls.every((call) =>
      String(call[0]).includes("missingLocale=fr")
    )
  ).toBe(true)
  expect(
    fetcher.mock.calls.every((call) =>
      String(call[0]).includes("groupBy=document")
    )
  ).toBe(true)
  await screen.findByRole("button", { name: "Clear filters" })
})
