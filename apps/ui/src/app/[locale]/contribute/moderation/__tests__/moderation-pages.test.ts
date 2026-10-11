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
vi.mock("@/lib/article-editor-server", () => ({
  fetchArticleLocales: async () => [{ code: "en", name: "English" }],
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchPlaceLink: async () => null,
}))
vi.mock("@/lib/editor-gate", () => ({ userIsArticleEditor: () => false }))
vi.mock("@/lib/seo/metadata", () => ({ privateMetadata: () => ({}) }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
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
  "@/app/[locale]/contribute/moderation/_components/ModerationHero",
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
  const Stub = () => null

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
    ModerationQueue: Stub,
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

const ID = "sub000000000000000000001"
const unknown = { id: "u1", profileLoaded: false, capabilities: [] }
const moderator = {
  id: "u1",
  profileLoaded: true,
  capabilities: ["moderate.queue"],
  moderationScopes: [{ queue: "all", locale: null }],
}

beforeEach(() => {
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
    expect(form.getAttribute("action")).toBe(`/contribute/moderation/${ID}`)
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
    ).toBe("/contribute/moderation")
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
        path: "/contribute/moderation/suggestions",
      })
    )
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Option *suggestions*"
    )
  })
})
