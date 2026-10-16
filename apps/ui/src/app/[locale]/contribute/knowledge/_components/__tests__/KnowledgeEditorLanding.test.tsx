// @vitest-environment happy-dom
import { afterEach, it, expect, vi } from "vitest"

import { cleanup, render, screen, fireEvent, waitFor } from "@/test/render"

import { KnowledgeEditorLanding } from "../KnowledgeEditorLanding"

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
    screen.getByRole("link", { name: "Start writing" }).getAttribute("href")
  ).toBe("/contribute/knowledge/new?type=journal")
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "older" } })
  expect(
    (await screen.findByRole("link", { name: "Edit your story" })).getAttribute(
      "href"
    )
  ).toBe("/contribute/knowledge/journal/older-story?locale=es&sourceLocale=es")
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url]) => url === "/api/contribute/journal-ownership?slug=older-story"
      )
    ).toBe(true)
  )
  expect(screen.queryByText("Private name")).toBeNull()
})
