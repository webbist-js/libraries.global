import { describe, it, expect } from "vitest"

import { matchVenueToLibrary } from "../../src/pipeline/match-libraries"
import type { LibraryHint } from "../../src/providers/types"

const HINTS: LibraryHint[] = [
  {
    id: 1,
    documentId: "abc",
    entityRef: "GB-MCL-001",
    name: "Manchester Central Library",
  },
  {
    id: 2,
    documentId: "def",
    entityRef: "GB-MCL-002",
    name: "Didsbury Library",
  },
  {
    id: 3,
    documentId: "ghi",
    entityRef: "GB-MCL-003",
    name: "Wythenshawe Library",
  },
]

describe("matchVenueToLibrary", () => {
  it("returns confident match for exact name", () => {
    const r = matchVenueToLibrary("Manchester Central Library", HINTS)
    expect(r.result).toBe("confident")
    expect(r.library?.id).toBe(1)
  })

  it("returns confident match for near-identical name", () => {
    const r = matchVenueToLibrary("Manchester Central Librarry", HINTS)
    expect(r.result).toBe("confident")
  })

  it("returns review for partial match", () => {
    const r = matchVenueToLibrary("Manchester Library", HINTS)
    expect(r.result).toBe("review")
  })

  it("returns none for unrelated venue", () => {
    const r = matchVenueToLibrary("The Red Lion Pub", HINTS)
    expect(r.result).toBe("none")
    expect(r.library).toBeNull()
  })
})
