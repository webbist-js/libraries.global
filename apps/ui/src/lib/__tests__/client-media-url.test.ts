import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * formatStrapiMediaUrl answers with the Strapi origin on the server and
 * /api/asset/… in the browser, so a client component that renders it
 * hydrates with a different <img src> and leaks Strapi's address into the
 * HTML. Client modules use formatStrapiMediaUrlForClient.
 */
const SRC = path.resolve(__dirname, "../..")

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

describe("client modules use the client media URL", () => {
  it("never call formatStrapiMediaUrl from a 'use client' module", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => {
        const src = readFileSync(file, "utf8")

        return (
          /^\s*["']use client["']/.test(src) &&
          /\bformatStrapiMediaUrl\(/.test(src)
        )
      })
      .map((file) => path.relative(SRC, file))
    expect(offenders).toEqual([])
  })
})
