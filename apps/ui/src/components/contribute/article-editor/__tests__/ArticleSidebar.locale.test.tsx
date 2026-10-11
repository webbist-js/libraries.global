// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen, waitFor } from "@/test/render"

import { SectionsCard, TagsCard } from "../ArticleSidebar"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/meilisearch", () => ({
  searchLibraryNames: vi.fn().mockResolvedValue({ hits: [] }),
}))
vi.mock("@/lib/navigation", () => ({ Link: () => null }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("article content locale", () => {
  it("reloads section labels for the article language and ignores an old response", async () => {
    let resolveEnglish!: (value: Response) => void
    const english = new Promise<Response>((resolve) => {
      resolveEnglish = resolve
    })
    const fetch = vi
      .fn()
      .mockReturnValueOnce(english)
      .mockResolvedValueOnce(
        Response.json({ data: [{ slug: "events", name: "Akce" }] })
      )
    vi.stubGlobal("fetch", fetch)
    const props = {
      kind: "knowledge" as const,
      sections: [],
      onChange: vi.fn(),
    }
    const view = render(<SectionsCard {...props} locale="en" />)
    view.rerender(<SectionsCard {...props} locale="cs" />)
    await screen.findByText("Akce")
    resolveEnglish(
      Response.json({ data: [{ slug: "events", name: "Events" }] })
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      "/api/relations/wiki-sections?locale=en",
      "/api/relations/wiki-sections?locale=cs",
    ])
    expect(screen.queryByText("Events")).toBeNull()
  })

  it("shows selected topic labels in the content language while the interface is English", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          { documentId: "topic", slug: "rare-books", name: "Livres rares" },
        ],
      })
    )
    vi.stubGlobal("fetch", fetch)
    render(
      <TagsCard
        locale="fr"
        tags={[
          {
            kind: "topic",
            documentId: "topic",
            slug: "rare-books",
            label: "Rare Books",
          },
        ]}
        onChange={vi.fn()}
      />
    )
    await screen.findByText("Livres rares")
    expect(screen.queryByText("Rare Books")).toBeNull()
    expect(fetch).toHaveBeenCalledWith("/api/relations/topics?locale=fr")
  })
})
