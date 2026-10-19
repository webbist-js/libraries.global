// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { CompositionPreferences } from "@/lib/composition-language"
import { cleanup, render, screen, waitFor, fireEvent } from "@/test/render"

import { DiscussionFeed } from "./DiscussionFeed"

Object.assign(globalThis, { React })
const actor = vi.hoisted(() => ({
  scope: "board",
  ready: true,
  signedIn: true,
  canModerate: false,
  compositionPreferences: undefined as CompositionPreferences | undefined,
}))
vi.mock("./useDiscussionActor", () => ({ useDiscussionActor: () => actor }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("@/components/ds/SelectField", () => ({
  SelectField: ({ label, value, options, onValueChange }: any) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span /> }))
const target = { uid: "api::library.library", documentId: "library" }
const record = {
  id: "shared-thread",
  title: "Reading room",
  excerpt: "Approved excerpt",
  author: { name: "Author" },
  language: "en",
  state: "visible",
  replyCount: 2,
}
const fetch = vi.fn()
let manage = true,
  enabled = true
let links: any[] = []
beforeEach(() => {
  manage = true
  enabled = true
  links = []
  actor.scope = "board"
  actor.ready = true
  actor.signedIn = true
  actor.compositionPreferences = undefined
  fetch.mockReset()
  fetch.mockImplementation(async (url: string) => {
    if (url.includes("/relations/locales"))
      return Response.json({
        data: [
          { code: "en", name: "English" },
          { code: "fr", name: "French" },
        ],
      })
    if (url.includes("/context?"))
      return Response.json({
        enabled,
        version: 2,
        canManage: manage,
        canPropose: manage,
        links,
      })
    if (url.includes("/my/records"))
      return Response.json({
        data:
          actor.scope === "board"
            ? [
                {
                  ...record,
                  id: "private-draft",
                  state: "pending",
                  pendingRevision: { title: "My private text" },
                },
              ]
            : [],
      })

    return Response.json({ data: [record], total: 1 })
  })
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("shared discussion feeds", () => {
  it("opens the original thread, defaults to the header language, and combines entity and language filters", async () => {
    render(<DiscussionFeed target={target} />)
    expect(
      (await screen.findByRole("link", { name: /Reading room/ })).getAttribute(
        "href"
      )
    ).toBe("/community/discussions/shared-thread")
    expect(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
        .value
    ).toBe("en")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "fr" } })
    await waitFor(() =>
      expect(
        fetch.mock.calls.some(
          ([url]) =>
            String(url).includes("contextId=library") &&
            String(url).includes("language=fr")
        )
      ).toBe(true)
    )
    expect(
      screen
        .getByRole("link", { name: "View all conversations" })
        .getAttribute("href")
    ).toBe("/community/discussions?context=libraries&entity=library&lang=fr")
  })
  it("uses a late profile default until the reader explicitly chooses all languages", async () => {
    const view = render(<DiscussionFeed target={target} />)
    await screen.findByRole("link", { name: /Reading room/ })
    actor.compositionPreferences = {
      languages: [{ code: "fr", proficiency: "native" }],
    }
    view.rerender(<DiscussionFeed target={target} />)
    expect(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
        .value
    ).toBe("fr")
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "" },
    })
    actor.compositionPreferences = {
      languages: [{ code: "cs", proficiency: "native" }],
    }
    view.rerender(<DiscussionFeed target={target} />)
    expect(
      (screen.getByRole("combobox", { name: "Language" }) as HTMLSelectElement)
        .value
    ).toBe("")
    expect(
      screen
        .getByRole("link", { name: "View all conversations" })
        .getAttribute("href")
    ).toContain("lang=all")
  })

  it("isolates private recovery and management controls on a same-user authority change", async () => {
    const view = render(<DiscussionFeed target={target} />)
    expect(await screen.findByText("My private text")).toBeTruthy()
    expect(screen.queryByText("Choosing what shows here.")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    expect(screen.getByText("Choosing what shows here.")).toBeTruthy()
    actor.scope = "member"
    manage = false
    view.rerender(<DiscussionFeed target={target} />)
    expect(screen.queryByText("My private text")).toBeNull()
    await screen.findByRole("link", { name: /Reading room/ })
    expect(screen.queryByRole("button", { name: "Manage" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull()
    expect(screen.queryByText("Choosing what shows here.")).toBeNull()
    expect(screen.queryByText("My private text")).toBeNull()
  })
  it("hides a disabled context feed from ordinary readers", async () => {
    manage = false
    enabled = false
    actor.signedIn = false
    actor.scope = "guest"
    const view = render(<DiscussionFeed target={target} />)
    await waitFor(() => expect(view.container.innerHTML).toBe(""))
    expect(screen.queryByText("Approved excerpt")).toBeNull()
  })
  it("retains private owner recovery when the public feed is hidden", async () => {
    manage = false
    enabled = false
    render(<DiscussionFeed target={target} />)
    expect(await screen.findByText("My private text")).toBeTruthy()
    expect(screen.queryByText("Approved excerpt")).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Start a discussion" })
    ).toBeNull()
  })
  it("shows the featured card while keeping link controls behind Manage", async () => {
    links = [
      {
        id: "featured-link",
        threadId: record.id,
        state: "visible",
        featured: true,
        canManage: true,
        version: 1,
      },
    ]
    render(<DiscussionFeed target={target} />)
    expect(await screen.findByText("Featured")).toBeTruthy()
    expect(screen.getByText("Approved excerpt")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    expect(screen.getByRole("button", { name: "Stop featuring" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Unlink" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Hide this feed" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.queryByRole("button", { name: "Unlink" })).toBeNull()
    expect(screen.getByRole("link", { name: "Reading room" })).toBeTruthy()
  })
})
