import { emptyTimetable } from "@repo/shared-data"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import MobileTimetableInput from "../src/admin/custom-fields/mobile-timetable/Input"

const field = vi.hoisted(() => ({ value: null as unknown }))

vi.mock("@strapi/strapi/admin", () => ({
  useField: () => ({ value: field.value, onChange: vi.fn() }),
}))
vi.mock("@strapi/design-system", () => {
  const container = ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children)

  return {
    Alert: container,
    Box: container,
    Button: container,
    Flex: container,
    Typography: container,
    Field: {
      Root: container,
      Label: container,
      Hint: container,
      Error: container,
    },
  }
})

describe("mobile timetable admin field", () => {
  it("preserves the spaces being typed in stop names and landmarks", () => {
    field.value = {
      ...emptyTimetable("2026-10-05"),
      stops: [
        {
          id: "stop000001",
          name: "Village ",
          where: "Outside the ",
          location: null,
          areaDocumentId: null,
        },
      ],
    }

    const html = renderToStaticMarkup(
      createElement(MobileTimetableInput, { name: "mobileTimetable" })
    )

    expect(html).toContain('value="Village "')
    expect(html).toContain('value="Outside the "')
  })
})
