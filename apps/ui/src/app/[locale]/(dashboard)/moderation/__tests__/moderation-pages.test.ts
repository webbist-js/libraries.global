// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const { default: messages } =
    await import("../../../../../../locales/en.json")

  return {
    getTranslations: async (namespace: "ui") =>
      createTranslator({ locale: "en", messages, namespace }),
  }
})

Object.assign(globalThis, { React })

const mocks = vi.hoisted(() => ({
  getSessionSSR: vi.fn(),
  fetchModeration: vi.fn(),
  discussionCount: vi.fn(),
  queueProps: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
}))

vi.mock("next/navigation", () => ({
  notFound: () => mocks.notFound(),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: (...args: unknown[]) => mocks.getSessionSSR(...args),
}))
vi.mock("@/lib/moderation-proxy", () => ({
  fetchModeration: (...args: unknown[]) => mocks.fetchModeration(...args),
}))
vi.mock("@/lib/moderation-work-counts", () => ({
  fetchDiscussionReviewCount: (...args: unknown[]) =>
    mocks.discussionCount(...args),
}))
vi.mock("@/lib/article-editor-server", () => ({
  fetchArticleLocales: async () => [{ code: "en", name: "English" }],
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchPlaceLink: async () => null,
}))
vi.mock("@/lib/editor-gate", () => ({ userIsArticleEditor: () => false }))
vi.mock("@/lib/seo/metadata", () => ({ privateMetadata: () => ({}) }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/discussions/DiscussionModeration", () => ({
  DiscussionModeration: () => h("div", null, "Scoped discussion review"),
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    redirect: ({ href, locale }: { href: string; locale: string }) => {
      throw new Error(`LOCALE_REDIRECT:${locale}:${href}`)
    },
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => createElement("a", { href, ...rest }, children),
  }
})
vi.mock(
  "@/app/[locale]/(dashboard)/moderation/_components/ModerationHero",
  async () => {
    const { createElement } = await import("react")

    return {
      ModerationHero: ({
        title,
        children,
      }: {
        title: string
        children?: React.ReactNode
      }) =>
        createElement(
          "header",
          null,
          createElement("h1", null, title),
          children
        ),
    }
  }
)
// The review page's panels and the queue's parts: none render in these cases.
vi.mock("@/components/moderation", () => {
  const Stub = vi.fn().mockReturnValue(null)

  return {
    ArticleReviewPanel: Stub,
    ClaimPanel: Stub,
    DriveChip: Stub,
    DriveProposalPanel: Stub,
    EventFeedPanel: Stub,
    FacilitiesPanel: Stub,
    FieldsList: Stub,
    KeyValueList: Stub,
    NewLibraryPanel: Stub,
    RecordChangesTable: Stub,
    ReviewDecisionForm: Stub,
    ReviewThread: Stub,
    RoleApplicationPanel: Stub,
    StatusBadge: Stub,
    VerificationPanel: Stub,
    DriveQueueStrip: Stub,
    ModerationQueue: (props: unknown) => {
      mocks.queueProps(props)

      return null
    },
    EVIDENCE_TYPE_LABELS: {},
    SEGMENTS: [{ id: "pending" }],
    detailOf: () => "",
    formatDateTime: () => "",
    moderationRowLabel: () => "",
    describeScopes: () => "everything",
  }
})

const { default: ReviewSubmissionPage } = await import("../[documentId]/page")
const { default: ModerationQueuePage } = await import("../page")
const { default: DiscussionModerationPage } =
  await import("../discussions/page")

const ID = "sub000000000000000000001"
const unknown = { id: "u1", profileLoaded: false, capabilities: [] }
const moderator = {
  id: "u1",
  profileLoaded: true,
  capabilities: ["moderate.queue"],
  moderationScopes: [{ queue: "all", locale: null }],
}

beforeEach(() => {
  mocks.discussionCount.mockReset().mockResolvedValue(null)
  mocks.queueProps.mockClear()
  mocks.fetchModeration.mockResolvedValue({ status: 404, body: null })
})
afterEach(() => {
  cleanup()
  mocks.getSessionSSR.mockReset()
  mocks.fetchModeration.mockReset()
  mocks.notFound.mockClear()
})

async function review() {
  return render(
    await ReviewSubmissionPage({
      params: Promise.resolve({ locale: "en", documentId: ID }),
    })
  )
}

describe("the review page when the session profile didn't load", () => {
  it("says the access check failed and offers a retry, instead of 404", async () => {
    mocks.getSessionSSR.mockResolvedValue({ user: unknown })
    await review()
    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
    expect(screen.getByText("Couldn’t check your access")).toBeTruthy()
    expect(screen.getByText(/Try again\.$/)).toBeTruthy()
    const retry = screen.getByRole("button", { name: "Try again" })
    const form = retry.closest("form")!
    expect(form.getAttribute("method")).toBe("get")
    expect(form.getAttribute("action")).toBe(`/moderation/${ID}`)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Review a *submission*"
    )
  })

  it("still 404s a missing submission for a loaded Moderator", async () => {
    mocks.getSessionSSR.mockResolvedValue({ user: moderator })
    await expect(review()).rejects.toThrow("NOT_FOUND")
    expect(mocks.fetchModeration).toHaveBeenCalledWith(
      moderator,
      `submissions/${ID}`
    )
  })

  it("404s a loaded session that isn't a Moderator", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: { id: "u1", profileLoaded: true, capabilities: [] },
    })
    await expect(review()).rejects.toThrow("NOT_FOUND")
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
  })
})

describe("the queue page when the session profile didn't load", () => {
  it("shows the same retry notice and asks Strapi nothing", async () => {
    mocks.getSessionSSR.mockResolvedValue({ user: unknown })
    render(await ModerationQueuePage({ searchParams: Promise.resolve({}) }))
    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
    expect(screen.getByText("Couldn’t check your access")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: "Try again" })
        .closest("form")
        ?.getAttribute("action")
    ).toBe("/moderation")
  })
})

describe("the shared moderation workspace", () => {
  it("includes Suggested additions in the board's navigation and overview with its undecided count", async () => {
    mocks.getSessionSSR.mockResolvedValue({ user: moderator })
    mocks.fetchModeration.mockImplementation(async (_user, path) =>
      path === "option-suggestions"
        ? {
            status: 200,
            body: { data: [{ status: "open" }, { status: "accepted" }] },
          }
        : { status: 404, body: null }
    )
    render(await ModerationQueuePage({ searchParams: Promise.resolve({}) }))
    const link = screen.getByRole("link", { name: "Suggested additions 1" })
    expect(link.getAttribute("href")).toBe("/moderation/suggestions")
    expect(
      screen.getByRole("heading", { name: "Suggested additions" })
    ).toBeTruthy()
  })

  it("opens the only available category directly", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [{ queue: "knowledge", locale: "en" }],
      },
    })
    render(await ModerationQueuePage({ searchParams: Promise.resolve({}) }))
    expect(mocks.queueProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({ category: "articles" }),
      })
    )
    expect(screen.queryByRole("link", { name: "Overview" })).toBeNull()
    expect(
      screen.queryByRole("link", { name: /Suggested additions/ })
    ).toBeNull()
    expect(
      screen
        .getByRole("link", { name: "Articles" })
        .getAttribute("aria-current")
    ).toBe("page")
  })

  it("shows scoped category counts on the overview, including a real zero", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [{ queue: "index", locale: null }],
      },
    })
    mocks.fetchModeration.mockResolvedValue({
      status: 200,
      body: {
        data: [
          { category: "libraries", status: "pending", count: 4 },
          { category: "claims", status: "pending", count: 0 },
          { category: "drives", status: "pending", count: 2 },
        ],
      },
    })
    render(await ModerationQueuePage({ searchParams: Promise.resolve({}) }))
    expect(
      screen.getByRole("heading", { name: "Choose what to review" })
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Library changes 4" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Claims" })).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Claims 0" })).toBeNull()
    expect(
      screen.getByRole("link", { name: /^Claims .*0 waiting for review/ })
    ).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Articles" })).toBeNull()
    expect(mocks.discussionCount).not.toHaveBeenCalled()
    expect(mocks.queueProps).not.toHaveBeenCalled()
  })

  it("limits Articles to the reviewer's article queues and languages", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [
          { queue: "knowledge", locale: "fr" },
          { queue: "index", locale: "en" },
        ],
      },
    })
    render(
      await ModerationQueuePage({
        searchParams: Promise.resolve({
          category: "articles",
          queue: "index",
          locale: "en",
          q: "title",
        }),
      })
    )
    expect(mocks.queueProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        queues: ["knowledge"],
        locales: [{ code: "fr", name: "FR" }],
        state: expect.objectContaining({
          category: "articles",
          queue: "",
          locale: "",
          q: "title",
        }),
      })
    )
    expect(screen.queryByRole("link", { name: "Role applications" })).toBeNull()
  })

  it("rejects a category outside the reviewer's scope before loading any counts", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [{ queue: "knowledge", locale: "en" }],
      },
    })
    await expect(
      ModerationQueuePage({
        searchParams: Promise.resolve({ category: "claims" }),
      })
    ).rejects.toThrow("NOT_FOUND")
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
    expect(mocks.discussionCount).not.toHaveBeenCalled()
  })

  it("returns a signed-out moderator to the selected discussion queue after sign-in", async () => {
    mocks.getSessionSSR.mockResolvedValue(null)
    await expect(
      ModerationQueuePage({
        searchParams: Promise.resolve({ tab: "discussions" }),
      })
    ).rejects.toThrow(
      "REDIRECT:/auth/signin?callbackUrl=%2Fmoderation%3Ftab%3Ddiscussions"
    )
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
  })
  it("keeps both authorized queues visible and opens discussion review in place", async () => {
    mocks.getSessionSSR.mockResolvedValue({ user: moderator })
    render(
      await ModerationQueuePage({
        searchParams: Promise.resolve({
          tab: "discussions",
          queue: "index",
          locale: "en",
          q: "hours",
        }),
      })
    )
    expect(screen.getByText("Scoped discussion review")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Discussions" })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(
      screen.getByRole("link", { name: "Library changes" }).getAttribute("href")
    ).toBe("/moderation?category=libraries&queue=index&locale=en&q=hours")
    expect(mocks.fetchModeration).toHaveBeenCalledWith(
      moderator,
      "stats?group=category"
    )
  })

  it("defaults discussion-only moderators to their queue without querying library submissions", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [{ queue: "discussions", locale: "en" }],
      },
    })
    render(await ModerationQueuePage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByText("Scoped discussion review")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Library changes" })).toBeNull()
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
  })

  it("refuses a discussion tab outside the moderator's scope", async () => {
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [{ queue: "index", locale: null }],
      },
    })
    await expect(
      ModerationQueuePage({
        searchParams: Promise.resolve({ tab: "discussions" }),
      })
    ).rejects.toThrow("NOT_FOUND")
    expect(mocks.fetchModeration).not.toHaveBeenCalled()
  })

  it("retains access checks and the locale when opening an old discussion review link", async () => {
    mocks.getSessionSSR.mockResolvedValue({ user: moderator })
    await expect(
      DiscussionModerationPage({ params: Promise.resolve({ locale: "fr" }) })
    ).rejects.toThrow("LOCALE_REDIRECT:fr:/moderation?tab=discussions")
    mocks.getSessionSSR.mockResolvedValue({
      user: {
        ...moderator,
        moderationScopes: [{ queue: "index", locale: null }],
      },
    })
    await expect(
      DiscussionModerationPage({ params: Promise.resolve({ locale: "en" }) })
    ).rejects.toThrow("NOT_FOUND")
  })
})

describe("ModerationAccessUnavailable", () => {
  it("renders the hero title it is given, so the shell stays put", async () => {
    const { ModerationAccessUnavailable } =
      await import("../_components/ModerationAccessUnavailable")
    render(
      h(ModerationAccessUnavailable, {
        title: "Option *suggestions*",
        leaf: "Option suggestions",
        path: "/moderation/suggestions",
      })
    )
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Option *suggestions*"
    )
  })
})
