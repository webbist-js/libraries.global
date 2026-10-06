import { beforeEach, describe, expect, it } from "vitest"

import {
  aadFor,
  openValues,
  sealValues,
} from "../../src/plugins/events/server/utils/credential-crypto"

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "b".repeat(64)
  delete process.env.EVENTS_CREDENTIAL_KEY_PREV
})

describe("credential slots", () => {
  it("binds the current slot to the documentId and the pending slot apart", () => {
    expect(aadFor("doc1", "current")).toBe("doc1")
    expect(aadFor("doc1", "pending")).toBe("doc1:pending")
  })

  it("round-trips a value in each slot", () => {
    const v = { apiKey: "secret-value-123" }
    expect(
      openValues(sealValues(v, "doc1", "current"), "doc1", "current")
    ).toEqual(v)
    expect(
      openValues(sealValues(v, "doc1", "pending"), "doc1", "pending")
    ).toEqual(v)
  })

  it("refuses a value moved between slots or rows", () => {
    const blob = sealValues({ apiKey: "x" }, "doc1", "pending")
    expect(() => openValues(blob, "doc1", "current")).toThrow()
    expect(() => openValues(blob, "doc2", "pending")).toThrow()
  })
})
