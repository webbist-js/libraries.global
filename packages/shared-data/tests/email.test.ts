/* eslint-disable sonarjs/code-eval -- Verifies that executable URLs are rejected; no code is evaluated. */
import { describe, expect, it } from "vitest"

import { emailTemplate } from "../email"
import { mergeNotificationPreferences } from "../notification-preferences"

describe("email templates", () => {
  it("escapes contributor content and credentials in HTML and retains a text alternative", () => {
    const email = emailTemplate({
      title: "Your update",
      body: '<script>alert("x")</script>',
      url: "https://libraries.global/verify?a=1&b=2",
      unsubscribeUrl: "https://libraries.global/unsubscribe",
    })
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;script&gt;")
    expect(email.html).toContain("a=1&amp;b=2")
    expect(email.text).toContain(
      "Unsubscribe: https://libraries.global/unsubscribe"
    )
  })
  it("never renders an executable link", () => {
    expect(
      emailTemplate({
        title: "Update",
        body: "Hello",
        url: "javascript:alert(1)",
      }).html
    ).not.toContain("javascript:")
  })
})
it("patches preferences without losing choices and records explicit digest consent", () => {
  const prefs = mergeNotificationPreferences(
    { newFollowers: true, weeklyDigest: true },
    { drives: false }
  )
  expect(prefs).toMatchObject({ newFollowers: true, drives: false })
  expect(prefs.digestConsentedAt).toBeUndefined()
  expect(
    mergeNotificationPreferences(
      prefs,
      { weeklyDigest: true },
      new Date("2026-10-10")
    )
  ).toMatchObject({ digestConsentedAt: "2026-10-10T00:00:00.000Z" })
  expect(() =>
    mergeNotificationPreferences(prefs, { digestConsentedAt: "forged" })
  ).toThrow()
  expect(() =>
    mergeNotificationPreferences(prefs, { constructor: false })
  ).toThrow()
})

it("keeps structured content safe and complete in both email alternatives", async () => {
  const { communityReportEmail, digestEmail, withEmailPreferences } =
    await import("../email")
  const period = { start: "2026-10-05T00:00:00Z", end: "2026-10-12T00:00:00Z" }
  const report = communityReportEmail({
    ...period,
    personal: { accepted: 3, points: -5, awaiting: 1 },
    week: {
      newLibraries: 12,
      updatedLibraries: 37,
      edits: 51,
      accepted: 28,
      knowledge: 2,
      journal: 1,
      articles: [
        {
          title: '<img src=x onerror="x">',
          href: "//evil.example",
          kind: "wiki",
        },
      ],
    },
  })
  expect(report.html).not.toContain("<img")
  expect(report.html).not.toContain('href="https://libraries.global//evil')
  expect(report.html).toContain("&lt;img")
  for (const part of [
    "Your progress",
    "Across the community",
    "51",
    "-5",
    "New reading",
    "5 Oct 2026",
    "11 Oct 2026",
    "Imported".toLowerCase(),
  ]) {
    expect(report.text).toContain(part)
    expect(report.html).toContain(part)
  }
  expect(report.text).toContain("1 submission is")
  const digest = digestEmail({
    ...period,
    libraries: [{ name: "Central & West", href: "/europe/uk/west/central" }],
  })
  expect(digest.html).toContain("Central &amp; West")
  expect(digest.text).toContain(
    "https://libraries.global/europe/uk/west/central"
  )
  expect(digest.text).not.toContain("Across the community")
  const delivered = withEmailPreferences(digest, {
    unsubscribeUrl: "https://libraries.global/email/preferences?token=fixture",
    postalAddress: "Public & postal address",
  })
  expect(delivered.html.match(/>Unsubscribe</g)).toHaveLength(1)
  expect(delivered.html).toContain("Public &amp; postal address")
  expect(delivered.text).toContain("Public & postal address")
  expect(delivered.html).not.toContain("__cms_reset")
})

it("rejects malformed and credential-bearing URLs and hides long credentials from displayed HTML labels", () => {
  for (const url of [
    "https://",
    "https://user:password@example.org",
    "https://example.org/\nattack",
  ])
    expect(
      emailTemplate({ title: "Hello", body: "Hello", url }).html
    ).not.toContain('href="' + url + '"')
  const result = emailTemplate({
    title: "Hello\r\nInjected: header",
    body: "One\n\nTwo",
    url: "https://example.org/verify?token=long-secret",
  })
  expect(result.subject).not.toMatch(/[\r\n]/)
  expect(result.html).not.toContain(">https://example.org/verify?token=")
  expect(result.text).toContain("token=long-secret")
  expect(result.html).toContain("<br>") // Footer uses real line breaks without white-space CSS.
})
