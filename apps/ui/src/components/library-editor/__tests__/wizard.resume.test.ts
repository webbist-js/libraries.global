import { describe, expect, it } from "vitest"

import { resumeRecordDraft } from "../wizard.resume"
import { EMPTY_FORM } from "../wizard.types"

describe("record draft recovery", () => {
  it("keeps fresh untouched fields while preserving the proposal and its old baseline", () => {
    const original = { ...EMPTY_FORM, name: "Library", city: "Old city" }
    const fresh = {
      ...original,
      city: "Current city",
      name: "Another editor's name",
    }
    const result = resumeRecordDraft(fresh, {
      ...original,
      name: "Proposed name",
      editSummary: "Correct the name",
      previous: original,
      kind: "record",
    })
    expect(result.form.name).toBe("Proposed name")
    expect(result.form.city).toBe("Current city")
    expect(result.baseline.name).toBe("Library")
    expect(result.baseline.city).toBe("Current city")
    expect(result.form.editSummary).toBe("Correct the name")
    expect(result.form).not.toHaveProperty("previous")
  })
  it("restores exact returned changes rather than the whole historical form", () => {
    const current = { ...EMPTY_FORM, name: "Library", city: "Current city" }
    const restored = resumeRecordDraft(
      current,
      { ...current, city: "Old city", name: "Proposal" },
      { name: "Old name" }
    )
    expect(restored.form.name).toBe("Proposal")
    expect(restored.form.city).toBe("Current city")
    expect(restored.baseline.name).toBe("Old name")
  })
})
