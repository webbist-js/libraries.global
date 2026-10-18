// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen, within } from "@/test/render"

import type { DiscussionContextLink, DiscussionRecord } from "./api"
import { DiscussionThreadSidebar } from "./DiscussionThreadSidebar"
import type { useThreadModeration } from "./useThreadModeration"

Object.assign(globalThis, { React })
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden="true" /> }))
afterEach(cleanup)

const thread: DiscussionRecord = {
  id: "thread",
  subjectId: "subject",
  title: "Large-print collection",
  body: "Public opening",
  state: "visible",
  version: 1,
  language: "en",
  reactions: { like: 0, love: 0 },
  myReaction: null,
  attachments: [],
  author: { name: "Amira", badges: ["suggested_this"] },
  target: {
    title: "Large-print collection",
    url: "/community/suggestions?idea=large-print",
  },
}
const context = (
  id: string,
  extra: Partial<DiscussionContextLink> = {}
): DiscussionContextLink => ({
  id,
  threadId: "thread",
  title: "Large-print collection",
  url: "/community/suggestions?idea=large-print",
  target: {
    uid: "plugin::content-moderation.option-suggestion",
    documentId: "idea",
  },
  featured: false,
  state: "visible",
  version: 1,
  canManage: true,
  public: true,
  ...extra,
})
const moderation = (
  extra: Partial<ReturnType<typeof useThreadModeration>> = {}
): ReturnType<typeof useThreadModeration> => ({
  revisions: [],
  audit: [
    {
      id: "audit",
      recordType: "thread",
      recordId: "thread",
      action: "approved",
      createdAt: "2026-10-17T12:00:00Z",
      actor: { name: "Alex", badges: ["moderator"] },
    },
  ],
  total: 1,
  globalTotal: 5,
  loading: false,
  error: null,
  nextOffset: null,
  reload: vi.fn(async () => {}),
  loadMore: vi.fn(async () => {}),
  ...extra,
})

describe("discussion sidebar", () => {
  it("uses the scoped count with correct singular copy and hides the queue when nothing is waiting", () => {
    const view = render(
      <DiscussionThreadSidebar
        thread={thread}
        related={[]}
        moderation={moderation()}
      />
    )
    const queue = within(screen.getByRole("region", { name: "Review queue" }))
    expect(queue.getByText("1")).toBeTruthy()
    expect(queue.getByText("message waiting in this conversation")).toBeTruthy()
    expect(queue.getByText("5 across all conversations")).toBeTruthy()
    view.rerender(
      <DiscussionThreadSidebar
        thread={thread}
        related={[]}
        moderation={moderation({ total: 0, globalTotal: 0 })}
      />
    )
    expect(screen.queryByRole("region", { name: "Review queue" })).toBeNull()
    expect(screen.getByRole("region", { name: "Moderation log" })).toBeTruthy()
  })

  it("uses the global count when this conversation has no pending messages", () => {
    render(
      <DiscussionThreadSidebar
        thread={thread}
        related={[]}
        moderation={moderation({ total: 0 })}
      />
    )
    const queue = within(screen.getByRole("region", { name: "Review queue" }))
    expect(queue.getByText("5")).toBeTruthy()
    expect(
      queue.getByText("messages waiting across all conversations")
    ).toBeTruthy()
  })

  it("groups the primary attachment once and preserves its management controls", () => {
    render(
      <DiscussionThreadSidebar
        thread={{
          ...thread,
          contexts: [
            context("primary"),
            context("library", {
              title: "Harbour Library",
              url: "/libraries/harbour",
            }),
          ],
        }}
        related={[]}
        onContextChanged={vi.fn()}
      />
    )
    const about = within(screen.getByRole("region", { name: "About" }))
    expect(about.getAllByText("Large-print collection")).toHaveLength(1)
    expect(
      about.getByRole("link", { name: "Visit the page" }).getAttribute("href")
    ).toBe(thread.target!.url)
    expect(about.getByRole("link", { name: "Harbour Library" })).toBeTruthy()
    expect(about.getAllByRole("button", { name: "Unlink" })).toHaveLength(2)
  })

  it("removes private moderator details and management actions in member preview", () => {
    render(
      <DiscussionThreadSidebar
        thread={{
          ...thread,
          contexts: [
            context("primary"),
            context("private", {
              title: "Private project",
              url: "/community/drives/private",
              public: false,
            }),
          ],
        }}
        related={[]}
        moderation={moderation()}
        onContextChanged={vi.fn()}
        memberPreview
      />
    )
    expect(screen.queryByRole("region", { name: "Review queue" })).toBeNull()
    expect(screen.queryByRole("region", { name: "Moderation log" })).toBeNull()
    expect(screen.queryByText("Private project")).toBeNull()
    expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull()
    expect(screen.getByText("Suggested this")).toBeTruthy()
  })

  it("shows unsafe context URLs as plain text and honours the private thread gate", () => {
    const view = render(
      <DiscussionThreadSidebar
        thread={{
          ...thread,
          contexts: [
            context("unsafe", {
              title: "Unsafe URL",
              url: "data:text/plain,unsafe",
              canManage: false,
            }),
          ],
        }}
        related={[]}
      />
    )
    expect(screen.getByText("Unsafe URL")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Unsafe URL" })).toBeNull()
    view.rerender(
      <DiscussionThreadSidebar
        thread={thread}
        related={[]}
        moderation={moderation()}
        hideMemberContext
      />
    )
    expect(screen.queryByRole("complementary")).toBeNull()
  })
})
