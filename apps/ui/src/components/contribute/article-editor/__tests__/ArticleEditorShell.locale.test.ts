// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { editingLocaleFrom } from "../article.types"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
// strapi-helpers pulls in env validation; these tests need no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
const grants = vi.hoisted(() => ({ canDirectEdit: vi.fn(() => true) }))
vi.mock("@/lib/access-client", () => ({
  useCapabilities: () => ({
    has: () => true,
    canDirectEdit: grants.canDirectEdit,
    ready: true,
  }),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})
// The editor and sidebar are heavy (TipTap); the shell's locale logic isn't.
vi.mock("../ArticleEditor", async () => {
  const { createElement: h } = await import("react")

  return {
    ArticleEditor: ({
      title,
      onTitleChange,
    }: {
      title: string
      onTitleChange: (v: string) => void
    }) =>
      h("input", {
        "aria-label": "Test title",
        value: title,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onTitleChange(e.target.value),
      }),
  }
})
vi.mock("../ArticlePreview", () => ({ ArticlePreview: () => null }))
vi.mock("@/components/blog/ArticleBodyBlocks", () => ({
  ArticleBodyBlocks: () => null,
}))
vi.mock("../ArticleSidebar", async () => {
  const { createElement: h } = await import("react")
  const Null = () => null

  return {
    EditSummaryCard: Null,
    HowEditingWorks: Null,
    LanguageCard: ({
      locale,
      onChange,
      disabled,
    }: {
      locale: string
      onChange: (v: string) => void
      disabled?: boolean
    }) =>
      h(
        "select",
        {
          "aria-label": "Test language",
          value: locale,
          disabled,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            onChange(e.target.value),
        },
        h("option", { value: "en" }, "English"),
        h("option", { value: "fr" }, "French")
      ),
    SectionsCard: Null,
    StatusCard: ({ submitError }: { submitError?: string }) =>
      submitError ? h("p", { role: "alert" }, submitError) : null,
    TagsCard: Null,
  }
})

const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) =>
  Response.json({ data: null })
)

const { ArticleEditorShell } = await import("../ArticleEditorShell")

const LOCALES = [
  { code: "en", name: "English", isDefault: true },
  { code: "fr", name: "French", isDefault: false },
]
const ARTICLE = {
  documentId: "doc1",
  slug: "my-article",
  locale: "en",
  title: "My article",
  summary: "",
  body: [],
  sections: [],
  tags: [],
  availableLocales: ["en"],
}

const renderShell = (initialLocale?: string) =>
  render(
    createElement(ArticleEditorShell, {
      kind: "knowledge",
      mode: "edit",
      article: ARTICLE,
      locales: LOCALES,
      uiLocale: "en",
      initialLocale,
    })
  )

const articleFetches = () =>
  fetchMock.mock.calls
    .map((c) => String((c as unknown[])[0]))
    .filter((u) => u.startsWith("/api/contribute/article"))

beforeEach(() => {
  vi.clearAllMocks()
  grants.canDirectEdit.mockImplementation(() => true)
  fetchMock.mockImplementation(async () => Response.json({ data: null }))
  vi.stubGlobal("fetch", fetchMock)
})

describe("article translation draft isolation", () => {
  const writes = () =>
    fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => JSON.parse(String(init?.body)))

  it("flushes the source and creates a separate submission for the translation", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? Response.json({ data: { documentId: `draft-${writes().length}` } })
        : Response.json({ data: null })
    )
    renderShell()
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "Edited English" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Test language") as HTMLSelectElement).value
      ).toBe("fr")
    )
    fireEvent.click(screen.getByRole("tab", { name: "Write" }))
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "Article français" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "en" },
    })
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(
      writes().map((body) => [body.draftData.locale, body.draftData.title])
    ).toEqual([
      ["en", "Edited English"],
      ["fr", "Article français"],
    ])
  })

  it("keeps the source draft and locale when its save fails", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? Response.json({ error: "Unavailable" }, { status: 503 })
        : Response.json({ data: null })
    )
    renderShell()
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "Keep this draft" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await screen.findByRole("alert")
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("Keep this draft")
    expect(
      (screen.getByLabelText("Test language") as HTMLSelectElement).value
    ).toBe("en")
    expect(articleFetches()).toEqual([])
  })

  it("keeps the source when a translated article read fails", async () => {
    fetchMock.mockImplementation(async (url) =>
      url.startsWith("/api/contribute/article")
        ? Response.json({ error: "Unavailable" }, { status: 503 })
        : Response.json({ data: null })
    )
    renderShell()
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await screen.findByRole("alert")
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("My article")
    expect(
      (screen.getByLabelText("Test language") as HTMLSelectElement).value
    ).toBe("en")
  })

  it("also keeps new-article drafts in separate languages", async () => {
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? Response.json({ data: { documentId: `draft-${writes().length}` } })
        : Response.json({ data: null })
    )
    render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "new",
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "English draft" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Test language") as HTMLSelectElement).value
      ).toBe("fr")
    )
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "Brouillon français" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "en" },
    })
    await waitFor(() => expect(writes()).toHaveLength(2))
    expect(
      writes().map((body) => [body.draftData.locale, body.draftData.title])
    ).toEqual([
      ["en", "English draft"],
      ["fr", "Brouillon français"],
    ])
  })

  it("does not load or switch to a language outside the editor's grant", async () => {
    grants.canDirectEdit.mockImplementation(
      (...args: unknown[]) => args[1] === "en"
    )
    renderShell("fr")
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(articleFetches()).toEqual([])
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("My article")
  })
})
afterEach(cleanup)

describe("editingLocaleFrom", () => {
  it("keeps a configured locale and ignores anything else", () => {
    expect(editingLocaleFrom("fr", LOCALES)).toBe("fr")
    expect(editingLocaleFrom("de", LOCALES)).toBeUndefined()
    expect(editingLocaleFrom(["fr"], LOCALES)).toBeUndefined()
    expect(editingLocaleFrom(undefined, LOCALES)).toBeUndefined()
  })
})

describe("ArticleEditorShell initialLocale", () => {
  it("opens the requested translation on load", async () => {
    renderShell("fr")
    await waitFor(() =>
      expect(articleFetches()).toEqual([
        "/api/contribute/article?kind=knowledge&slug=my-article&locale=fr",
      ])
    )
  })

  it("loads nothing extra for the source locale or none", async () => {
    renderShell("en")
    renderShell()
    await new Promise((r) => setTimeout(r, 20))
    expect(articleFetches()).toEqual([])
  })
})
