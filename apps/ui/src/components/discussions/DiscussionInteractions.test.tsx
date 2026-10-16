// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import type { DiscussionRecord } from "./api"
import { AttachedDiscussion } from "./AttachedDiscussion"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionModeration } from "./DiscussionModeration"
import { DiscussionRecordCard } from "./DiscussionRecordCard"
import { DiscussionsBoard } from "./DiscussionsBoard"
import { DiscussionThread } from "./DiscussionThread"

Object.assign(globalThis, { React })
const actor = vi.hoisted(() => ({
  signedIn: true,
  ready: true,
  canModerate: false,
  scope: "writer",
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
  window.history.replaceState(null, "", "/community/discussions")
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("discussion interactions", () => {
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
          .find((element) => element.tagName === "INPUT") as HTMLInputElement
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
    fireEvent.click(screen.getByRole("button", { name: "Accept" }))
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
    expect(document.querySelector('datalist option[value="es"]')).toBeTruthy()
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
  expect((screen.getByLabelText("Language") as HTMLInputElement).readOnly).toBe(
    true
  )
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
