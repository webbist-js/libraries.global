import { expect, it, vi } from "vitest"

import { publishedArticleLocales } from "../src/utils/public-article-locales"

it("returns public route codes for published Taiwan article variants", async () => {
  const findMany = vi
    .fn()
    .mockResolvedValue([
      { locale: "en" },
      { locale: "zh-Hant-TW" },
      { locale: "zh-Hant-TW" },
    ])
  const strapi = {
    documents: () => ({ findMany }),
  }

  expect(
    await publishedArticleLocales(
      strapi,
      "api::blog-article.blog-article",
      "abc"
    )
  ).toEqual(["en", "zh-TW"])
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ status: "published", locale: "*" })
  )
})
