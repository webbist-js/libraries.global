import { describe, expect, it } from "vitest"

import { orderFollowedDrives } from "../followed-drives"

const d = (slug: string, status: string) =>
  ({ slug, status }) as { slug: string; status: "open" }

describe("orderFollowedDrives", () => {
  it("puts open and scheduled drives before finished ones, keeping follow order", () => {
    const ordered = orderFollowedDrives([
      d("a", "closed"),
      d("b", "open"),
      d("c", "cancelled"),
      d("d", "scheduled"),
      d("e", "open"),
      d("f", "closed"),
    ])

    expect(ordered.map((x) => x.slug)).toEqual(["b", "e", "d", "a", "f", "c"])
  })

  it("never lists a draft", () => {
    expect(
      orderFollowedDrives([d("a", "draft"), d("b", "open")]).map((x) => x.slug)
    ).toEqual(["b"])
  })
})
