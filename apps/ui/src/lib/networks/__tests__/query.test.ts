import { expect, it } from "vitest"

import { networkQuery } from "@/lib/networks/query"

it("keeps multiple facility choices and only supported bounded query fields", () => {
  const query = networkQuery({
    facility: ["Wi-Fi", "Accessible toilets"],
    q: "x".repeat(200),
    page: "3",
    country: "england",
    admin: "true",
    type: ["Public", "Digital"],
  })
  expect(query.get("facility")).toBe("Wi-Fi,Accessible toilets")
  expect(query.get("q")).toHaveLength(120)
  expect(query.get("page")).toBe("3")
  expect(query.has("admin")).toBe(false)
  expect(query.has("type")).toBe(false)
})
