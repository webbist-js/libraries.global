import { describe, it, expect } from "vitest"

import { parseNetworkRequest, NETWORK_LIMITS, networkHref } from "../networks"

const id = "library00000000000000001"
const input = {
  intent: "management",
  role: " Manager ",
  note: "Institutional responsibility",
  libraryIds: [id, id],
  staffRole: "owner",
}
describe("Network request contract", () => {
  it("pins explicit responsibility and deduplicates library identities", () => {
    const parsed = parseNetworkRequest(input)
    expect(parsed.staffRole).toBe("owner")
    expect(parsed.role).toBe("Manager")
    expect(parsed.libraryIds).toEqual([id])
    expect(
      parseNetworkRequest({ ...input, staffRole: undefined }).staffRole
    ).toBe("editor")
  })
  it("rejects script and credential-bearing evidence URLs", () => {
    expect(() =>
      // eslint-disable-next-line sonarjs/code-eval -- hostile URL fixture is rejected, never evaluated.
      parseNetworkRequest({ ...input, evidenceUrl: "javascript:alert(1)" })
    ).toThrow()
    expect(() =>
      parseNetworkRequest({
        ...input,
        evidenceUrl: "https://user:password@example.org",
      })
    ).toThrow()
    expect(() =>
      parseNetworkRequest({ ...input, staffRole: "administrator" })
    ).toThrow()
  })
  it("bounds a service-wide request and gives multinational networks one canonical path", () => {
    expect(() =>
      parseNetworkRequest({
        ...input,
        libraryIds: Array.from(
          { length: NETWORK_LIMITS.libraries + 1 },
          (_, i) => `library${String(i).padStart(17, "0")}`
        ),
      })
    ).toThrow()
    expect(networkHref("international-service")).toBe(
      "/library-networks/international-service"
    )
  })
})
