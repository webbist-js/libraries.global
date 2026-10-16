// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { ContributionAccountGuard } from "../../ContributionAccountGuard"
import { editingLocaleFrom } from "../article.types"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
// strapi-helpers pulls in env validation; these tests need no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
const grants = vi.hoisted(() => ({
  canDirectEdit: vi.fn(() => true),
  editorLocales: { journal: "all" as string | string[] },
  userId: "writer",
  pending: false,
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: grants.userId, editorLocales: grants.editorLocales } },
    isPending: grants.pending,
  }),
  useCapabilities: () => ({
    has: () => true,
    canDirectEdit: grants.canDirectEdit,
    ready: true,
  }),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    useRouter: () => ({ refresh: vi.fn() }),
    usePathname: () => "/contribute/knowledge/journal/my-article",
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
    ArticleEventsCard: Null,
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
    StatusCard: ({
      submitError,
      onSubmit,
      canSubmit,
    }: {
      submitError?: string
      onSubmit: () => void
      canSubmit: boolean
    }) =>
      h(
        "div",
        null,
        submitError ? h("p", { role: "alert" }, submitError) : null,
        h("button", { onClick: onSubmit, disabled: !canSubmit }, "Test send")
      ),
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
  grants.editorLocales.journal = "all"
  grants.userId = "writer"
  grants.pending = false
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

describe("community Journal authoring", () => {
  it("lets a signed-in writer create a moderated Journal draft without an editor grant", async () => {
    grants.canDirectEdit.mockImplementation(() => false)
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? Response.json({ data: { documentId: "writer-draft" } })
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
      target: { value: "My library visit" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    )
    const body = JSON.parse(
      String(
        fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]
          ?.body
      )
    )
    expect(body).toMatchObject({
      submissionType: "blog_submission",
      asDraft: true,
      draftData: {
        kind: "new_article",
        title: "My library visit",
        locale: "en",
      },
    })
  })

  it("allows server-authorized own edits and retains the pinned published revision", async () => {
    grants.canDirectEdit.mockImplementation(() => false)
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? Response.json({ data: { documentId: "author-draft" } })
        : Response.json({ data: null })
    )
    render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "edit",
        article: { ...ARTICLE, baseRevision: "original-revision" },
        canOwnEdit: true,
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "Updated story" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    )
    const body = JSON.parse(
      String(
        fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]
          ?.body
      )
    )
    expect(body.draftData).toMatchObject({
      title: "Updated story",
      baseRevision: "original-revision",
    })
    expect(body.draftData).not.toHaveProperty("proposedTitle")
  })
})

describe("article draft recovery and public attribution", () => {
  it("resumes a needs_info article using its exact submission and original revision", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (url.startsWith("/api/submissions/my?"))
        return Response.json({
          data: [
            {
              documentId: "returned-draft",
              submissionType: "blog_submission",
              targetSlug: "my-article",
              status: "needs_info",
              draftData: {
                title: "My saved work",
                body: [],
                sections: ["culture"],
                locale: "en",
                baseRevision: "old-revision",
                editSummary: "Addressed feedback",
              },
            },
          ],
        })
      if (url.startsWith("/api/contribute/article"))
        return Response.json({
          data: {
            title: "Current published article",
            summary: "",
            body: [],
            contentRevision: "new-revision",
          },
        })

      return Response.json({
        data: init ? { documentId: "returned-draft" } : null,
      })
    })
    render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "edit",
        article: { ...ARTICLE, baseRevision: "new-revision" },
        resumeDraftId: "returned-draft",
        canOwnEdit: true,
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Test title") as HTMLInputElement).value
      ).toBe("My saved work")
    )
    expect(
      screen.getByRole("button", { name: "Test send" }).hasAttribute("disabled")
    ).toBe(true)
    fireEvent.click(
      screen.getByRole("button", { name: "Compare current published version" })
    )
    await screen.findByRole("button", { name: /I have compared/ })
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method)
    ).toHaveLength(0)
    fireEvent.click(screen.getByRole("button", { name: /I have compared/ }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url === "/api/submissions/returned-draft/draft" &&
            init?.method === "PATCH"
        )
      ).toBe(true)
    )
    const save = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === "/api/submissions/returned-draft/draft" &&
        init?.method === "PATCH"
    )
    expect(JSON.parse(String(save?.[1]?.body)).draftData).toMatchObject({
      title: "My saved work",
      baseRevision: "old-revision",
      rebaseRevision: "new-revision",
    })
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Test send" })
          .hasAttribute("disabled")
      ).toBe(false)
    )
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("My saved work")
  })

  it("preserves the draft when adoption fails and requires a fresh comparison", async () => {
    fetchMock.mockImplementation(async (url, init) => {
      if (url.startsWith("/api/submissions/my?"))
        return Response.json({
          data: [
            {
              documentId: "returned-draft",
              submissionType: "blog_submission",
              targetSlug: "my-article",
              status: "needs_info",
              draftData: {
                title: "Keep my edits",
                body: [],
                sections: ["culture"],
                locale: "en",
                baseRevision: "old-revision",
                editSummary: "Updated",
              },
            },
          ],
        })
      if (url.startsWith("/api/contribute/article"))
        return Response.json({
          data: { title: "Published", contentRevision: "new-revision" },
        })

      return init
        ? Response.json({ error: "Article changed again" }, { status: 400 })
        : Response.json({ data: null })
    })
    render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "edit",
        article: { ...ARTICLE, baseRevision: "new-revision" },
        resumeDraftId: "returned-draft",
        canOwnEdit: true,
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Test title") as HTMLInputElement).value
      ).toBe("Keep my edits")
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Compare current published version" })
    )
    fireEvent.click(
      await screen.findByRole("button", { name: /I have compared/ })
    )
    await screen.findByText(/could not be adopted/)
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("Keep my edits")
    expect(
      screen.getByRole("button", { name: "Test send" }).hasAttribute("disabled")
    ).toBe(true)
  })

  it("saves a new public pen name and defaults to community publication for ordinary writers", async () => {
    grants.canDirectEdit.mockImplementation(() => false)
    grants.editorLocales.journal = []
    fetchMock.mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? Response.json({ data: { documentId: "new-story" } })
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
    expect(screen.queryByLabelText("Publication")).toBeNull()
    fireEvent.change(screen.getByLabelText("Pen name (optional)"), {
      target: { value: "Library traveller" },
    })
    fireEvent.change(screen.getByLabelText("Test language"), {
      target: { value: "fr" },
    })
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    )
    const save = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST"
    )
    expect(JSON.parse(String(save?.[1]?.body)).draftData).toMatchObject({
      byline: "Library traveller",
      publicationOrigin: "community",
    })
  })

  it("offers Index publication only for a global Journal editor and never relabels an existing author", () => {
    const first = render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "new",
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    expect(screen.getByLabelText("Publication")).toBeTruthy()
    first.unmount()
    grants.editorLocales.journal = ["en"]
    const scoped = render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "new",
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    expect(screen.queryByLabelText("Publication")).toBeNull()
    scoped.unmount()
    render(
      createElement(ArticleEditorShell, {
        kind: "journal",
        mode: "edit",
        article: ARTICLE,
        locales: LOCALES,
        uiLocale: "en",
      })
    )
    expect(screen.queryByLabelText("Pen name (optional)")).toBeNull()
  })
})

it("recovers an exact returned draft once without overwriting a later translation switch", async () => {
  fetchMock.mockImplementation(async (url, init) => {
    if (url.startsWith("/api/submissions/my?"))
      return Response.json({
        data: [
          {
            documentId: "returned-draft",
            submissionType: "blog_submission",
            targetSlug: "my-article",
            status: "needs_info",
            draftData: {
              title: "Saved English",
              body: [],
              sections: ["culture"],
              locale: "en",
              baseRevision: "same-revision",
              editSummary: "Feedback",
            },
          },
        ],
      })
    if (url.startsWith("/api/contribute/article"))
      return Response.json({
        data: {
          title: "French version",
          body: [],
          contentRevision: "french-revision",
        },
      })

    return Response.json({
      data: init ? { documentId: "returned-draft" } : null,
    })
  })
  render(
    createElement(ArticleEditorShell, {
      kind: "journal",
      mode: "edit",
      article: { ...ARTICLE, baseRevision: "same-revision" },
      resumeDraftId: "returned-draft",
      initialLocale: "fr",
      canOwnEdit: true,
      locales: LOCALES,
      uiLocale: "en",
    })
  )
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("Saved English")
  )
  expect(articleFetches()).toEqual([])
  fireEvent.change(screen.getByLabelText("Test language"), {
    target: { value: "fr" },
  })
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Test language") as HTMLSelectElement).value
    ).toBe("fr")
  )
  fireEvent.click(screen.getByRole("tab", { name: "Write" }))
  expect((screen.getByLabelText("Test title") as HTMLInputElement).value).toBe(
    "French version"
  )
  expect(
    fetchMock.mock.calls
      .filter(([url]) => url.startsWith("/api/submissions/my?"))
      .map(([url]) => url)
  ).toEqual(["/api/submissions/my?documentId=returned-draft"])
})

it("creates a private draft before adopting a compared revision through the audited save seam", async () => {
  fetchMock.mockImplementation(async (url, init) => {
    if (url.startsWith("/api/contribute/article"))
      return Response.json({
        data: {
          title: "Updated published story",
          body: [],
          contentRevision: "new-revision",
        },
      })
    if (init?.method === "POST")
      return Response.json({ data: { documentId: "created-private" } })

    return Response.json({ data: null })
  })
  render(
    createElement(ArticleEditorShell, {
      kind: "journal",
      mode: "edit",
      article: { ...ARTICLE, baseRevision: "old-revision" },
      canOwnEdit: true,
      locales: LOCALES,
      uiLocale: "en",
    })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Compare current published version" })
  )
  fireEvent.click(
    await screen.findByRole("button", { name: /I have compared/ })
  )
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method)
    ).toHaveLength(2)
  )
  const [create, adopt] = fetchMock.mock.calls.filter(
    ([, init]) => init?.method
  )
  expect(create?.[0]).toBe("/api/submissions")
  expect(JSON.parse(String(create?.[1]?.body)).draftData).not.toHaveProperty(
    "rebaseRevision"
  )
  expect(adopt?.[0]).toBe("/api/submissions/created-private/draft")
  expect(JSON.parse(String(adopt?.[1]?.body)).draftData).toMatchObject({
    rebaseRevision: "new-revision",
    title: "My article",
  })
})

it("keeps failed exact-draft recovery read-only instead of creating a replacement submission", async () => {
  fetchMock.mockImplementation(async (url) =>
    url.startsWith("/api/submissions/my?")
      ? Response.json({ error: "Unavailable" }, { status: 503 })
      : Response.json({ data: null })
  )
  render(
    createElement(ArticleEditorShell, {
      kind: "journal",
      mode: "edit",
      article: ARTICLE,
      resumeDraftId: "saved-draft",
      canOwnEdit: true,
      locales: LOCALES,
      uiLocale: "en",
    })
  )
  await screen.findByText(/saved draft could not be opened/)
  fireEvent.change(screen.getByLabelText("Test title"), {
    target: { value: "Do not overwrite" },
  })
  expect((screen.getByLabelText("Test title") as HTMLInputElement).value).toBe(
    "My article"
  )
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method)).toHaveLength(
    0
  )
})

it("shows concurrent metadata changes beside unchanged prose without replacing the writer's relations", async () => {
  fetchMock.mockImplementation(async (url, init) => {
    if (url.startsWith("/api/contribute/article"))
      return Response.json({
        data: {
          title: "My article",
          summary: "",
          body: [],
          contentRevision: "metadata-changed",
          sections: ["new-section"],
          tags: [
            {
              kind: "country",
              label: "New published place",
              documentId: "new-place",
            },
          ],
          eventMentions: [
            {
              title: "New published event",
              libraryName: "New library",
              startTime: "2026-10-16T10:00:00Z",
              url: "https://event.example/new",
            },
          ],
        },
      })
    if (init?.method === "POST")
      return Response.json({ data: { documentId: "compared-draft" } })

    return Response.json({ data: null })
  })
  render(
    createElement(ArticleEditorShell, {
      kind: "journal",
      mode: "edit",
      article: {
        ...ARTICLE,
        baseRevision: "original",
        sections: ["old-section"],
        tags: [
          {
            kind: "country",
            label: "My original place",
            documentId: "old-place",
          },
        ],
        eventMentions: [{ title: "My original event" }],
      },
      canOwnEdit: true,
      locales: LOCALES,
      uiLocale: "en",
    })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Compare current published version" })
  )
  await screen.findByText("New published place")
  expect(screen.getByText("My original place")).toBeTruthy()
  expect(screen.getByText(/New published event/).textContent).toContain(
    "New library"
  )
  expect(screen.getByText("new section")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: /I have compared/ }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")
    ).toBe(true)
  )
  const adopted = fetchMock.mock.calls.find(
    ([, init]) => init?.method === "PATCH"
  )
  expect(JSON.parse(String(adopted?.[1]?.body)).draftData).toMatchObject({
    rebaseRevision: "metadata-changed",
    sections: ["old-section"],
    tags: [{ label: "My original place" }],
    eventMentions: [{ title: "My original event" }],
  })
})

it("hydrates the selected translation's canonical metadata before saving its edits", async () => {
  const french = {
    title: "French article",
    body: [],
    contentRevision: "fr-revision",
    sections: ["french-section"],
    tags: [{ kind: "country", label: "France", documentId: "fr-place" }],
    eventMentions: [{ title: "French event", citationId: "same-event" }],
  }
  fetchMock.mockImplementation(async (url, init) => {
    if (url.startsWith("/api/contribute/article"))
      return Response.json({ data: french })

    return Response.json({
      data: init?.method === "POST" ? { documentId: "fr-private" } : null,
    })
  })
  render(
    createElement(ArticleEditorShell, {
      kind: "journal",
      mode: "edit",
      article: {
        ...ARTICLE,
        baseRevision: "en-revision",
        sections: ["english-section"],
        tags: [{ kind: "country", label: "UK", documentId: "uk-place" }],
        eventMentions: [{ title: "English event" }],
      },
      canOwnEdit: true,
      locales: LOCALES,
      uiLocale: "en",
    })
  )
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
    target: { value: "Updated French" },
  })
  fireEvent.change(screen.getByLabelText("Test language"), {
    target: { value: "en" },
  })
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST")
    ).toBe(true)
  )
  const saved = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")
  expect(JSON.parse(String(saved?.[1]?.body)).draftData).toMatchObject({
    locale: "fr",
    baseRevision: "fr-revision",
    sections: french.sections,
    tags: french.tags,
    eventMentions: french.eventMentions,
  })
})

it("keeps the compared snapshot immutable while its explicit adoption save is in flight", async () => {
  let finish!: (response: Response) => void
  fetchMock.mockImplementation(async (url, init) => {
    if (url.startsWith("/api/contribute/article"))
      return Response.json({
        data: {
          title: "Current published",
          body: [],
          contentRevision: "new-revision",
          sections: [],
          tags: [],
          eventMentions: [],
        },
      })
    if (init?.method === "POST")
      return Response.json({ data: { documentId: "private-draft" } })
    if (init?.method === "PATCH")
      return new Promise<Response>((resolve) => {
        finish = resolve
      })

    return Response.json({ data: null })
  })
  render(
    createElement(ArticleEditorShell, {
      kind: "journal",
      mode: "edit",
      article: { ...ARTICLE, baseRevision: "old-revision" },
      canOwnEdit: true,
      locales: LOCALES,
      uiLocale: "en",
    })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Compare current published version" })
  )
  fireEvent.click(
    await screen.findByRole("button", { name: /I have compared/ })
  )
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")
    ).toBe(true)
  )
  fireEvent.change(screen.getByLabelText("Test title"), {
    target: { value: "Unsaved during adoption" },
  })
  expect((screen.getByLabelText("Test title") as HTMLInputElement).value).toBe(
    "My article"
  )
  expect(
    (screen.getByLabelText("Test language") as HTMLSelectElement).disabled
  ).toBe(true)
  finish(Response.json({ data: null }))
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Test language") as HTMLSelectElement).disabled
    ).toBe(false)
  )
})

it("unmounts a real private article draft and cancels autosave when the signed-in account changes", async () => {
  fetchMock.mockImplementation(async (url) =>
    url.startsWith("/api/submissions/my?")
      ? Response.json({
          data: [
            {
              documentId: "saved-private",
              targetSlug: "my-article",
              submissionType: "blog_submission",
              status: "draft",
              draftData: {
                title: "Private draft A",
                body: [],
                sections: ["culture"],
                locale: "en",
              },
            },
          ],
        })
      : Response.json({ data: null })
  )
  const actor = () => ({
    id: grants.userId,
    editorLocales: grants.editorLocales,
  })
  const scopeA = contributionAccountScope(actor())
  const child = createElement(ArticleEditorShell, {
    kind: "journal",
    mode: "edit",
    article: ARTICLE,
    resumeDraftId: "saved-private",
    canOwnEdit: true,
    locales: LOCALES,
    uiLocale: "en",
  })
  const view = render(
    createElement(ContributionAccountGuard, {
      expectedScope: scopeA,
      children: child,
    })
  )
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("Private draft A")
  )
  vi.useFakeTimers()
  try {
    fireEvent.change(screen.getByLabelText("Test title"), {
      target: { value: "Unsent private change" },
    })
    grants.userId = "another-writer"
    view.rerender(
      createElement(ContributionAccountGuard, {
        expectedScope: scopeA,
        children: child,
      })
    )
    expect(screen.queryByLabelText("Test title")).toBeNull()
    await vi.advanceTimersByTimeAsync(2000)
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method)
    ).toHaveLength(0)
    view.rerender(
      createElement(ContributionAccountGuard, {
        expectedScope: contributionAccountScope(actor()),
        children: createElement(ArticleEditorShell, {
          kind: "journal",
          mode: "edit",
          article: { ...ARTICLE, title: "B's published story" },
          canOwnEdit: true,
          locales: LOCALES,
          uiLocale: "en",
        }),
      })
    )
    expect(
      (screen.getByLabelText("Test title") as HTMLInputElement).value
    ).toBe("B's published story")
  } finally {
    vi.useRealTimers()
  }
})
