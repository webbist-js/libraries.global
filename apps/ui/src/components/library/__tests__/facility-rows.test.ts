import { describe, expect, it } from "vitest"

import { facilityRows } from "../facility-rows"

const states = (rows: ReturnType<typeof facilityRows>) =>
  Object.fromEntries(rows.map((r) => [r.label, r.state]))

describe("facilityRows", () => {
  it("asks every checklist question on an empty record", () => {
    const rows = facilityRows({})

    expect(rows).toHaveLength(8)
    expect(rows.every((r) => r.state === "unknown")).toBe(true)
  })

  it("treats the mapped CMS entry as the answer", () => {
    const s = states(
      facilityRows({
        accessibility: [{ name: "Low vision support" }, { name: "Quiet room" }],
        services: [{ name: "Cafes & restaurant" }],
      })
    )

    expect(s["Low vision support"]).toBe("yes")
    expect(s["Large-print materials"]).toBeUndefined()
    expect(s["Quiet study space"]).toBeUndefined()
    expect(s["Café"]).toBeUndefined()
  })

  it("shows confirmed-absent questions as no", () => {
    const s = states(
      facilityRows({ absentFacilities: ["Hearing loop", "not a question"] })
    )

    expect(s["Hearing loop"]).toBe("no")
    expect(s["Wi-Fi"]).toBe("unknown")
    expect(s["not a question"]).toBeUndefined()
  })

  it("a documented entry wins over an old no", () => {
    const s = states(
      facilityRows({
        accessibility: [{ name: "Hearing loop" }],
        absentFacilities: ["Hearing loop"],
      })
    )

    expect(s["Hearing loop"]).toBe("yes")
  })
})
