import { describe, expect, it } from "vitest"

import { contextPath, mailtoContactIntent } from "../model"

describe("existing mail link rollout", () => {
  it.each(["info", "hello", "privacy", "security"])(
    "opens site contact for the %s mailbox",
    (address) => {
      expect(
        mailtoContactIntent(`mailto:${address}@libraries.global`)
      ).toMatchObject({ mode: "contact", type: "general_inquiry" })
    }
  )
  it.each([
    "Team plan",
    "Pro verification",
    "Pro grant",
    "Question about plans",
  ])("preserves and selects plans for %s", (subject) => {
    expect(
      mailtoContactIntent(
        `mailto:info@libraries.global?subject=${encodeURIComponent(subject)}`
      )
    ).toEqual({ mode: "contact", type: "plans", sourceSubject: subject })
  })
  it("covers configured beta contact aliases", () => {
    expect(
      mailtoContactIntent("mailto:beta@example.org", ["beta@example.org"])
    ).toMatchObject({ mode: "contact" })
  })
  it("selects membership support separately from plan inquiries", () => {
    expect(
      mailtoContactIntent(
        "mailto:info@libraries.global?subject=Membership%20support"
      )
    ).toEqual({
      mode: "contact",
      type: "membership_support",
      sourceSubject: "Membership support",
    })
  })
  it("leaves a library’s own email and non-mail links alone", () => {
    expect(mailtoContactIntent("mailto:librarian@library.example")).toBeNull()
    expect(mailtoContactIntent("https://libraries.global")).toBeNull()
    expect(mailtoContactIntent("mailto:%invalid")).toBeNull()
  })
})
it.each(["/libraries?token=private#section", "/libraries#section"])(
  "removes search and hash from %s",
  (path) => expect(contextPath(path)).toBe("/libraries")
)
it.each([
  "https://user:password@example.org/private",
  "//other.test",
  "/bad\nheader",
  String.raw`/\other.test`,
])("rejects unsafe automatic page context %s", (path) =>
  expect(contextPath(path)).toBe("/")
)

it.each([
  "/auth/verify-email/private-token",
  "/en/staff/team-secret/members",
  "/fr/%61uth/private-token",
  "/profile/settings/private-id",
])("removes private path identifiers from automatic context %s", (path) => {
  expect(contextPath(path)).not.toMatch(/private|secret|token|settings/)
})
