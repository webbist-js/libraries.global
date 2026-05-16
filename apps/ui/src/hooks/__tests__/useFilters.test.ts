// apps/ui/src/hooks/__tests__/useFilters.test.ts
import { describe, expect, it, vi } from "vitest"

import { DEFAULT_FILTERS } from "@/components/library-index/types"
import { useFilters } from "@/hooks/useFilters"

describe("useFilters — toggleArrayItem", () => {
  it("adds a value to an empty array and resets page to 0", () => {
    const onChange = vi.fn()
    const { toggleArrayItem } = useFilters(DEFAULT_FILTERS, onChange)
    toggleArrayItem("libraryTypes", "National", true)
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      libraryTypes: ["National"],
      page: 0,
    })
  })

  it("removes a value from the array and resets page to 0", () => {
    const onChange = vi.fn()
    const base = { ...DEFAULT_FILTERS, libraryTypes: ["National", "Public"] }
    const { toggleArrayItem } = useFilters(base, onChange)
    toggleArrayItem("libraryTypes", "National", false)
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: ["Public"],
      page: 0,
    })
  })

  it("does not add a duplicate value", () => {
    const onChange = vi.fn()
    const base = { ...DEFAULT_FILTERS, libraryTypes: ["National"] }
    const { toggleArrayItem } = useFilters(base, onChange)
    toggleArrayItem("libraryTypes", "National", true)
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: ["National"],
      page: 0,
    })
  })
})

describe("useFilters — toggleArrayItems (group toggle)", () => {
  it("adds multiple values at once and resets page", () => {
    const onChange = vi.fn()
    const { toggleArrayItems } = useFilters(DEFAULT_FILTERS, onChange)
    toggleArrayItems("libraryTypes", ["National", "Public"], true)
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      libraryTypes: ["National", "Public"],
      page: 0,
    })
  })

  it("removes multiple values at once and resets page", () => {
    const onChange = vi.fn()
    const base = {
      ...DEFAULT_FILTERS,
      libraryTypes: ["National", "Public", "Academic"],
    }
    const { toggleArrayItems } = useFilters(base, onChange)
    toggleArrayItems("libraryTypes", ["National", "Public"], false)
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: ["Academic"],
      page: 0,
    })
  })
})

describe("useFilters — resetFields", () => {
  it("merges partial reset and resets page", () => {
    const onChange = vi.fn()
    const base = {
      ...DEFAULT_FILTERS,
      libraryTypes: ["National"],
      statuses: ["open"],
    }
    const { resetFields } = useFilters(base, onChange)
    resetFields({
      libraryTypes: [],
      statuses: [],
      featured: false,
      accessibilityNames: [],
      serviceNames: [],
      operatorTypes: [],
    })
    expect(onChange).toHaveBeenCalledWith({
      ...base,
      libraryTypes: [],
      statuses: [],
      featured: false,
      accessibilityNames: [],
      serviceNames: [],
      operatorTypes: [],
      page: 0,
    })
  })
})
