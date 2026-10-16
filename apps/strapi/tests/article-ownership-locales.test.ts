import { it, expect } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { ownsJournalArticle } from "../src/utils/article-relations"

it("authorizes the same author for a Spanish-only published story even when their public attribution is hidden", async () => {
  const uid = "api::blog-article.blog-article"
  const fake = makeFakeStrapi({
    [uid]: [
      {
        id: 1,
        documentId: "story",
        slug: "story",
        locale: "es",
        publishedAt: "2026-10-16",
        authorProfile: { documentId: "profile" },
        body: "Private body must not be selected",
      },
    ],
    "api::user-profile.user-profile": [
      {
        id: 1,
        documentId: "profile",
        baUserId: "owner",
        profileVisibility: "private",
        username: "private_username",
      },
    ],
  })
  expect(
    await ownsJournalArticle(fake.strapi, "owner", { targetSlug: "story" })
  ).toBe(true)
  expect(
    await ownsJournalArticle(fake.strapi, "other", { targetSlug: "story" })
  ).toBe(false)
  expect(await ownsJournalArticle(fake.strapi, "owner", {})).toBe(false)
  const queries = fake.strapi.documents.mock.results.flatMap(
    (result) => result.value.findMany.mock.calls
  )
  for (const [query] of queries) {
    expect(query).toMatchObject({
      status: "published",
      locale: "*",
      fields: ["slug"],
      limit: 1,
    })
    expect(query.populate).not.toHaveProperty("body")
  }
})
it("does not grant authorship from an unpublished translation or a matching public display name", async () => {
  const fake = makeFakeStrapi({
    "api::blog-article.blog-article": [
      {
        id: 1,
        documentId: "story",
        slug: "story",
        locale: "es",
        publishedAt: null,
        authorProfile: { documentId: "profile" },
      },
    ],
    "api::user-profile.user-profile": [
      {
        id: 1,
        documentId: "profile",
        baUserId: "owner",
        username: "matching_name",
      },
    ],
  })
  expect(
    await ownsJournalArticle(fake.strapi, "owner", { targetSlug: "story" })
  ).toBe(false)
})
