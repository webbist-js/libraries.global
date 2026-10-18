// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { DiscussionRestrictions } from "./DiscussionRestrictions"

Object.assign(globalThis, { React })
const fetch = vi.fn()
const deadline = "2026-10-23T12:00:00.000Z"
beforeEach(() => {
  fetch.mockReset()
  vi.stubGlobal("fetch", fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each([false, true])(
  "shows the actual restriction deadline for moderation=%s and only uses authorised names",
  async (moderation) => {
    fetch.mockResolvedValue(
      Response.json({
        data: [
          {
            id: "restriction",
            version: 0,
            mode: "mute",
            subjectId: "subject",
            reason: "Please follow the discussion guidelines.",
            expiresAt: deadline,
            ...(moderation ? { subjectName: "Library life" } : {}),
          },
        ],
      })
    )
    const view = render(
      <DiscussionRestrictions
        scope="viewer"
        moderation={moderation}
        subjects={[{ id: "subject", name: "Library life" }]}
      />
    )
    await screen.findByText("Library life")
    const time = view.container.querySelector("time")
    expect(time?.getAttribute("dateTime")).toBe(deadline)
    expect(time?.textContent).toBeTruthy()
    expect(screen.getByText(/Restriction ends:/)).toBeTruthy()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      moderation
        ? "/api/discussions/moderation/sanctions?state=active&limit=20&offset=0"
        : "/api/discussions/my/status",
    ])
  }
)

it("keeps an unknown subject generic and distinguishes indefinite from missing deadlines", async () => {
  fetch.mockResolvedValue(
    Response.json({
      data: [
        {
          id: "indefinite",
          version: 0,
          mode: "mute",
          subjectId: "hidden-subject-id",
          reason: "Participation is restricted.",
          expiresAt: null,
        },
        {
          id: "unknown",
          version: 0,
          mode: "ban",
          subjectId: null,
          reason: "Participation is restricted.",
        },
      ],
    })
  )
  const view = render(
    <DiscussionRestrictions
      scope="viewer"
      subjects={[{ id: "other-public-subject", name: "Known public subject" }]}
    />
  )
  await screen.findByText("Subject")
  expect(screen.getByText(/No end date/)).toBeTruthy()
  expect(screen.getByText(/End date unavailable/)).toBeTruthy()
  expect(screen.queryByText("Known public subject")).toBeNull()
  expect(view.container.innerHTML).not.toContain("hidden-subject-id")
  expect(fetch).toHaveBeenCalledTimes(1)
})
