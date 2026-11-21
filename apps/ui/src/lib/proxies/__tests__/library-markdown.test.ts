import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { libraryMarkdownRewrite } from "@/lib/proxies/libraryMarkdown"

describe("library Markdown routing", () => {
  it.each([
    [
      "/europe/england/london/central-library.md",
      "/en/europe/england/london/central-library/markdown",
    ],
    [
      "/fr/europe/england/london/central-library.md",
      "/fr/europe/england/london/central-library/markdown",
    ],
  ])("rewrites %s while retaining the locale", (path, target) => {
    const response = libraryMarkdownRewrite(
      new NextRequest(`https://libraries.global${path}`)
    )
    expect(response).not.toBeNull()
    expect(
      new URL(response!.headers.get("x-middleware-rewrite")!).pathname
    ).toBe(target)
  })

  it("leaves Knowledge exports and unrelated paths alone", () => {
    for (const path of [
      "/knowledge/data-api/guide.md",
      "/developers/llms.txt",
      "/europe/england/london/central-library",
      "/unknown/england/london/central-library.md",
    ]) {
      expect(
        libraryMarkdownRewrite(
          new NextRequest(`https://libraries.global${path}`)
        )
      ).toBeNull()
    }
  })
})
