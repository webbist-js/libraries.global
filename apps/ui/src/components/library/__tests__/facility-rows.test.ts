import { describe, expect, it } from "vitest"

import { facilityAnswersBody, facilityRows } from "../facility-rows"

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

describe("facilityAnswersBody", () => {
  const answers: [string, "yes" | "no"][] = [
    ["Hearing loop", "yes"],
    ["Wi-Fi", "no"],
  ]

  it("sends the answers as one facilities correction", () => {
    expect(
      facilityAnswersBody({ slug: "nailsea", name: "Nailsea Library", answers })
    ).toEqual({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: "nailsea",
      editSummary: "Accessibility: Hearing loop yes, Wi-Fi no",
      fields: {
        kind: "facilities",
        category: "Accessibility",
        libraryName: "Nailsea Library",
        answers: { "Hearing loop": "yes", "Wi-Fi": "no" },
      },
    })
  })

  it("names the library and the drive at the top level when given", () => {
    const body = facilityAnswersBody({
      slug: "nailsea",
      name: "Nailsea Library",
      answers,
      documentId: "lib00000000000000000001",
      driveDocumentId: "drv00000000000000000001",
    })
    expect(body.targetDocumentId).toBe("lib00000000000000000001")
    expect(body.driveDocumentId).toBe("drv00000000000000000001")
    expect(body.fields).not.toHaveProperty("driveDocumentId")
  })
})
