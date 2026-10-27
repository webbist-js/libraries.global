import { describe, expect, it } from "vitest"

import { cn } from "@/lib/styles"

describe("typography role composition", () => {
  it("lets a caller replace a component's default title role", () => {
    expect(cn("type-panel-title", "type-h2")).toBe("type-h2")
    expect(cn("type-feature-title", "type-card-title")).toBe("type-card-title")
  })

  it("preserves layout, colour and explicit emphasis when changing roles", () => {
    expect(cn("type-panel-title mt-4 text-white", "type-h2 font-bold")).toBe(
      "mt-4 text-white type-h2 font-bold"
    )
  })

  it("resolves responsive roles independently", () => {
    expect(cn("type-card-title md:type-h2", "md:type-display-section")).toBe(
      "type-card-title md:type-display-section"
    )
  })

  it("keeps the existing Tailwind spacing and colour merge behaviour", () => {
    expect(cn("p-4 text-white", false, "p-6 text-black")).toBe("p-6 text-black")
  })
})
