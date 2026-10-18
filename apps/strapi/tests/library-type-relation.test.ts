import { emptyTimetable } from "@repo/shared-data"
import { describe, expect, it, vi } from "vitest"

import { findLibrariesForExport } from "../src/utils/library-export"
import { librarySearchFields } from "../src/utils/library-search-fields"
import {
  registerLibraryTypeValidation,
  resolveLibraryType,
} from "../src/utils/library-type-catalogue"

const type = { documentId: "type00000000000000000001", name: "Community" }

describe("library type relation", () => {
  it("resolves a named import into a relation to the published catalogue", async () => {
    let middleware: any
    const findMany = vi.fn(async () => [type])
    const documents = Object.assign(
      vi.fn(() => ({ findMany })),
      {
        use: (fn: any) => {
          middleware = fn
        },
      }
    )
    registerLibraryTypeValidation({ documents })
    const ctx = {
      uid: "api::library.library",
      action: "create",
      params: { data: { libraryType: "Community" } },
    }
    const next = vi.fn()
    await middleware(ctx, next)
    expect(ctx.params.data.libraryType).toEqual({
      set: [{ documentId: type.documentId }],
    })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" })
    )
    expect(next).toHaveBeenCalledOnce()
    const unchanged = {
      uid: "api::library.library",
      action: "update",
      params: {
        data: {
          name: "Edited name",
          libraryType: { connect: [], disconnect: [] },
        },
      },
    }
    await middleware(unchanged, next)
    expect(unchanged.params.data).toEqual({ name: "Edited name" })
    expect(findMany).toHaveBeenCalledOnce()
  })

  it("accepts native single-relation input and rejects missing, multiple and unpublished choices", async () => {
    const documents = vi.fn(() => ({ findMany: vi.fn(async () => [type]) }))
    expect(
      await resolveLibraryType(
        { documents },
        { connect: [{ documentId: type.documentId }] }
      )
    ).toEqual(type)
    expect(
      await resolveLibraryType(
        {
          documents,
          db: {
            query: () => ({
              findOne: async () => ({ documentId: type.documentId }),
            }),
          },
        },
        { id: 17 }
      )
    ).toEqual(type)
    await expect(
      resolveLibraryType({ documents }, { set: [] })
    ).rejects.toThrow(/one published/)
    await expect(
      resolveLibraryType({ documents }, { connect: [type, type] })
    ).rejects.toThrow(/one published/)
    await expect(resolveLibraryType({ documents }, null)).rejects.toThrow(
      /published/
    )
    await expect(
      resolveLibraryType(
        { documents: () => ({ findMany: async () => [] }) },
        "Withdrawn"
      )
    ).rejects.toThrow(/published/)
  })

  it("keeps names in exports and recognises populated Mobile relations in search projections", async () => {
    const rows = await findLibrariesForExport(
      {
        documents: () => ({
          findMany: async () => [{ documentId: "library", libraryType: type }],
        }),
      } as any,
      ["library"]
    )
    expect(rows.library?.libraryType).toBe("Community")
    const timetable = {
      ...emptyTimetable("2026-10-05"),
      visits: [
        {
          id: "visit00001",
          stopId: "stop000001",
          day: "mon",
          arrive: "09:00",
          depart: "09:30",
          repeat: { kind: "cycle", weeks: [1] },
          termTimeOnly: false,
          validFrom: null,
          validTo: null,
        },
      ],
      stops: [
        {
          id: "stop000001",
          name: "Village",
          where: "Square",
          location: null,
          areaDocumentId: null,
        },
      ],
    }
    expect(
      librarySearchFields(
        { libraryType: { name: "Mobile" }, mobileTimetable: timetable },
        null,
        null
      )
    ).toMatchObject({ stop_count: 1 })
  })
})
