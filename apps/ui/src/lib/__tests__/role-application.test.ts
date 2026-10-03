import { describe, expect, it } from "vitest"

import {
  applicationFields,
  applicationProblem,
  applicationRoleFrom,
  countAccepted,
  latestApplications,
} from "@/lib/role-application"

const LOCALES = ["en", "fr"]
const valid = {
  role: "wiki_editor" as const,
  locales: [] as string[],
  statement: "I have fixed many library records.",
  samples: [""],
}

describe("countAccepted", () => {
  it("counts approved submissions that aren't role applications", () => {
    expect(
      countAccepted([
        { status: "approved", submissionType: "correction" },
        { status: "approved", submissionType: "new_library" },
        { status: "approved", submissionType: "role_application" },
        { status: "pending", submissionType: "correction" },
        { status: "rejected", submissionType: "wiki_edit" },
      ])
    ).toBe(2)
  })
})

describe("latestApplications", () => {
  it("keeps the newest application per role, with its note", () => {
    const got = latestApplications([
      {
        documentId: "b",
        submissionType: "role_application",
        status: "needs_info",
        reviewNote: "Add a sample.",
        fields: { role: "wiki_editor", locales: ["fr"] },
        createdAt: "2026-10-02T00:00:00Z",
      },
      {
        documentId: "a",
        submissionType: "role_application",
        status: "rejected",
        fields: { role: "wiki_editor", locales: [] },
        createdAt: "2026-09-01T00:00:00Z",
      },
      {
        documentId: "c",
        submissionType: "correction",
        status: "approved",
        createdAt: "2026-10-03T00:00:00Z",
      },
    ])
    expect(got).toEqual([
      {
        documentId: "b",
        role: "wiki_editor",
        status: "needs_info",
        locales: ["fr"],
        reviewNote: "Add a sample.",
        createdAt: "2026-10-02T00:00:00Z",
      },
    ])
  })

  it("ignores rows with an unknown role", () => {
    expect(
      latestApplications([
        {
          documentId: "x",
          submissionType: "role_application",
          status: "pending",
          fields: { role: "moderator" },
        },
      ])
    ).toEqual([])
  })
})

describe("applicationRoleFrom", () => {
  it("accepts the two editor roles only", () => {
    expect(applicationRoleFrom("journal_editor")).toBe("journal_editor")
    expect(applicationRoleFrom("wiki_editor")).toBe("wiki_editor")
    expect(applicationRoleFrom("moderator")).toBeNull()
    expect(applicationRoleFrom(undefined)).toBeNull()
  })
})

describe("applicationProblem", () => {
  it("passes a valid application", () => {
    expect(applicationProblem(valid, LOCALES)).toBeNull()
  })

  it("requires a role", () => {
    expect(applicationProblem({ ...valid, role: null }, LOCALES)).toMatch(
      /Knowledge editor or Journal editor/
    )
  })

  it.each([
    ["too short", "x".repeat(19)],
    ["too long", "x".repeat(2001)],
    ["only spaces around a short text", `   ${"x".repeat(19)}   `],
  ])("refuses a statement that is %s", (_label, statement) => {
    expect(applicationProblem({ ...valid, statement }, LOCALES)).toMatch(
      /between 20 and 2000 characters/
    )
  })

  it("accepts the bounds", () => {
    expect(
      applicationProblem({ ...valid, statement: "x".repeat(20) }, LOCALES)
    ).toBeNull()
    expect(
      applicationProblem({ ...valid, statement: "x".repeat(2000) }, LOCALES)
    ).toBeNull()
  })

  it("refuses unconfigured languages", () => {
    expect(applicationProblem({ ...valid, locales: ["de"] }, LOCALES)).toMatch(
      /languages from the list/
    )
  })

  it("refuses more than five links and non-http links", () => {
    expect(
      applicationProblem(
        {
          ...valid,
          samples: Array.from({ length: 6 }, () => "https://example.org"),
        },
        LOCALES
      )
    ).toMatch(/at most 5/)
    expect(
      applicationProblem({ ...valid, samples: ["ftp://example.org"] }, LOCALES)
    ).toMatch(/http or https/)
  })
})

describe("applicationFields", () => {
  it("trims, drops blank links and de-duplicates languages", () => {
    expect(
      applicationFields({
        role: "journal_editor",
        locales: ["fr", "fr"],
        statement: "  I write about libraries.  ",
        samples: [" https://example.org/a ", "", "  "],
      })
    ).toEqual({
      role: "journal_editor",
      locales: ["fr"],
      statement: "I write about libraries.",
      samples: ["https://example.org/a"],
    })
  })
})
