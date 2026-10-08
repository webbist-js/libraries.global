import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import { describe, expect, it, vi } from "vitest"

const addCollection = vi.fn()
vi.mock("@iconify/react", () => ({
  addCollection: (...args: unknown[]) => addCollection(...args),
}))

const { LIVE_ICON_IDS, LIVE_ICONS, registerLiveIcons } =
  await import("../icons")

const SRC = path.resolve(__dirname, "../../../..")

/** Every `.ts`/`.tsx` file under `dir`, recursively. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)

    return statSync(full).isDirectory()
      ? files(full)
      : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
        ? [full]
        : []
  })
}

/**
 * What renders under `/live`: the console components, their copy, the ds
 * parts the live pages use, and the sign-in form a signed-out deep link
 * shows.
 */
const RENDERED_UNDER_LIVE = [
  ...files(path.join(SRC, "components/mobile/live")),
  path.join(SRC, "components/mobile/live-copy.ts"),
  ...["Badge", "StatusBadge", "ChoiceCard", "Notice"].map((n) =>
    path.join(SRC, `components/ds/${n}.tsx`)
  ),
  ...files(path.join(SRC, "app/[locale]/live")),
  ...files(path.join(SRC, "app/[locale]/auth/signin/_components")),
  ...files(path.join(SRC, "app/[locale]/auth/_components")),
]

describe("the live console's icons", () => {
  it("are all embedded, so the console never fetches api.iconify.design", () => {
    const missing = new Set<string>()
    for (const file of RENDERED_UNDER_LIVE) {
      const source = readFileSync(file, "utf8")
      for (const [, id] of source.matchAll(/"(mdi:[a-z0-9-]+)"/g))
        if (!LIVE_ICON_IDS.has(id!))
          missing.add(`${id} (${path.relative(SRC, file)})`)
    }
    expect([...missing]).toEqual([])
  })

  it("are 24 × 24 mdi glyphs with a body each", () => {
    expect(LIVE_ICONS.prefix).toBe("mdi")
    expect(LIVE_ICONS.width).toBe(24)
    expect(LIVE_ICONS.height).toBe(24)
    for (const icon of Object.values(LIVE_ICONS.icons))
      expect(icon.body).toMatch(/^<path /)
  })

  it("register with Iconify once, however many modules ask", () => {
    registerLiveIcons()
    registerLiveIcons()
    expect(addCollection).toHaveBeenCalledTimes(1)
    expect(addCollection).toHaveBeenCalledWith(LIVE_ICONS)
  })
})
