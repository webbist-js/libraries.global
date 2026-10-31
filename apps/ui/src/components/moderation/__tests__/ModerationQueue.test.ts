// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContributionAccountGuard } from "@/components/contribute/ContributionAccountGuard"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { cleanup, render, screen, waitFor } from "@/test/render"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    usePathname: () => "/moderation",
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
  }
})

const actor = vi.hoisted(() => ({
  user: {
    id: "moderator-a",
    moderationScopes: [{ queue: "all", locale: null }] as {
      queue: string
      locale: string | null
    }[],
  },
  pending: false,
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: actor.user },
    isPending: actor.pending,
  }),
}))

const fetchMock = vi.fn()
const { ModerationQueue, queueHref } = await import("../ModerationQueue")

const BASE_STATE = {
  segment: "pending" as const,
  queue: "" as const,
  locale: "",
  q: "",
  drive: "",
  page: 1,
}

const renderQueue = (stateOver: Partial<typeof BASE_STATE> = {}) =>
  render(
    createElement(ModerationQueue, {
      state: { ...BASE_STATE, ...stateOver },
      queues: ["index"],
      locales: [],
      localeNames: {},
    })
  )

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

const answer = (status: number) =>
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/stats")
      ? Response.json({ data: [] })
      : Response.json({ error: { status, name: "conflict" } }, { status })
  )

describe("ModerationQueue errors", () => {
  it("403: says the queue is out of reach", async () => {
    answer(403)
    renderQueue()
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "You don't have access to this queue."
      )
    )
  })

  it.each([404, 409, 500])(
    "%s: a plain load failure, not decision copy",
    async (s) => {
      answer(s)
      renderQueue()
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toBe(
          "The queue couldn't be loaded. Try again."
        )
      )
    }
  )
})

describe("queueHref", () => {
  it("preserves category and all filters through pagination", () => {
    expect(
      queueHref({
        ...BASE_STATE,
        category: "articles",
        queue: "knowledge",
        locale: "fr",
        q: "hours",
        page: 2,
      })
    ).toBe(
      "/moderation?category=articles&queue=knowledge&locale=fr&q=hours&page=2"
    )
  })
  const DRIVE = "drv1234567890123456789a"

  it("round-trips a drive filter into the URL", () => {
    expect(queueHref({ ...BASE_STATE, drive: DRIVE })).toBe(
      `/moderation?drive=${DRIVE}`
    )
  })

  it("the clear link drops drive and keeps the rest", () => {
    const filtered = { ...BASE_STATE, drive: DRIVE, queue: "index" as const }
    expect(queueHref({ ...filtered, drive: "" })).toBe(
      "/moderation?queue=index"
    )
  })

  it("omits drive when unset", () => {
    expect(queueHref(BASE_STATE)).toBe("/moderation")
  })
})

describe("ModerationQueue drive filter", () => {
  const DRIVE = "drv1234567890123456789a"
  const rowWithDrive = {
    documentId: "sub1",
    submissionType: "correction",
    queue: "index",
    status: "pending",
    locale: "en",
    summary: "A correction",
    targetSlug: "some-library",
    submittedByName: "A Contributor",
    createdAt: "2026-01-01T00:00:00.000Z",
    reviewedAt: null,
    drive: { documentId: DRIVE, slug: "my-drive", title: "My Drive" },
  }

  const answerList = (data: unknown[], total = data.length) =>
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("/stats")
        ? Response.json({ data: [] })
        : Response.json({
            data,
            meta: { page: 1, pageSize: 25, total },
          })
    )

  it("sends drive to the API and shows the apiQuery round trip", async () => {
    answerList([rowWithDrive])
    renderQueue({ drive: DRIVE })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const listCall = fetchMock.mock.calls.find(
      ([url]) => !String(url).includes("/stats")
    )
    const url = new URL(String(listCall?.[0]), "http://localhost")
    expect(url.searchParams.get("drive")).toBe(DRIVE)
  })

  it("shows the row's drive chip, linking to the drive page", async () => {
    answerList([rowWithDrive])
    renderQueue({ drive: DRIVE })
    await waitFor(() =>
      expect(screen.getByText("Drive: My Drive")).toBeTruthy()
    )
    const chipLink = screen.getByText("Drive: My Drive").closest("a")
    expect(chipLink?.getAttribute("href")).toBe("/community/drives/my-drive")
  })

  it("shows 'Filtered by drive <title>' with a working Clear link", async () => {
    answerList([rowWithDrive])
    renderQueue({ drive: DRIVE })
    await waitFor(() =>
      expect(screen.getByText(/Filtered by drive My Drive/)).toBeTruthy()
    )
    const clear = screen.getByRole("link", { name: "Clear" })
    expect(clear.getAttribute("href")).toBe("/moderation")
  })

  it("shows an untitled banner when the filtered page has no matching rows", async () => {
    answerList([], 0)
    renderQueue({ drive: DRIVE })
    await waitFor(() => {
      const banner = screen.getByText(/Filtered by drive/)
      expect(banner.textContent).not.toMatch(/My Drive/)
    })
  })

  it("shows no banner or chip without a drive filter", async () => {
    answerList([{ ...rowWithDrive, drive: null }])
    renderQueue()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText(/Filtered by drive/)).toBeNull()
    expect(screen.queryByText(/Drive:/)).toBeNull()
  })
})

it("hides real private moderation rows immediately after account or moderation scope changes", async () => {
  actor.user = {
    id: "moderator-a",
    moderationScopes: [{ queue: "all", locale: null }],
  }
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/stats")
      ? Response.json({ data: [] })
      : Response.json({
          data: [
            {
              documentId: "private-submission",
              submissionType: "blog_submission",
              queue: "journal",
              status: "pending",
              locale: "en",
              summary: "Private proposal A",
              targetLabel: "Private proposal A",
              submittedByName: "Writer A",
              createdAt: "2026-10-16T10:00:00Z",
            },
          ],
          meta: { page: 1, pageSize: 25, total: 1 },
        })
  )
  const originalScope = contributionAccountScope(actor.user)
  const queue = createElement(ModerationQueue, {
    state: BASE_STATE,
    queues: ["journal"],
    locales: [],
    localeNames: {},
  })
  const view = render(
    createElement(ContributionAccountGuard, {
      expectedScope: originalScope,
      children: queue,
    })
  )
  await screen.findAllByText("Private proposal A")
  actor.user = {
    id: "moderator-b",
    moderationScopes: [{ queue: "all", locale: null }],
  }
  view.rerender(
    createElement(ContributionAccountGuard, {
      expectedScope: originalScope,
      children: queue,
    })
  )
  expect(screen.queryAllByText("Private proposal A")).toHaveLength(0)
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/stats")
      ? Response.json({ data: [] })
      : Response.json({
          data: [
            {
              documentId: "private-b",
              submissionType: "blog_submission",
              queue: "journal",
              status: "pending",
              locale: "en",
              summary: "Private proposal B",
              targetLabel: "Private proposal B",
              submittedByName: "Writer B",
              createdAt: "2026-10-16T10:00:00Z",
            },
          ],
          meta: { page: 1, pageSize: 25, total: 1 },
        })
  )
  view.rerender(
    createElement(ContributionAccountGuard, {
      expectedScope: contributionAccountScope(actor.user),
      children: queue,
    })
  )
  expect(screen.queryAllByText("Private proposal A")).toHaveLength(0)
  await screen.findAllByText("Private proposal B")
  actor.user = { id: "moderator-b", moderationScopes: [] }
  view.rerender(
    createElement(ContributionAccountGuard, {
      expectedScope: contributionAccountScope({
        id: "moderator-b",
        moderationScopes: [{ queue: "all", locale: null }],
      }),
      children: queue,
    })
  )
  expect(screen.queryAllByText("Private proposal A")).toHaveLength(0)
  expect(screen.queryAllByText("Private proposal B")).toHaveLength(0)
  expect(screen.getByText(/account or permissions changed/)).toBeTruthy()
})
