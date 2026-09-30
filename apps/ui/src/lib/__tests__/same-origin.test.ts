import { describe, expect, it } from "vitest"

import { isSameOrigin, sameOriginResponse } from "../same-origin"

const SITE = "https://libraries.global"

const req = (headers: Record<string, string>) =>
  new Request("https://libraries.global/api/profile/me", {
    method: "DELETE",
    headers,
  })

describe("isSameOrigin", () => {
  it("accepts a matching Origin", () => {
    expect(isSameOrigin(req({ origin: SITE }), SITE)).toBe(true)
  })

  it("accepts a matching Referer when Origin is absent", () => {
    expect(
      isSameOrigin(req({ referer: `${SITE}/profile/settings` }), SITE)
    ).toBe(true)
  })

  it("compares origins, not the site's path or trailing slash", () => {
    expect(isSameOrigin(req({ origin: SITE }), `${SITE}/`)).toBe(true)
  })

  it.each([
    ["a different origin", { origin: "https://evil.example" }],
    [
      "a look-alike origin",
      { origin: "https://libraries.global.evil.example" },
    ],
    ["a null Origin", { origin: "null" }],
    ["a different Referer", { referer: "https://evil.example/x" }],
    [
      "a matching Referer but a foreign Origin",
      { origin: "https://evil.example", referer: `${SITE}/x` },
    ],
    ["no header at all", {}],
  ])("rejects %s", (_label, headers) => {
    expect(isSameOrigin(req(headers), SITE)).toBe(false)
  })

  it("rejects everything when the site URL isn't configured", () => {
    expect(isSameOrigin(req({ origin: SITE }), undefined)).toBe(false)
  })
})

describe("sameOriginResponse", () => {
  it("is a 403", async () => {
    const res = sameOriginResponse()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Cross-site request refused" })
  })
})
