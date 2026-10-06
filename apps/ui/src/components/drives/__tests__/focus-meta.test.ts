import { PANEL_GAPS } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { FOCUS_TINT } from "@/lib/design-tokens"

import {
  FOCUS_META,
  focusChipOf,
  focusKeysOf,
  gapPhraseOf,
  isFocusFilterKey,
  unitNoun,
} from "../focus-meta"

describe("FOCUS_META", () => {
  it("has a label, icon, tint and 'have …' phrase for every panel gap", () => {
    expect(Object.keys(FOCUS_META).sort()).toEqual([...PANEL_GAPS].sort())
    expect(FOCUS_META.hours).toEqual({
      label: "Opening hours",
      icon: "mdi:clock-outline",
      tint: FOCUS_TINT.hours,
      phrase: "have hours",
    })
    expect(FOCUS_META.photo).toMatchObject({
      label: "Photos",
      icon: "mdi:camera-outline",
      tint: FOCUS_TINT.photo,
      phrase: "have a photo",
    })
    expect(FOCUS_META.accessibility).toMatchObject({
      label: "Accessibility",
      icon: "mdi:wheelchair-accessibility",
      tint: FOCUS_TINT.accessibility,
      phrase: "have accessibility details",
    })
    expect(FOCUS_META.contact).toMatchObject({
      label: "Contact details",
      icon: "mdi:card-account-phone-outline",
      tint: FOCUS_TINT.contact,
      phrase: "have contact details",
    })
  })
})

describe("unitNoun", () => {
  it("is plural for anything but one", () => {
    expect(unitNoun("library", 0)).toBe("libraries")
    expect(unitNoun("library", 1)).toBe("library")
    expect(unitNoun("branch", 251)).toBe("branches")
    expect(unitNoun("branch", 1)).toBe("branch")
    expect(unitNoun("record", 88)).toBe("records")
  })
})

describe("focusKeysOf", () => {
  it("lists a gaps focus's panel gaps, and verify or record as one key", () => {
    expect(focusKeysOf({ kind: "gaps", gaps: ["hours", "contact"] })).toEqual([
      "hours",
      "contact",
    ])
    expect(focusKeysOf({ kind: "gaps", gaps: ["services"] })).toEqual([])
    expect(
      focusKeysOf({ kind: "verify", sections: ["hours"], before: "2026-01-01" })
    ).toEqual(["verify"])
    expect(focusKeysOf({ kind: "record", target: 80 })).toEqual(["record"])
  })
})

describe("isFocusFilterKey", () => {
  it("accepts the six filter keys only", () => {
    for (const k of [
      "hours",
      "photo",
      "accessibility",
      "contact",
      "verify",
      "record",
    ]) {
      expect(isFocusFilterKey(k)).toBe(true)
    }
    expect(isFocusFilterKey("services")).toBe(false)
    expect(isFocusFilterKey(undefined)).toBe(false)
    expect(isFocusFilterKey(["hours"])).toBe(false)
  })
})

describe("focusChipOf", () => {
  it("uses the gap's own label, icon and tint for one panel gap", () => {
    expect(focusChipOf({ kind: "gaps", gaps: ["photo"] })).toEqual({
      label: "Photos",
      icon: "mdi:camera-outline",
      tint: FOCUS_TINT.photo,
    })
  })

  it("names every gap, led by the first gap's look", () => {
    expect(
      focusChipOf({ kind: "gaps", gaps: ["hours", "contact", "photo"] })
    ).toEqual({
      label: "Opening hours, contact details and photos",
      icon: "mdi:clock-outline",
      tint: FOCUS_TINT.hours,
    })
  })

  it("falls back to the registry label and a neutral tint off the panel", () => {
    expect(focusChipOf({ kind: "gaps", gaps: ["services"] })).toMatchObject({
      label: "Services",
      tint: FOCUS_TINT.other,
    })
  })

  it("labels verify and whole-record drives", () => {
    expect(
      focusChipOf({ kind: "verify", sections: ["hours"], before: "2026-01-01" })
        .label
    ).toBe("Check details")
    expect(focusChipOf({ kind: "record", target: 80 }).label).toBe(
      "Whole record"
    )
  })
})

describe("gapPhraseOf", () => {
  it("is the gap's 'have …' phrase", () => {
    expect(gapPhraseOf({ kind: "gaps", gaps: ["hours"] })).toBe("have hours")
    expect(gapPhraseOf({ kind: "gaps", gaps: ["photo"] })).toBe("have a photo")
  })

  it("joins several gaps after one 'have'", () => {
    expect(gapPhraseOf({ kind: "gaps", gaps: ["hours", "contact"] })).toBe(
      "have hours and contact details"
    )
  })

  it("reads the registry phrase for a gap off the panel", () => {
    expect(gapPhraseOf({ kind: "gaps", gaps: ["address"] })).toBe(
      "have an address"
    )
  })

  it("has phrases for verify and whole-record drives", () => {
    expect(
      gapPhraseOf({ kind: "verify", sections: ["hours"], before: "2026-01-01" })
    ).toBe("have been checked")
    expect(gapPhraseOf({ kind: "record", target: 80 })).toBe("are complete")
  })
})
