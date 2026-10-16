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
}))
const record: DiscussionRecord = {
  id: "thread",
  subjectId: "subject",
  title: "Library visit",
  body: "Visible message",
  state: "visible",
  version: 3,
  language: "en",
  author: { name: "Author" },
}
const fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  actor.signedIn = true
  actor.canModerate = false
  actor.scope = "writer"
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("discussion interactions", () => {
  it("browses all languages by default with named configured language choices", async () => {
    fetch.mockImplementation(async (url: string) => {
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

  it("escapes bodies and never follows unsafe author links", () => {
    const view = render(
      <DiscussionRecordCard
        record={{
          ...record,
          body: "<script>bad()</script><img src=x onerror=bad()>",
          author: { name: "Author", url: "data:text/html,bad" },
        }}
        kind="thread"
        own={false}
        signedIn={false}
        onReload={vi.fn()}
      />
    )
    expect(view.container.querySelector("script, img, a")).toBeNull()
    expect(screen.getByText(/<script>/).textContent).toContain("onerror")
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
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }))
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
            : { ...record, locked: true }
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
