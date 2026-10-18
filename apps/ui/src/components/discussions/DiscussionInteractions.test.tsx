// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CompositionPreferences } from "@/lib/composition-language"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import type { DiscussionRecord } from "./api"
import { AttachedDiscussion } from "./AttachedDiscussion"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionModeration } from "./DiscussionModeration"
import { DiscussionAvatar } from "./DiscussionPresentation"
import { DiscussionRecordCard } from "./DiscussionRecordCard"
import { DiscussionsBoard } from "./DiscussionsBoard"
import { DiscussionThread } from "./DiscussionThread"

Object.assign(globalThis, { React })
const actor = vi.hoisted(() => ({
  signedIn: true,
  ready: true,
  canModerate: false,
  scope: "writer",
  compositionPreferences: undefined as CompositionPreferences | undefined,
}))

vi.mock("@/components/ds/SelectField", () => ({
  SelectField: ({
    value,
    onValueChange,
    options,
    label,
    name,
    disabled,
  }: {
    value: string
    onValueChange: (value: string) => void
    options: { value: string; label: string }[]
    label: string
    name?: string
    disabled?: boolean
  }) =>
    React.createElement(
      "select",
      {
        value,
        name,
        disabled,
        "aria-label": label,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      options.map((option) =>
        React.createElement(
          "option",
          { key: option.value, value: option.value },
          option.label
        )
      )
    ),
}))
vi.mock("./useDiscussionActor", () => ({ useDiscussionActor: () => actor }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/community/discussions",
  formatHref: (href: string) => href,
  isAppLink: () => true,
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden="true" /> }))
const record: DiscussionRecord = {
  id: "thread",
  subjectId: "subject",
  title: "Library visit",
  body: "Visible message",
  state: "visible",
  version: 3,
  language: "en",
  author: { name: "Author" },
  reactions: { like: 0, love: 0 },
  myReaction: null,
  attachments: [],
}
const fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  actor.signedIn = true
  actor.ready = true
  actor.canModerate = false
  actor.scope = "writer"
  actor.compositionPreferences = undefined
  window.history.replaceState(null, "", "/community/discussions")
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("discussion interactions", () => {
  it.each([
    {
      variant: "default" as const,
      threadId: "thread",
      returnTo: undefined,
      callback: "/community/discussions/thread",
    },
    {
      variant: "suggestion" as const,
      threadId: "thread",
      returnTo: "/community/suggestions?suggestion=idea#suggestion-idea",
      callback: "/community/suggestions?suggestion=idea#suggestion-idea",
    },
    {
      variant: "suggestion" as const,
      threadId: undefined,
      returnTo: "/fr/community/suggestions?suggestion=idea#suggestion-idea",
      callback: "/fr/community/suggestions?suggestion=idea#suggestion-idea",
    },
  ])(
    "offers sign-in to reply with the correct return location ($variant, $threadId)",
    ({ variant, threadId, returnTo, callback }) => {
      render(
        <DiscussionComposer
          variant={variant}
          threadId={threadId}
          returnTo={returnTo}
          signedIn={false}
          onSubmitted={vi.fn()}
          footerAction={<button type="button">Copy link</button>}
        />
      )
      expect(
        screen
          .getByRole("link", { name: "Sign in to reply" })
          .getAttribute("href")
      ).toBe("/auth/signin?callbackUrl=" + encodeURIComponent(callback))
      expect(screen.queryByRole("button", { name: "Post reply" })).toBeNull()
      expect(
        screen.queryByRole("button", { name: "Send for review" })
      ).toBeNull()
      expect(screen.queryByRole("textbox", { name: "Message" })).toBeNull()
      expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy()
      expect(fetch).not.toHaveBeenCalled()
    }
  )
  it.each(["suggestion", "conversation"] as const)(
    "shows attributed roles in the %s layout without granting moderation",
    (layout) => {
      const { rerender } = render(
        <DiscussionRecordCard
          record={{
            ...record,
            author: {
              name: "Author",
              badges: ["editorial_board", "suggested_this"],
            },
          }}
          kind="reply"
          own={false}
          signedIn
          layout={layout}
          onReload={async () => {}}
        />
      )
      expect(screen.getByText("Editorial board")).toBeTruthy()
      expect(screen.getByText("Suggested this")).toBeTruthy()
      expect(
        screen.queryByRole("button", { name: /Moderate|Restrict/i })
      ).toBeNull()
      rerender(
        <DiscussionRecordCard
          record={{
            ...record,
            author: { name: "Author", badges: ["editor", "moderator"] },
          }}
          kind="reply"
          own={false}
          signedIn
          layout={layout}
          onReload={async () => {}}
        />
      )
      expect(screen.getByText("Editor")).toBeTruthy()
      expect(screen.getByText("Moderator")).toBeTruthy()
      expect(screen.queryByText("Editorial board")).toBeNull()
      expect(
        screen.queryByRole("button", { name: /Moderate|Restrict/i })
      ).toBeNull()
      rerender(
        <DiscussionRecordCard
          record={{ ...record, author: { name: "Community member" } }}
          kind="reply"
          own={false}
          signedIn
          layout={layout}
          onReload={async () => {}}
        />
      )
      expect(screen.queryByText("Editorial board")).toBeNull()
      expect(screen.queryByText("Suggested this")).toBeNull()
      expect(screen.queryByText("Editor")).toBeNull()
      expect(screen.queryByText("Moderator")).toBeNull()
    }
  )
  it("shows recent suggestion messages, reveals older ones and keeps a submitted reply private", async () => {
    const replies = Array.from({ length: 5 }, (_, index) => ({
      ...record,
      id: `reply-${index}`,
      title: undefined,
      threadId: "thread",
      body: `Approved reply ${index}`,
      createdAt: `2026-10-${String(index + 1).padStart(2, "0")}T09:00:00Z`,
    }))
    let submitted = false
    fetch.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === "/api/discussions/threads/thread")
        return Response.json({
          ...record,
          replyCount: 5,
          lastReplyAt: replies[4]!.createdAt,
        })
      if (url.includes("/replies")) {
        if (options?.method === "POST") {
          submitted = true

          return Response.json({
            reply: { ...record, id: "private-reply", state: "pending" },
          })
        }
        const params = new URL(url, "http://localhost").searchParams
        const offset = Number(params.get("offset") ?? 0),
          limit = Number(params.get("limit") ?? 20)

        return Response.json({
          data: replies.slice(offset, offset + limit),
          total: 5,
        })
      }
      if (url.includes("my/records"))
        return Response.json({
          data:
            submitted && url.includes("kind=reply")
              ? [
                  {
                    ...record,
                    id: "private-reply",
                    threadId: "thread",
                    state: "pending",
                    body: "My private suggestion reply",
                  },
                ]
              : [],
        })

      return Response.json({ data: [] })
    })
    render(<DiscussionThread id="thread" embedded variant="suggestion" />)
    await screen.findByText("Approved reply 4")
    expect(screen.queryByText("Approved reply 0")).toBeNull()
    expect(screen.queryByText("Visible message")).toBeNull()
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).includes("offset=2&order=chronological")
      )
    ).toBe(true)
    fireEvent.click(
      screen.getByRole("button", { name: "Show 3 earlier replies" })
    )
    await screen.findByText("Approved reply 0")
    expect(screen.getByText("Visible message")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "My private suggestion reply" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }))
    await screen.findByText("My private suggestion reply")
    expect(
      screen.getByText("Only you and moderators can see this.")
    ).toBeTruthy()
  })
  const languages = [
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
  ]
  it("defaults both join and inline reply forms to the profile country without changing the thread language", async () => {
    actor.compositionPreferences = { country: "CO" }
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.includes("my/records") || url.includes("threads?")
          ? { data: [] }
          : url.includes("/replies")
            ? {
                data: [
                  {
                    ...record,
                    id: "parent",
                    threadId: "thread",
                    body: "Parent response",
                  },
                ],
              }
            : record
      )
    )
    render(<DiscussionThread id="thread" languages={languages} />)
    const parent = (await screen.findByText("Parent response")).closest(
      "article"
    )!
    const join = screen.getByRole("form", { name: "Join the conversation" })
    expect(
      (
        within(join).getByRole("combobox", {
          name: "Language",
        }) as HTMLSelectElement
      ).value
    ).toBe("es")
    fireEvent.click(within(parent).getByRole("button", { name: "Reply" }))
    const inline = screen.getByRole("form", { name: "Reply to Author" })
    expect(
      (
        within(inline).getByRole("combobox", {
          name: "Language",
        }) as HTMLSelectElement
      ).value
    ).toBe("es")
    fireEvent.change(within(join).getByRole("textbox", { name: "Message" }), {
      target: { value: "Una idea" },
    })
    fireEvent.click(
      within(join).getByRole("button", { name: "Send for review" })
    )
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([, init]) =>
            init?.method === "POST" && JSON.parse(init.body).language === "es"
        )
      ).toBe(true)
    )
  })

  it("applies a late profile default only while a composer is untouched, then preserves typed text and manual language", () => {
    const props = {
      subject: {
        id: "subject",
        slug: "library-life",
        name: "Library life",
        visibility: "public" as const,
        createPolicy: "members" as const,
      },
      languages,
      signedIn: true,
      onSubmitted: vi.fn(),
    }
    const view = render(<DiscussionComposer {...props} />)
    const control = () =>
      screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement
    expect(control().value).toBe("en")
    view.rerender(
      <DiscussionComposer
        {...props}
        compositionPreferences={{ country: "CO" }}
      />
    )
    expect(control().value).toBe("es")
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
      target: { value: "Mi mensaje" },
    })
    view.rerender(
      <DiscussionComposer
        {...props}
        compositionPreferences={{ country: "FR" }}
      />
    )
    expect(control().value).toBe("es")
    fireEvent.change(control(), { target: { value: "en" } })
    view.rerender(
      <DiscussionComposer
        {...props}
        compositionPreferences={{ country: "CO" }}
      />
    )
    expect(control().value).toBe("en")
    expect(
      (screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement)
        .value
    ).toBe("Mi mensaje")
  })

  it("restricts the country default to subject languages and keeps restored drafts explicit", () => {
    const subject = {
      id: "subject",
      slug: "library-life",
      name: "Library life",
      visibility: "public" as const,
      createPolicy: "members" as const,
      languages: ["fr"],
    }
    const props = {
      subject,
      languages,
      compositionPreferences: { country: "CO" },
      signedIn: true,
      onSubmitted: vi.fn(),
    }
    const view = render(<DiscussionComposer {...props} />)
    expect(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
        .value
    ).toBe("fr")
    expect(screen.queryByRole("option", { name: "Spanish" })).toBeNull()
    view.unmount()
    render(
      <DiscussionComposer
        {...props}
        subject={{ ...subject, languages: [] }}
        language="en"
        initialBody="Saved draft"
      />
    )
    expect(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
        .value
    ).toBe("en")
  })

  it("defaults new discussion composition to the profile while browsing all languages", async () => {
    actor.compositionPreferences = { country: "CO" }
    fetch.mockImplementation(async (url: string) =>
      Response.json({
        data: url.includes("subjects")
          ? [
              {
                id: "subject",
                slug: "library-life",
                name: "Library life",
                visibility: "public",
                createPolicy: "members",
              },
            ]
          : [],
      })
    )
    render(<DiscussionsBoard languages={languages} />)
    await screen.findAllByRole("button", { name: "Start a discussion" })
    fireEvent.click(
      screen.getAllByRole("button", { name: "Start a discussion" })[0]!
    )
    const dialog = await screen.findByRole("dialog")
    await waitFor(() =>
      expect(
        (
          within(dialog).getByRole("combobox", {
            name: "Language",
          }) as HTMLSelectElement
        ).value
      ).toBe("es")
    )
  })

  it("offers replies only on top-level responses even if a stale response grants a nested message reply permission", async () => {
    const parent = {
      ...record,
      id: "parent",
      title: undefined,
      body: "Top-level response",
      threadId: "thread",
    }
    const child = {
      ...record,
      id: "child",
      title: undefined,
      body: "Nested response",
      threadId: "thread",
      parentId: "parent",
      viewer: {
        canReply: true,
        canReact: true,
        canModerate: false,
        canSanction: false,
      },
    }
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.includes("my/records") || url.includes("threads?")
          ? { data: [] }
          : url.includes("/replies")
            ? { data: [parent, child] }
            : { ...record, replyCount: 2 }
      )
    )
    render(<DiscussionThread id="thread" />)
    const nested = (await screen.findByText("Nested response")).closest(
      "article"
    )!
    expect(within(nested).queryByRole("button", { name: "Reply" })).toBeNull()
    expect(within(nested).queryByRole("button", { name: "Quote" })).toBeNull()
    const firstOrder = screen
      .getByText("Top-level response")
      .closest("article")!
    expect(
      within(firstOrder).getByRole("button", { name: "Reply" })
    ).toBeTruthy()
    expect(
      screen.getByRole("form", { name: "Join the conversation" })
    ).toBeTruthy()
  })
  it("keeps the join form persistent with a separate inline draft and top-level submission", async () => {
    const publicReplies = [
      {
        ...record,
        id: "parent-a",
        title: undefined,
        threadId: "thread",
        body: "First parent",
        author: { name: "First author" },
        createdAt: "2026-10-17T09:00:00Z",
      },
      {
        ...record,
        id: "parent-b",
        title: undefined,
        threadId: "thread",
        body: "Second parent",
        author: { name: "Second author" },
        createdAt: "2026-10-17T10:00:00Z",
      },
    ]
    const own: DiscussionRecord[] = []
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const input = JSON.parse(String(init.body))
        own.push({
          ...record,
          id: input.parentId ? "pending-reply" : "pending-join",
          title: undefined,
          threadId: "thread",
          parentId: input.parentId,
          state: "pending",
          body: "",
          createdAt: "2026-10-17T11:00:00Z",
          pendingRevision: {
            id: "revision",
            body: input.body,
            baseVersion: 0,
            attachments: [],
          },
          viewer: {
            canReply: false,
            canReact: false,
            canModerate: false,
            canSanction: false,
          },
        })

        return Response.json({ reply: own.at(-1) })
      }
      if (url.includes("my/records"))
        return Response.json({ data: url.includes("kind=reply") ? own : [] })
      if (url.includes("/replies"))
        return Response.json(
          url.includes("offset=20")
            ? { data: [publicReplies[1]], nextOffset: null }
            : { data: [publicReplies[0]], nextOffset: 20 }
        )
      if (url.includes("threads?")) return Response.json({ data: [] })

      return Response.json({ ...record, replyCount: 2 })
    })
    const view = render(<DiscussionThread id="thread" />)
    await screen.findByText("First parent")
    fireEvent.click(screen.getByRole("button", { name: "Load more" }))
    await screen.findByText("Second parent")
    const joinForm = screen.getByRole("form", { name: "Join the conversation" })
    const joinMessage = within(joinForm).getByLabelText(
      "Message"
    ) as HTMLTextAreaElement
    fireEvent.change(joinMessage, {
      target: { value: "A separate thread-level draft" },
    })
    const first = screen.getByText("First parent").closest("article")!
    const second = screen.getByText("Second parent").closest("article")!
    fireEvent.click(within(first).getByRole("button", { name: "Reply" }))
    let inline = screen.getByRole("form", { name: "Reply to First author" })
    expect(first.parentElement!.contains(inline)).toBe(true)
    expect(screen.getByRole("form", { name: "Join the conversation" })).toBe(
      joinForm
    )
    expect(joinMessage.value).toBe("A separate thread-level draft")
    expect(
      (within(inline).getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("")
    fireEvent.change(within(inline).getByLabelText("Message"), {
      target: { value: "A private draft reply" },
    })
    fireEvent.click(within(second).getByRole("button", { name: "Reply" }))
    inline = screen.getByRole("form", { name: "Reply to Second author" })
    expect(second.parentElement!.contains(inline)).toBe(true)
    expect(
      (within(inline).getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("A private draft reply")
    expect(joinMessage.value).toBe("A separate thread-level draft")
    fireEvent.click(within(first).getByRole("button", { name: "Reply" }))
    inline = screen.getByRole("form", { name: "Reply to First author" })
    fireEvent.click(
      within(joinForm).getByRole("button", { name: "Send for review" })
    )
    await screen.findByText("A separate thread-level draft")
    const joinPost = fetch.mock.calls.find(
      ([, init]) => init?.method === "POST"
    )!
    expect(JSON.parse(joinPost[1].body)).not.toHaveProperty("parentId")
    expect(
      (
        within(
          screen.getByRole("form", { name: "Reply to First author" })
        ).getByLabelText("Message") as HTMLTextAreaElement
      ).value
    ).toBe("A private draft reply")
    expect(joinMessage.value).toBe("")
    fireEvent.click(
      within(inline).getByRole("button", { name: "Send for review" })
    )
    await screen.findByText("A private draft reply")
    expect(
      JSON.parse(
        fetch.mock.calls.filter(([, init]) => init?.method === "POST")[1]![1]
          .body
      ).parentId
    ).toBe("parent-a")
    expect(
      [
        ...view.container.querySelectorAll('article[id^="discussion-reply-"]'),
      ].map((node) => node.id)
    ).toEqual([
      "discussion-reply-parent-a",
      "discussion-reply-pending-reply",
      "discussion-reply-parent-b",
      "discussion-reply-pending-join",
    ])
    const pending = screen
      .getByText("A private draft reply")
      .closest("article")!
    expect(pending.className).toContain("border-dashed")
    expect(
      within(pending).getByText("Only you and moderators can see this.")
    ).toBeTruthy()
    expect(
      within(pending).getByRole("button", { name: "Edit your message" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("heading", { name: "Your pending text" })
    ).toBeNull()
    expect(screen.getByRole("heading", { name: "2 replies" })).toBeTruthy()
    expect(screen.getByRole("form", { name: "Join the conversation" })).toBe(
      joinForm
    )
    expect(joinMessage.value).toBe("")
    actor.signedIn = false
    actor.scope = "guest"
    fetch.mockImplementation(() => new Promise(() => {}))
    view.rerender(<DiscussionThread id="thread" />)
    expect(screen.queryByText("A private draft reply")).toBeNull()
    expect(screen.queryByText("A separate thread-level draft")).toBeNull()
  })
  it("places the moderator menu last and marks restriction as a destructive moderator action", async () => {
    const props = {
      record,
      kind: "reply" as const,
      own: false,
      signedIn: true,
      onReload: vi.fn(),
      onReply: vi.fn(),
      onQuote: vi.fn(),
    }
    const view = render(<DiscussionRecordCard {...props} canSanction />)
    const button = screen.getByRole("button", { name: "Moderate" })
    expect(button.getAttribute("title")).toBe("Moderator action")
    expect(button.querySelector("svg")).toBeTruthy()
    expect(screen.getAllByRole("button").at(-1)).toBe(button)
    fireEvent.keyDown(button, { key: "ArrowDown" })
    const restriction = await screen.findByRole("menuitem", {
      name: "Restrict this participant",
    })
    expect(restriction.dataset.variant).toBe("destructive")
    view.rerender(<DiscussionRecordCard {...props} canSanction={false} />)
    expect(screen.queryByRole("button", { name: "Moderate" })).toBeNull()
  })
  it("shows thread context, participants, related conversations and post permalinks", async () => {
    const subject = {
      id: "subject",
      slug: "library-life",
      name: "Library life",
      visibility: "public",
      createPolicy: "members",
    }
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.includes("my/records") || url.includes("/replies")
          ? { data: [] }
          : url.includes("threads?")
            ? {
                data: [
                  {
                    ...record,
                    id: "other",
                    title: "Another conversation",
                    replyCount: 2,
                  },
                ],
              }
            : {
                ...record,
                subject,
                replyCount: 0,
                participantCount: 1,
                participants: [{ name: "Author", url: "/profile/author" }],
                target: {
                  title: "Harbour library",
                  url: "/europe/uk/edinburgh/harbour",
                  links: [
                    { label: "Read stories", url: "/journal?library=harbour" },
                  ],
                },
              }
      )
    )
    render(<DiscussionThread id="thread" />)
    expect(
      await screen.findByRole("heading", { name: "In this conversation" })
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Author" }).getAttribute("href")
    ).toBe("/profile/author")
    expect(
      screen
        .getByRole("link", { name: "Another conversation" })
        .getAttribute("href")
    ).toBe("/community/discussions/other")
    expect(
      screen.getByRole("link", { name: "Read stories" }).getAttribute("href")
    ).toBe("/journal?library=harbour")
    expect(
      screen.getByRole("link", { name: "Link to post 1" }).getAttribute("href")
    ).toBe("#discussion-thread-thread")
    expect(
      screen.getByRole("heading", { name: "Join the conversation" })
    ).toBeTruthy()
    expect(screen.getByText("0 / 20,000")).toBeTruthy()
  })
  it("opens the new discussion composer from the thread header link", async () => {
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.includes("subjects")
          ? {
              data: [
                {
                  id: "subject",
                  name: "Library life",
                  slug: "library-life",
                  visibility: "public",
                  createPolicy: "members",
                },
              ],
            }
          : { data: [] }
      )
    )
    render(<DiscussionsBoard initialSearch="compose=1" />)
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(await screen.findByLabelText("Discussion title")).toBeTruthy()
  })
  it("uses the local asset proxy for discussion avatars and falls back after an image error", () => {
    render(
      <DiscussionAvatar
        author={{
          name: "Alex Bennett",
          avatar: { url: "/uploads/avatar.png", alternativeText: "Alex" },
        }}
      />
    )
    const image = screen.getByRole("img", { hidden: true })
    expect(image.getAttribute("src")).toBe("/api/asset/uploads/avatar.png")
    fireEvent.error(image)
    expect(screen.getByText("AB")).toBeTruthy()
  })
  it("browses all languages by default with named configured language choices", async () => {
    fetch.mockImplementation(async (url: string) => {
      if (url.includes("my/records")) return Response.json({ data: [] })
      if (url.includes("subjects"))
        return Response.json({
          data: [
            {
              id: "subject",
              name: "Library life",
              slug: "library-life",
              visibility: "public",
              createPolicy: "members",
            },
          ],
        })
      const language = new URL(
        url,
        "https://libraries.global"
      ).searchParams.get("language")

      return Response.json({
        data: [
          { ...record, id: "english", title: "English story", language: "en" },
          { ...record, id: "spanish", title: "Spanish story", language: "es" },
        ].filter((item) => !language || item.language === language),
      })
    })
    render(
      <DiscussionsBoard
        languages={[
          { code: "en", name: "English" },
          { code: "es", name: "Spanish" },
        ]}
      />
    )
    await screen.findByText("English story")
    expect(screen.getByText("Spanish story")).toBeTruthy()
    const filter = screen.getByRole("combobox", {
      name: "Language",
    }) as HTMLSelectElement
    expect(filter.value).toBe("")
    expect(screen.getByRole("option", { name: "All languages" })).toBeTruthy()
    expect(screen.getByRole("option", { name: "Spanish" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Start a discussion" }))
    expect(
      (
        screen
          .getAllByRole("combobox", { name: "Language" })
          .find((element) => element.tagName === "SELECT") as HTMLInputElement
      ).value
    ).toBe("en")
    fireEvent.change(filter, { target: { value: "es" } })
    await waitFor(() => expect(screen.queryByText("English story")).toBeNull())
    await screen.findByText("Spanish story")
    expect(
      fetch.mock.calls.some(([url]) =>
        String(url).includes("threads?limit=20&language=es")
      )
    ).toBe(true)
  })

  it("creates a moderated attached thread with the content locale and no author input", async () => {
    fetch.mockResolvedValue(
      Response.json({
        thread: { ...record, state: "pending" },
        revision: { id: "revision" },
      })
    )
    render(
      <DiscussionComposer
        subject={{
          id: "subject",
          name: "Journal",
          slug: "journal",
          visibility: "public",
          createPolicy: "members",
        }}
        target={{
          uid: "api::blog-article.blog-article",
          documentId: "article",
          locale: "fr",
        }}
        language="fr"
        signedIn
        onSubmitted={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText("Discussion title"), {
      target: { value: "A library visit" },
    })
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "My experience" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await screen.findByText(/Sent for review/)
    expect(fetch.mock.calls[0]?.[0]).toBe("/api/discussions/threads")
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({
      subjectId: "subject",
      title: "A library visit",
      body: "My experience",
      language: "fr",
      target: {
        uid: "api::blog-article.blog-article",
        documentId: "article",
        locale: "fr",
      },
    })
  })

  it.each([
    "<script>bad()</script><img src=x onerror=bad()>",
    "<SCRIPT>bad()</SCRIPT><IMG SRC=x onerror=bad()>",
  ])("escapes bodies and never follows unsafe author links: %s", (body) => {
    const view = render(
      <DiscussionRecordCard
        record={{
          ...record,
          body,
          author: { name: "Author", url: "data:text/html,bad" },
        }}
        kind="thread"
        own={false}
        signedIn={false}
        onReload={vi.fn()}
      />
    )
    expect(view.container.querySelector("script, img, a")).toBeNull()
    expect(screen.getByText(body, { exact: true }).textContent).toBe(body)
    expect(
      screen.queryByRole("button", { name: "Edit your message" })
    ).toBeNull()
  })

  it("preserves the author's unsent text on a stale revision conflict", async () => {
    fetch.mockResolvedValue(
      Response.json({ error: "Conflict" }, { status: 409 })
    )
    const reload = vi.fn()
    render(
      <DiscussionRecordCard
        record={record}
        kind="thread"
        own
        signedIn
        onReload={reload}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Edit your message" }))
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Keep my unsent edit" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await screen.findByRole("alert")
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("Keep my unsent edit")
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body).baseVersion).toBe(3)
    expect(reload).not.toHaveBeenCalled()
  })

  it("sends report reasons only to the authenticated reports path", async () => {
    fetch.mockResolvedValue(Response.json({ state: "open" }))
    render(
      <DiscussionRecordCard
        record={record}
        kind="thread"
        own={false}
        signedIn
        onReload={vi.fn(async () => {})}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Report" }))
    fireEvent.change(screen.getByLabelText("Reason for reporting (private)"), {
      target: { value: "Private reason" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send report" }))
    await screen.findByText("Your report has been sent to the moderators.")
    expect(fetch.mock.calls[0]?.[0]).toBe(
      "/api/discussions/records/thread/thread/reports"
    )
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({
      reason: "Private reason",
    })
    expect(screen.queryByText("Private reason")).toBeNull()
  })

  it("prevents replies in a locked thread and uses explicit subscription writes", async () => {
    fetch.mockImplementation(async (url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "PUT"
          ? { enabled: true }
          : url.includes("my/records") || url.includes("/replies")
            ? { data: [] }
            : { ...record, locked: true, subscribed: false }
      )
    )
    render(<DiscussionThread id="thread" />)
    await screen.findByText("Visible message")
    expect(screen.queryByLabelText("Message")).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Follow this discussion" })
    )
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/discussions/threads/thread/subscription" &&
            init?.method === "PUT" &&
            JSON.parse(String(init.body)).enabled === true
        )
      ).toBe(true)
    )
  })

  it("does not expose a removed body even to a response containing its archived text", () => {
    render(
      <DiscussionRecordCard
        record={{ ...record, state: "removed", body: "Archived private text" }}
        kind="thread"
        own
        signedIn
        onReload={vi.fn()}
      />
    )
    expect(screen.queryByText("Archived private text")).toBeNull()
    expect(screen.getByText("This message has been removed.")).toBeTruthy()
  })

  it("hides moderation data for actors without authority", () => {
    render(<DiscussionModeration />)
    expect(
      screen.getByText("You do not have permission for this action.")
    ).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps queue controls available when a decision refresh supersedes pagination", async () => {
    actor.canModerate = true
    let accepted = false
    let finishPage!: (response: Response) => void
    const oldPage = new Promise<Response>((resolve) => {
      finishPage = resolve
    })
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        accepted = true

        return Response.json({})
      }
      if (url.includes("offset=20")) return oldPage

      return Response.json({
        data:
          url.includes("/revisions") && !accepted
            ? [
                {
                  id: "revision",
                  recordType: "thread",
                  recordId: "thread",
                  threadId: "thread",
                  canReview: true,
                  body: "Review before paginating",
                  baseVersion: 1,
                  currentVersion: 1,
                  attachments: [],
                },
              ]
            : [],
        nextOffset: url.includes("/revisions") && !accepted ? 20 : null,
      })
    })
    render(<DiscussionModeration />)
    await screen.findByText("Review before paginating")
    fireEvent.click(screen.getByRole("button", { name: "Load more" }))
    fireEvent.click(screen.getByRole("button", { name: "Accept and publish" }))
    await waitFor(() =>
      expect(screen.queryByText("Review before paginating")).toBeNull()
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Refresh queue",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
    finishPage(Response.json({ data: [] }))
  })

  it("keeps report drafts when changing review views and clears private queues after a refused refresh", async () => {
    actor.canModerate = true
    let refused = false
    fetch.mockImplementation(async (url: string) => {
      if (refused) return Response.json({ error: "Forbidden" }, { status: 403 })

      return Response.json({
        data: url.includes("/revisions")
          ? [
              {
                id: "proposal",
                recordType: "thread",
                recordId: "thread",
                threadId: "thread",
                canReview: true,
                title: "Private proposal",
                body: "Private proposed wording",
                baseVersion: 1,
                currentVersion: 1,
                attachments: [],
              },
            ]
          : url.includes("/reports")
            ? [
                {
                  id: "report",
                  recordType: "reply",
                  recordId: "reply",
                  threadId: "thread",
                  reason: "Private reported reason",
                  version: 1,
                  recordVersion: 1,
                  currentVersion: 2,
                  currentState: "visible",
                  reportedBody: "Reported wording",
                  currentBody: "Current wording",
                  reportedAttachments: [],
                  currentAttachments: [],
                },
              ]
            : [],
        total: url.includes("/revisions") || url.includes("/reports") ? 1 : 0,
      })
    })
    render(<DiscussionModeration />)
    await screen.findByText("Private proposed wording")
    fireEvent.click(screen.getByRole("button", { name: /Reported messages/ }))
    fireEvent.click(screen.getByRole("button", { name: "Remove message" }))
    fireEvent.change(
      screen.getByLabelText("Feedback to the author (shared with them)"),
      { target: { value: "Please remove the promotion." } }
    )
    fireEvent.click(screen.getByRole("button", { name: /Waiting for review/ }))
    fireEvent.click(screen.getByRole("button", { name: /Reported messages/ }))
    expect(
      (
        screen.getByLabelText(
          "Feedback to the author (shared with them)"
        ) as HTMLTextAreaElement
      ).value
    ).toBe("Please remove the promotion.")
    refused = true
    fireEvent.click(screen.getByRole("button", { name: "Refresh queue" }))
    await screen.findByRole("alert")
    expect(screen.queryByText("Private proposed wording")).toBeNull()
    expect(screen.queryByText("Private reported reason")).toBeNull()
    expect(screen.queryByText("Please remove the promotion.")).toBeNull()
    expect(screen.queryByRole("button", { name: "Confirm removal" })).toBeNull()
  })

  it.each([true, false])(
    "shows actual per-language automatic word-filter coverage: %s",
    async (covered) => {
      actor.canModerate = true
      fetch.mockImplementation(async (url: string) =>
        Response.json({
          data: url.includes("moderation/revisions")
            ? [
                {
                  id: "revision",
                  canReview: true,
                  recordType: "thread",
                  recordId: "thread",
                  threadId: "thread",
                  title: "Proposal",
                  body: "Review the original wording",
                  baseVersion: 0,
                  currentVersion: 0,
                  attachments: [],
                  contentFlags: { language: "es", covered, terms: [] },
                },
              ]
            : [],
        })
      )
      render(<DiscussionModeration />)
      fireEvent.click(
        await screen.findByRole("button", { name: "Review checks and notes" })
      )
      await screen.findByText(
        covered
          ? "Automatic word-filter rules are configured for Spanish. Read the full message before accepting."
          : "No automatic word-filter rules are configured for Spanish. Review the original wording before accepting."
      )
      expect(screen.queryByText(/Words flagged for review/)).toBeNull()
    }
  )

  it("reviews an accessible immutable proposal with the pinned version", async () => {
    actor.canModerate = true
    fetch.mockImplementation(async (url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "PUT"
          ? { state: "approved" }
          : {
              data: url.includes("/revisions")
                ? [
                    {
                      id: "revision",
                      canReview: true,
                      recordType: "thread",
                      recordId: "thread",
                      threadId: "thread",
                      title: "Proposed title",
                      body: "Proposed text body",
                      previousBody: "Old text",
                      baseVersion: 3,
                      currentVersion: 3,
                    },
                  ]
                : [],
            }
      )
    )
    render(<DiscussionModeration />)
    await screen.findByText("Proposed text body")
    fireEvent.click(screen.getByRole("button", { name: "Accept and publish" }))
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/discussions/moderation/revisions/revision" &&
            init?.method === "PUT" &&
            JSON.parse(String(init.body)).baseVersion === 3
        )
      ).toBe(true)
    )
  })
})

describe("discussion recovery isolation", () => {
  it.each([404, 500, "network"])(
    "offers attached lookup retry only for a transient failure (%s)",
    async (failure) => {
      let failed = false
      fetch.mockImplementation(async (url: string) => {
        if (
          url.includes("my/records") &&
          url.includes("targetId=article") &&
          !failed
        ) {
          failed = true
          if (failure === "network") throw new TypeError("Network unavailable")

          return Response.json(
            { error: "Lookup failed" },
            { status: failure as number }
          )
        }
        if (url.includes("subjects"))
          return Response.json({
            data: [
              {
                id: "subject",
                name: "Journal",
                slug: "journal",
                visibility: "public",
                createPolicy: "members",
              },
            ],
          })

        return Response.json({ data: [] })
      })
      render(
        <AttachedDiscussion
          target={{
            uid: "api::blog-article.blog-article",
            documentId: "article",
            locale: "es",
          }}
          subjectSlug="journal"
          title="Artículo"
          language="es"
        />
      )
      await screen.findByRole("alert")
      if (failure === 404) {
        expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
        expect(screen.queryByLabelText("Discussion title")).toBeNull()

        return
      }
      fireEvent.click(screen.getByRole("button", { name: "Retry" }))
      await screen.findByLabelText("Discussion title")
      expect(screen.queryByRole("alert")).toBeNull()
    }
  )

  it.each(["es", undefined])(
    "recovers a different-language pending thread for a Spanish-only article in the English interface (target locale %s)",
    async (targetLocale) => {
      const pending = {
        ...record,
        state: "pending",
        language: "fr",
        body: "",
        pendingRevision: {
          id: "revision",
          title: "Discussion en français",
          body: "Mon brouillon sur cet article espagnol",
          baseVersion: 0,
        },
      }
      fetch.mockImplementation(async (url: string) => {
        const query = new URL(url, "https://libraries.global").searchParams
        if (url.includes("my/records") && query.has("targetId")) {
          if (query.get("targetLocale") !== "es")
            return Response.json({ error: "Not found" }, { status: 404 })

          return Response.json({
            data: query.has("language") ? [] : [pending],
          })
        }
        if (url.includes("my/records") && query.get("recordId") === "thread")
          return Response.json({ data: [pending] })
        if (url === "/api/discussions/threads/thread")
          return Response.json({ ...pending, pendingRevision: undefined })
        if (url.includes("subjects"))
          return Response.json({
            data: [
              {
                id: "subject",
                name: "Journal",
                slug: "journal",
                visibility: "public",
                createPolicy: "members",
              },
            ],
          })

        return Response.json({ data: [] })
      })
      render(
        <AttachedDiscussion
          target={{
            uid: "api::blog-article.blog-article",
            documentId: "spanish-only-article",
            locale: targetLocale,
          }}
          subjectSlug="journal"
          title="Un artículo español"
          language="es"
        />
      )
      await screen.findByText("Mon brouillon sur cet article espagnol")
      expect(screen.getByText("Discuss this article")).toBeTruthy()
      expect(screen.queryByLabelText("Discussion title")).toBeNull()
      const request = fetch.mock.calls.find(
        ([url]) =>
          String(url).includes("targetId=spanish-only-article") &&
          String(url).includes("my/records")
      )
      const query = new URL(String(request?.[0]), "https://libraries.global")
        .searchParams
      expect(query.get("targetLocale")).toBe("es")
      expect(query.has("language")).toBe(false)
    }
  )

  it("hides private thread and attached recovery text immediately when readiness changes in the same actor scope", async () => {
    fetch.mockImplementation(async (url: string) => {
      if (url.includes("subjects"))
        return Response.json({
          data: [
            {
              id: "subject",
              name: "Journal",
              slug: "journal",
              visibility: "public",
              createPolicy: "members",
            },
          ],
        })
      if (url === "/api/discussions/threads/thread")
        return Response.json({ ...record, state: "pending", body: "" })
      if (url.includes("my/records") && url.includes("kind=thread"))
        return Response.json({
          data: [
            {
              ...record,
              state: "pending",
              body: "",
              pendingRevision: {
                id: "revision",
                title: "Private proposal",
                body: "Only the owner can recover this text",
                baseVersion: 0,
              },
            },
          ],
        })

      return Response.json({ data: [] })
    })
    const view = render(
      <AttachedDiscussion
        target={{
          uid: "api::blog-article.blog-article",
          documentId: "article",
          locale: "en",
        }}
        subjectSlug="journal"
        title="Story"
        language="en"
      />
    )
    await screen.findByText("Only the owner can recover this text")
    expect(screen.queryByLabelText("Message")).toBeNull()
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          String(url).includes("my/records?kind=thread") &&
          String(url).includes("targetId=article")
      )
    ).toBe(true)
    actor.ready = false
    actor.signedIn = false
    view.rerender(
      <AttachedDiscussion
        target={{
          uid: "api::blog-article.blog-article",
          documentId: "article",
          locale: "en",
        }}
        subjectSlug="journal"
        title="Story"
        language="en"
      />
    )
    expect(
      screen.queryByText("Only the owner can recover this text")
    ).toBeNull()
    expect(screen.queryByText("Private proposal")).toBeNull()
  })

  it("gates cached direct private thread text when only readiness changes", async () => {
    fetch.mockImplementation(async (url: string) =>
      url === "/api/discussions/threads/thread"
        ? Response.json({ ...record, state: "pending", body: "" })
        : Response.json({
            data: url.includes("kind=thread")
              ? [
                  {
                    ...record,
                    state: "pending",
                    pendingRevision: {
                      id: "revision",
                      body: "Private cached proposal",
                      baseVersion: 0,
                    },
                  },
                ]
              : [],
          })
    )
    const view = render(<DiscussionThread id="thread" />)
    await screen.findByText("Private cached proposal")
    actor.ready = false
    view.rerender(<DiscussionThread id="thread" />)
    expect(screen.queryByText("Private cached proposal")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Edit your message" })
    ).toBeNull()
  })

  it("retains composer text across subject changes and reflects filters in the shared URL", async () => {
    fetch.mockImplementation(async (url: string) =>
      Response.json({
        data: url.includes("subjects")
          ? [
              {
                id: "one",
                name: "Library life",
                slug: "library-life",
                visibility: "public",
                createPolicy: "members",
              },
              {
                id: "two",
                name: "Practice",
                slug: "practice",
                visibility: "public",
                createPolicy: "members",
              },
            ]
          : url.includes("my/records")
            ? []
            : [record],
      })
    )
    render(
      <DiscussionsBoard
        languages={[
          { code: "en", name: "English" },
          { code: "es", name: "Spanish" },
        ]}
      />
    )
    await screen.findByText("Library visit")
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "es" },
    })
    expect(new URLSearchParams(window.location.search).get("lang")).toBe("es")
    fireEvent.click(screen.getByRole("button", { name: "Start a discussion" }))
    fireEvent.change(screen.getByLabelText("Discussion title"), {
      target: { value: "Keep my draft title" },
    })
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Keep my unsent draft message" },
    })
    fireEvent.change(
      screen.getByRole("combobox", { name: "Subject for the new discussion" }),
      { target: { value: "two" } }
    )
    expect(
      (screen.getByLabelText("Discussion title") as HTMLInputElement).value
    ).toBe("Keep my draft title")
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("Keep my unsent draft message")
    expect(document.querySelector('option[value="es"]')).toBeTruthy()
  })

  it("shows immutable report evidence and pins removal to the current record version after deliberate confirmation", async () => {
    actor.canModerate = true
    const report = {
      id: "report",
      recordType: "thread",
      recordId: "thread",
      threadId: "thread",
      reason: "Private reporter reason",
      version: 0,
      recordVersion: 6,
      currentVersion: 7,
      reportedBody: "Original reported evidence",
      currentBody: "Current edited message",
    }
    let decided = false
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        decided = true

        return Response.json({ state: "actioned" })
      }

      return Response.json({
        data: !decided && url.includes("reports") ? [report] : [],
      })
    })
    render(<DiscussionModeration />)
    await screen.findByText("Original reported evidence")
    expect(screen.getByText("Current edited message")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Remove message" }))
    expect(fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
      false
    )
    fireEvent.change(
      screen.getByLabelText("Feedback to the author (shared with them)"),
      { target: { value: "This message contains personal information." } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Confirm removal" }))
    await waitFor(() =>
      expect(fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
        true
      )
    )
    const request = fetch.mock.calls.find(([, init]) => init?.method === "PUT")!
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      decision: "remove",
      baseVersion: 0,
      recordBaseVersion: 7,
      contributorFeedback: "This message contains personal information.",
    })
  })

  it("toggles the single subscription control and reactions from refreshed server state", async () => {
    let subscribed = false
    let myReaction: "like" | null = null
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const input = JSON.parse(String(init.body))
        if (url.includes("subscription")) subscribed = input.enabled
        else myReaction = input.reaction

        return Response.json({})
      }

      return Response.json(
        url.includes("my/records") || url.includes("replies")
          ? { data: [] }
          : {
              ...record,
              subscribed,
              reactions: { like: myReaction ? 1 : 0, love: 0 },
              myReaction,
            }
      )
    })
    render(<DiscussionThread id="thread" />)
    await screen.findByRole("button", { name: "Follow this discussion" })
    fireEvent.click(
      screen.getByRole("button", { name: "Follow this discussion" })
    )
    await screen.findByRole("button", { name: "Unfollow this discussion" })
    expect(
      screen.queryByRole("button", { name: "Follow this discussion" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Like 0" }))
    await screen.findByRole("button", { name: "Like 1" })
    expect(
      screen
        .getByRole("button", { name: "Like 1" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Like 1" }))
    await screen.findByRole("button", { name: "Like 0" })
    expect(
      fetch.mock.calls
        .filter(
          ([url, init]) =>
            String(url).includes("reaction") && init?.method === "PUT"
        )
        .map(([, init]) => JSON.parse(String(init?.body)).reaction)
    ).toEqual(["like", null])
  })

  it("stages an image privately and sends only its owned descriptor with the moderated message", async () => {
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.endsWith("/attachments")
          ? {
              id: "image",
              altText: "Reading room",
              caption: "Workshop",
              width: 800,
              height: 600,
              mime: "image/webp",
            }
          : { thread: { ...record, state: "pending" } }
      )
    )
    render(
      <DiscussionComposer
        subject={{
          id: "subject",
          name: "Library life",
          slug: "library-life",
          visibility: "public",
          createPolicy: "members",
        }}
        signedIn
        onSubmitted={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText("Discussion title"), {
      target: { value: "A library visit" },
    })
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "We attended the workshop." },
    })
    fireEvent.click(screen.getByText("Add pictures"))
    fireEvent.change(screen.getByLabelText("Picture file"), {
      target: {
        files: [new File(["photo"], "photo.png", { type: "image/png" })],
      },
    })
    fireEvent.change(
      screen.getByLabelText(
        "Describe the picture for people who cannot see it"
      ),
      { target: { value: "Reading room" } }
    )
    fireEvent.change(screen.getByLabelText("Caption (optional)"), {
      target: { value: "Workshop" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Upload privately" }))
    await screen.findByAltText("Reading room")
    expect(screen.getByAltText("Reading room").getAttribute("src")).toBe(
      "/api/discussions/attachments/image"
    )
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await screen.findByText(/Sent for review/)
    const post = fetch.mock.calls.find(
      ([url]) => url === "/api/discussions/threads"
    )!
    expect(JSON.parse(post[1].body).attachments).toEqual([
      { id: "image", altText: "Reading room", caption: "Workshop" },
    ])
    expect(
      fetch.mock.calls.some(([url]) => String(url).includes("/api/upload"))
    ).toBe(false)
  })

  it("respects server reply/react/moderate permissions instead of global role hints", async () => {
    actor.canModerate = true
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.includes("my/records") || url.includes("replies")
          ? { data: [] }
          : {
              ...record,
              reactions: { like: 0, love: 0 },
              viewer: {
                canReply: false,
                canReact: false,
                canModerate: false,
                canSanction: false,
              },
            }
      )
    )
    render(<DiscussionThread id="thread" />)
    await screen.findByText("Visible message")
    expect(screen.queryByLabelText("Message")).toBeNull()
    expect(
      (screen.getByRole("button", { name: "Like 0" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(screen.queryByRole("button", { name: "Remove message" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Restrict this participant" })
    ).toBeNull()
  })

  it("uses a structured quote reference and withholds unavailable quoted evidence", async () => {
    const onSubmitted = vi.fn()
    fetch.mockResolvedValue(
      Response.json({ reply: { ...record, id: "reply", state: "pending" } })
    )
    render(
      <DiscussionComposer
        threadId="thread"
        signedIn
        language="en"
        quote={{ kind: "reply", id: "source", version: 4 }}
        onSubmitted={onSubmitted}
      />
    )
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "I agree with this experience." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body).quote).toEqual({
      kind: "reply",
      id: "source",
      version: 4,
    })
    cleanup()
    render(
      <DiscussionRecordCard
        record={{
          ...record,
          quote: {
            kind: "reply",
            id: "source",
            version: 4,
            available: false,
            excerpt: "Removed copied private text",
          },
        }}
        kind="thread"
        own={false}
        signedIn={false}
        onReload={vi.fn()}
      />
    )
    expect(screen.queryByText("Removed copied private text")).toBeNull()
    expect(
      screen.getByText("This quoted message is no longer available.")
    ).toBeTruthy()
  })
  it("keeps a private author neutral without a profile link and shows rejected owner text only in recovery", () => {
    const view = render(
      <DiscussionRecordCard
        record={{
          ...record,
          author: null,
          state: "rejected",
          body: "",
          latestRevision: {
            id: "revision",
            state: "changes_requested",
            title: "My proposal",
            body: "Private rejected message",
            baseVersion: 0,
            attachments: [],
            feedback: "Please provide a source.",
          },
        }}
        kind="thread"
        own
        signedIn
        onReload={vi.fn()}
      />
    )
    expect(screen.getByText("Community member")).toBeTruthy()
    expect(screen.getByText("Private rejected message")).toBeTruthy()
    expect(view.container.querySelector('a[href*="/profile/"]')).toBeNull()
  })

  it("submits replies through the authenticated bridge with one-level parent linkage", async () => {
    fetch.mockResolvedValue(
      Response.json({ reply: { ...record, id: "reply", state: "pending" } })
    )
    render(
      <DiscussionComposer
        threadId="thread"
        parentId="parent"
        language="fr"
        signedIn
        onSubmitted={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "An experience from this library" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await screen.findByText(/Sent for review/)
    expect(fetch.mock.calls[0]?.[0]).toBe(
      "/api/discussions/threads/thread/replies"
    )
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({
      body: "An experience from this library",
      language: "fr",
      parentId: "parent",
    })
  })

  it("hides an earlier account's private pending text immediately when the actor changes", async () => {
    fetch.mockImplementation(async (url: string) =>
      url === "/api/discussions/threads/thread"
        ? Response.json({ ...record, state: "pending" })
        : Response.json({
            data: url.includes("kind=thread")
              ? [
                  {
                    ...record,
                    state: "pending",
                    pendingRevision: {
                      id: "pending",
                      body: "Private unsent body",
                      title: "Draft",
                      baseVersion: 3,
                    },
                  },
                ]
              : [],
          })
    )
    const view = render(<DiscussionThread id="thread" />)
    await screen.findByText("Private unsent body")
    actor.signedIn = false
    actor.scope = "guest"
    fetch.mockImplementation(() => new Promise(() => {}))
    view.rerender(<DiscussionThread id="thread" />)
    expect(screen.queryByText("Private unsent body")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Edit your message" })
    ).toBeNull()
  })

  it("preserves unsent discussion edits through reload and adopts a new version only explicitly", async () => {
    fetch
      .mockResolvedValueOnce(Response.json({}, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ revision: { id: "revision" } }))
    const view = render(
      <DiscussionRecordCard
        record={record}
        kind="thread"
        own
        signedIn
        onReload={vi.fn(async () => {})}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Edit your message" }))
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Keep my unsent change" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await screen.findByRole("alert")
    view.rerender(
      <DiscussionRecordCard
        record={{ ...record, version: 4, body: "Changed published text" }}
        kind="thread"
        own
        signedIn
        onReload={vi.fn(async () => {})}
      />
    )
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("Keep my unsent change")
    fireEvent.click(
      screen.getByRole("button", {
        name: "I have compared: use this version and keep my text",
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toMatchObject({
      body: "Keep my unsent change",
      baseVersion: 4,
    })
  })
})

it("opens library-life discussion authoring against the library's content locale and stable target", async () => {
  fetch.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/discussions/subjects"))
      return Response.json({
        data: [
          {
            id: "library-subject",
            name: "Library life",
            slug: "library-life",
            visibility: "public",
            createPolicy: "members",
          },
        ],
      })

    return Response.json({ data: [] })
  })
  render(
    <AttachedDiscussion
      target={{
        uid: "api::library.library",
        documentId: "library",
        locale: "fr",
      }}
      subjectSlug="library-life"
      title="Bibliothèque"
      language="fr"
    />
  )
  await screen.findByLabelText("Message")
  expect((screen.getByLabelText("Language") as HTMLInputElement).value).toBe(
    "fr"
  )
  expect(
    (screen.getByLabelText("Language") as HTMLSelectElement).disabled
  ).toBe(true)
  const request = fetch.mock.calls.find(([url]) =>
    String(url).includes("targetUid=")
  )
  const query = new URL(String(request?.[0]), "https://host.example")
    .searchParams
  expect(Object.fromEntries(query)).toMatchObject({
    targetUid: "api::library.library",
    targetId: "library",
    targetLocale: "fr",
  })
})

describe("thread moderator design", () => {
  const grant = {
    canModerate: true,
    canSanction: true,
    canReply: true,
    canReact: true,
  }
  const proposal = {
    id: "proposal",
    recordType: "reply",
    recordId: "pending",
    threadId: "thread",
    body: "A private review proposal",
    previousBody: "Published wording",
    baseVersion: 3,
    currentVersion: 3,
    recordState: "visible",
    language: "en",
    author: { name: "Another writer" },
    canReview: true,
    canSanction: true,
    attachments: [],
  }
  function mockThread(
    revision = proposal,
    extra: Partial<DiscussionRecord> = {}
  ) {
    fetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return Response.json({ state: "approved" })
      if (url.includes("moderation/revisions?threadId="))
        return Response.json({
          data: [
            revision,
            {
              ...revision,
              id: "other-thread-proposal",
              threadId: "another-thread",
              body: "Private text from another conversation",
            },
          ],
          total: 1,
        })
      if (url.includes("moderation/revisions"))
        return Response.json({ data: [revision], total: 4 })
      if (url.includes("/audit"))
        return Response.json({
          data: [
            {
              id: "audit",
              recordId: "thread",
              recordType: "thread",
              action: "pin",
              actor: { name: "Editor" },
            },
          ],
        })
      if (
        url.includes("my/records") ||
        url.includes("/replies") ||
        url.includes("threads?")
      )
        return Response.json({ data: [] })

      return Response.json({
        ...record,
        ...extra,
        viewer: grant,
        subscribed: false,
        subject: {
          id: "subject",
          slug: "library-life",
          name: "Library life",
          visibility: "public",
          createPolicy: "members",
        },
      })
    })
  }
  it.each([true, false])(
    "distinguishes a hidden feed from a private primary target in member preview (%s)",
    async (targetPublic) => {
      actor.canModerate = true
      mockThread(proposal, {
        target: { title: "Drive", url: "/community/drives/example" },
        contexts: [
          {
            id: "context",
            threadId: "thread",
            target: { uid: "api::drive.drive", documentId: "drive" },
            title: "Drive",
            url: "/community/drives/example",
            state: "visible",
            version: 1,
            featured: false,
            public: false,
            targetPublic,
          },
        ],
      })
      render(<DiscussionThread id="thread" />)
      await screen.findByText("A private review proposal")
      fireEvent.click(screen.getByRole("button", { name: "Preview as member" }))
      if (targetPublic) expect(screen.getByText("Visible message")).toBeTruthy()
      else expect(screen.queryByText("Visible message")).toBeNull()
    }
  )
  it("renders the scoped queue, edit comparison and audit sidebar, then hides them in member preview", async () => {
    actor.canModerate = true
    mockThread()
    render(<DiscussionThread id="thread" />)
    await screen.findByText("A private review proposal")
    expect(screen.getByText("Published wording")).toBeTruthy()
    expect(
      screen.queryByText("Private text from another conversation")
    ).toBeNull()
    expect(screen.getByRole("heading", { name: "Review queue" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Moderation log" })).toBeTruthy()
    expect(screen.getByText("Pinned this conversation")).toBeTruthy()
    expect(screen.getByText("Editor")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Pin to top" })).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Close for replies" })
    ).toBeTruthy()
    expect(
      fetch.mock.calls.some(
        ([url]) =>
          url ===
          "/api/discussions/moderation/revisions?threadId=thread&limit=20"
      )
    ).toBe(true)
    fireEvent.click(screen.getByRole("button", { name: "Preview as member" }))
    expect(screen.queryByText("A private review proposal")).toBeNull()
    expect(screen.queryByText("Published wording")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Moderation log" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Moderate" })).toBeNull()
    expect(
      screen.getByRole("form", { name: "Join the conversation" })
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Return to moderator view" })
    )
    await screen.findByText("A private review proposal")
  })
  it("requires decline feedback and submits the immutable revision version", async () => {
    actor.canModerate = true
    mockThread()
    render(<DiscussionThread id="thread" />)
    await screen.findByText("A private review proposal")
    fireEvent.click(screen.getByRole("button", { name: "Decline…" }))
    expect(
      (screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.change(
      screen.getByLabelText("Feedback to the author (shared with them)"),
      { target: { value: "Please clarify the accessibility details." } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Request changes" }))
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url, init]) =>
            url === "/api/discussions/moderation/revisions/proposal" &&
            init?.method === "PUT"
        )
      ).toBe(true)
    )
    const sent = fetch.mock.calls.find(
      ([url, init]) => url.endsWith("/proposal") && init?.method === "PUT"
    )!
    expect(JSON.parse(String(sent[1]?.body))).toMatchObject({
      decision: "request_changes",
      baseVersion: 3,
      contributorFeedback: "Please clarify the accessibility details.",
    })
  })
  it("shows an author's proposal without allowing self review, and clears moderator text after sign-out", async () => {
    actor.canModerate = true
    mockThread({ ...proposal, canReview: false, canSanction: false })
    const view = render(<DiscussionThread id="thread" />)
    await screen.findByText("A private review proposal")
    expect(
      screen.getByText("Another moderator needs to review your contribution.")
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Accept and publish" })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Restrict author…" })
    ).toBeNull()
    actor.canModerate = false
    actor.signedIn = false
    actor.scope = "guest"
    view.rerender(<DiscussionThread id="thread" />)
    expect(screen.queryByText("A private review proposal")).toBeNull()
    await screen.findByText("Visible message")
    expect(screen.queryByRole("heading", { name: "Review queue" })).toBeNull()
  })
  it("does not fetch review data on the strength of a global grant when this thread denies moderation", async () => {
    actor.canModerate = true
    fetch.mockImplementation(async (url: string) =>
      Response.json(
        url.includes("my/records") ||
          url.includes("/replies") ||
          url.includes("threads?")
          ? { data: [] }
          : {
              ...record,
              viewer: { ...grant, canModerate: false, canSanction: false },
            }
      )
    )
    render(<DiscussionThread id="thread" />)
    await screen.findByText("Visible message")
    expect(fetch.mock.calls.some(([url]) => url.includes("/moderation/"))).toBe(
      false
    )
    expect(screen.queryByRole("button", { name: "Moderate" })).toBeNull()
  })
})
