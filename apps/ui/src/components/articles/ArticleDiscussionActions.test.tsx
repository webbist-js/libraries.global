// @vitest-environment happy-dom
import type { ComponentProps, ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { AttachedDiscussion } from "@/components/discussions/AttachedDiscussion"
import type { DiscussionComposerDrawer } from "@/components/discussions/DiscussionComposerDrawer"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { ArticleReaderActions } from "./ArticleReaderActions"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: null, isPending: false }),
  useCapabilities: () => ({ ready: true, canDirectEdit: () => false }),
}))
vi.mock("@/lib/use-journal-ownership", () => ({
  useJournalOwnership: () => ({ isOwner: false }),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock(
  "@/app/[locale]/profile/[username]/_components/ProfileFollowButton",
  () => ({ ProfileFollowButton: () => null })
)
const actor = {
  ready: true,
  signedIn: true,
  canModerate: false,
  scope: "reader",
}
vi.mock("@/components/discussions/useDiscussionActor", () => ({
  useDiscussionActor: () => actor,
}))
vi.mock("@/components/discussions/DiscussionThread", () => ({
  DiscussionThread: () => <p>Existing conversation</p>,
}))
vi.mock("@/components/discussions/DiscussionComposerDrawer", () => ({
  DiscussionComposerDrawer: ({
    open,
    onClose,
    language,
    target,
  }: ComponentProps<typeof DiscussionComposerDrawer>) =>
    open ? (
      <div role="dialog">
        {target?.documentId}:{language}
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}))
const fetcher = vi.fn()
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  window.location.hash = ""
})
function mount(kind: "journal" | "knowledge" = "journal") {
  vi.stubGlobal("fetch", fetcher)

  return render(
    <>
      <ArticleReaderActions
        kind={kind}
        slug="story"
        path="/journal/story"
        contentLocale="es"
        interfaceLocale="en"
      />
      <div id="article-discussion">
        <AttachedDiscussion
          presentation="article"
          target={{
            uid:
              kind === "journal"
                ? "api::blog-article.blog-article"
                : "api::wiki-article.wiki-article",
            documentId: "article",
            locale: "es",
          }}
          subjectSlug={kind}
          title="Story"
          language="es"
        />
      </div>
    </>
  )
}
function respond(thread = false, own = false) {
  fetcher.mockImplementation(async (url: string) =>
    Response.json({
      data: url.includes("subjects")
        ? ["journal", "knowledge"].map((slug) => ({
            id: slug,
            slug,
            name: slug,
            visibility: "public",
            createPolicy: "members",
          }))
        : (url.includes("threads?") && thread) ||
            (url.includes("my/records?") && own)
          ? [
              {
                id: "comment",
                state: own ? "pending" : "visible",
                replyCount: 0,
              },
            ]
          : [],
    })
  )
}
function click(modified = false) {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    ctrlKey: modified,
  })
  fireEvent(screen.getByRole("link", { name: "Discuss" }), event)

  return event
}
it.each(["journal", "knowledge"] as const)(
  "opens and cancels the %s drawer for an empty discussion",
  async (kind) => {
    respond()
    mount(kind)
    await screen.findByRole("button", { name: "Start a discussion" })
    expect(click().defaultPrevented).toBe(true)
    expect(screen.getByRole("dialog").textContent).toContain("article:es")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(
      fetcher.mock.calls.every(
        ([, options]) => !options?.method || options.method === "GET"
      )
    ).toBe(true)
  }
)
it.each([false, true])(
  "keeps the conversation link for a comment, including own pending work (%s)",
  async (own) => {
    respond(!own, own)
    mount()
    await screen.findByText("Existing conversation")
    expect(click().defaultPrevented).toBe(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  }
)
it.each([false, true])(
  "waits for the existing lookup before choosing the action (%s)",
  async (thread) => {
    let finish!: () => void
    const waiting = new Promise<void>((resolve) => {
      finish = resolve
    })
    respond(thread)
    const response = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (...args) => {
      await waiting

      return response(...args)
    })
    mount()
    expect(click().defaultPrevented).toBe(true)
    expect(screen.queryByRole("dialog")).toBeNull()
    finish()
    await waitFor(() =>
      thread
        ? expect(window.location.hash).toBe("#article-discussion")
        : expect(screen.getByRole("dialog")).toBeTruthy()
    )
  }
)
it("preserves modified clicks", async () => {
  respond()
  mount()
  await screen.findByRole("button", { name: "Start a discussion" })
  expect(click(true).defaultPrevented).toBe(false)
  expect(screen.queryByRole("dialog")).toBeNull()
})
it("does not treat a failed lookup as an empty discussion", async () => {
  fetcher.mockRejectedValue(new Error("Unavailable"))
  mount()
  await screen.findByRole("alert")
  expect(click().defaultPrevented).toBe(false)
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("shows the lookup error after a queued click without opening a composer", async () => {
  let fail!: (reason: Error) => void
  const waiting = new Promise((_, reject) => {
    fail = reject
  })
  fetcher.mockImplementation(() => waiting)
  mount()
  expect(click().defaultPrevented).toBe(true)
  await waitFor(() => expect(fail).toBeDefined())
  fail(new Error("Unavailable"))
  await screen.findByRole("alert")
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(window.location.hash).toBe("#article-discussion")
})
