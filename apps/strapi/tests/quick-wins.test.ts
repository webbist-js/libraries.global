import { describe, expect, it } from "vitest"

import quickWinsService from "../src/api/user-profile/services/quick-wins"

/** Minimal `strapi.db.query` fake: English articles exist, no translations. */
function fakeStrapi(
  articles: { documentId: string; title: string; slug: string }[]
) {
  return {
    db: {
      query: () => ({
        findMany: async () => articles,
        findOne: async () => null,
      }),
    },
  }
}

describe("quick wins: translate_wiki", () => {
  it("links to the Knowledge editor with the missing language as ?locale=", async () => {
    const service = quickWinsService({
      strapi: fakeStrapi([
        {
          documentId: "doc-1",
          title: "How to add a library",
          slug: "add-a-library",
        },
      ]),
    })

    const wins = await service.ruleTranslateWiki({
      languages: [{ code: "fr" }, { code: "es" }],
    })

    expect(wins.map((w) => w.actionUrl)).toEqual([
      "/contribute/knowledge/add-a-library?locale=fr",
      "/contribute/knowledge/add-a-library?locale=es",
    ])
  })

  it("encodes the slug and language code", async () => {
    const service = quickWinsService({
      strapi: fakeStrapi([{ documentId: "d", title: "T", slug: "a b" }]),
    })

    const [win] = await service.ruleTranslateWiki({
      languages: [{ code: "pt-BR" }],
    })

    expect(win.actionUrl).toBe("/contribute/knowledge/a%20b?locale=pt-BR")
  })
})
