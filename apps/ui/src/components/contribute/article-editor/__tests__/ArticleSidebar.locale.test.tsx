// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { ArticleEventsCard, SectionsCard, TagsCard } from "../ArticleSidebar"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/meilisearch", () => ({
  searchLibraryNames: vi.fn().mockResolvedValue({ hits: [] }),
}))
vi.mock("@/lib/navigation", () => ({ Link: () => null }))
vi.mock("@/components/ds/SelectField", () => ({
  SelectField: ({
    label,
    value,
    onValueChange,
    options,
    disabled,
  }: {
    label: string
    value: string
    onValueChange: (value: string) => void
    options: { value: string; label: string }[]
    disabled?: boolean
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("article content locale", () => {
  it("shows inherited sections as read-only labels without unrelated choices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            { slug: "getting-started", name: "Getting started" },
            { slug: "events", name: "Events" },
          ],
        })
      )
    )
    const onChange = vi.fn()
    render(
      <SectionsCard
        kind="knowledge"
        locale="en"
        sections={["getting-started"]}
        onChange={onChange}
        inherited
        disabled
      />
    )

    await screen.findByText("Getting started")
    expect(screen.getByText("Inherited from the source article.")).toBeTruthy()
    expect(screen.queryByText("Events")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

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
    const fetch = vi.fn(async (url: string) =>
      Response.json({
        data: url.includes("/topics?")
          ? [{ documentId: "topic", slug: "rare-books", name: "Livres rares" }]
          : [],
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

describe("explicit article relations", () => {
  it("adds a real Country relation and never invents a free tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json({
          data: url.includes("/countries?")
            ? [{ documentId: "colombia", name: "Colombia" }]
            : [],
        })
      )
    )
    const onChange = vi.fn()
    render(<TagsCard locale="en" tags={[]} onChange={onChange} />)
    await screen.findByRole("option", { name: "Colombia" })
    fireEvent.change(screen.getByRole("combobox", { name: "Country" }), {
      target: { value: "colombia" },
    })
    expect(onChange).toHaveBeenCalledWith([
      { kind: "country", label: "Colombia", documentId: "colombia" },
    ])
    onChange.mockClear()
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Invented tag" },
    })
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("keeps an ended Event as a durable citation and rejects unsafe citation URLs", () => {
    const onChange = vi.fn()
    render(
      <ArticleEventsCard
        mentions={[]}
        libraries={[
          { kind: "library", label: "My library", documentId: "library" },
        ]}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText("Event name"), {
      target: { value: "Past festival" },
    })
    fireEvent.change(screen.getByLabelText("Public source URL"), {
      target: { value: "data:text/plain,unsafe-citation" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add event mention" }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toContain(
      "valid public source URL"
    )
    fireEvent.change(screen.getByLabelText("Public source URL"), {
      target: { value: "https://library.example/festival" },
    })
    fireEvent.change(screen.getByLabelText("Event date (optional)"), {
      target: { value: "2025-10-10T11:00" },
    })
    fireEvent.change(screen.getByLabelText("Event timezone (IANA name)"), {
      target: { value: "America/Bogota" },
    })
    fireEvent.change(screen.getByLabelText("End time (optional)"), {
      target: { value: "2025-10-10T13:00" },
    })
    fireEvent.change(screen.getByLabelText("Library (optional)"), {
      target: { value: "library" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add event mention" }))
    expect(onChange).toHaveBeenCalledWith([
      {
        title: "Past festival",
        url: "https://library.example/festival",
        startTime: "2025-10-10T16:00:00.000Z",
        endTime: "2025-10-10T18:00:00.000Z",
        timezone: "America/Bogota",
        libraryDocumentId: "library",
      },
    ])
  })
})
