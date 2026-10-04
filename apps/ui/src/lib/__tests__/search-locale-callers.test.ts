import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * The library, Knowledge and Journal indexes hold every locale's version of
 * a document. Every search entry point must say which locale it wants so
 * the LIVE_LOCALES rule (lib/meilisearch.ts `searchLocale`) applies; a call
 * without one silently searches the default locale on every route.
 */
const SRC = path.resolve(__dirname, "../..")
const CALL =
  /\b(searchLibraries|searchFind|libraryTotal|findQueryOf|searchWikiArticles|searchBlogArticles|searchLibrariesByParams|searchLibraryNames)\(/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory())
      return name === "__tests__" || name === "node_modules"
        ? []
        : sourceFiles(full)

    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

/** The argument text of the call whose "(" is at `open`. */
function callArgs(src: string, open: number): string {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++
    else if (src[i] === ")" && --depth === 0) return src.slice(open + 1, i)
  }

  return src.slice(open + 1)
}

describe("search entry points name a locale", () => {
  const calls = sourceFiles(SRC)
    .filter((f) => !f.endsWith(path.join("lib", "meilisearch.ts")))
    .flatMap((file) => {
      const src = readFileSync(file, "utf8")

      return [...src.matchAll(CALL)]
        .filter((m) => !/function\s+$/.test(src.slice(0, m.index)))
        .map((m) => ({
          where: `${path.relative(SRC, file)}: ${m[1]}`,
          args: callArgs(src, m.index! + m[0].length - 1),
        }))
    })

  it("finds the callers", () => {
    expect(calls.length).toBeGreaterThan(5)
  })

  it.each(calls.map((c) => [c.where, c.args]))(
    "%s passes the route locale",
    (_where, args) => {
      expect(args).toMatch(/\blocale\b/)
    }
  )
})

describe("lib/meilisearch.ts stays client-safe", () => {
  it("doesn't import the SEO metadata builders", () => {
    const src = readFileSync(path.join(SRC, "lib/meilisearch.ts"), "utf8")
    expect(src).not.toMatch(/from "@\/lib\/seo\/metadata"/)
  })
})
