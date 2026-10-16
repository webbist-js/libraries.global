// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import type { DiscussionRecord } from "./api"
import { DiscussionParticipantRestriction } from "./DiscussionParticipantRestriction"

Object.assign(globalThis, { React })
const fetch = vi.fn()
const record: DiscussionRecord = {
  id: "thread",
  subjectId: "subject",
  body: "Message",
  state: "visible",
  version: 1,
  language: "en",
  author: { name: "Author" },
  attachments: [],
  reactions: { like: 0, love: 0 },
  myReaction: null,
}
beforeEach(() => {
  fetch.mockReset()
  fetch.mockResolvedValue(Response.json({ id: "restriction" }))
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function openRestriction() {
  render(
    <DiscussionParticipantRestriction
      record={record}
      kind="thread"
      onReload={vi.fn(async () => {})}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Restrict this participant" })
  )
  fireEvent.change(screen.getByLabelText("Private moderation reason"), {
    target: { value: "Repeated disruption" },
  })
  fireEvent.change(
    screen.getByLabelText("Feedback to the author (shared with them)"),
    {
      target: { value: "Please follow the guidelines." },
    }
  )

  return screen.getByLabelText("Ends at (optional)") as HTMLInputElement
}

it("submits a visible native deadline without needing a React change event or blur", async () => {
  const input = openRestriction()
  input.value = "2026-10-17T12:00"
  fireEvent.submit(input.form!)
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body).expiresAt).toBe(
    new Date("2026-10-17T12:00").toISOString()
  )
})

it("uses the cleared native field instead of an earlier deadline in React state", async () => {
  const input = openRestriction()
  fireEvent.change(input, { target: { value: "2026-10-17T12:00" } })
  input.value = ""
  fireEvent.submit(input.form!)
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
  expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).not.toHaveProperty(
    "expiresAt"
  )
})

it("blocks an incomplete native date field instead of making an indefinite restriction", () => {
  const input = openRestriction()
  vi.spyOn(input.form!, "reportValidity").mockReturnValue(false)
  fireEvent.submit(input.form!)
  expect(fetch).not.toHaveBeenCalled()
})
