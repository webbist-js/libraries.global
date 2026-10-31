import { expect, it } from "vitest"

import { updateMembershipLinks } from "../scripts/membership-page-links.mjs"

it("updates nested CMS links and HTML without rewriting checkout or redirect sources", () => {
  const doc = {
    documentId: "same",
    source: "/pro",
    destination: "/pro",
    sections: [
      {
        id: 42,
        links: [{ id: 9, href: "/pro", label: "Plans & Pro" }],
      },
    ],
    body: '<p>Read <a href="https://libraries.global/cs/pro#plan-pro">plans</a>.</p><a href="/contribute/membership/checkout?plan=pro">Checkout</a>',
    author: { documentId: "author" },
  }
  expect(updateMembershipLinks(doc, "cs")).toEqual({
    ...doc,
    destination: "/plans",
    sections: [
      { id: 42, links: [{ id: 9, href: "/plans", label: "Plány a ceny" }] },
    ],
    body: '<p>Read <a href="https://libraries.global/cs/plans#plan-pro">plans</a>.</p><a href="/contribute/membership/checkout?plan=pro">Checkout</a>',
  })
  expect(doc.sections[0]!.links[0]!.href).toBe("/pro")
  expect(updateMembershipLinks(updateMembershipLinks(doc))).toEqual(
    updateMembershipLinks(doc)
  )
})

it("moves account links into Profile while preserving recognition anchors", () => {
  expect(
    updateMembershipLinks('<a href="/fr/membership#recognition">Account</a>')
  ).toBe('<a href="/fr/profile/membership#recognition">Account</a>')
})

it("preserves the dashboard membership destination", () => {
  const link = { href: "/contribute/membership", label: "Membership" }
  expect(updateMembershipLinks(link)).toEqual(link)
})
