import { describe, expect, it } from "vitest"

import { cleanIsbn, isValidIsbn, toIsbn13 } from "../src/isbn"

describe("isbn", () => {
  it("cleans hyphens, spaces and lower-case x", () => {
    expect(cleanIsbn(" 0-8044-2957-x ")).toBe("080442957X")
  })

  it.each(["9781408855652", "978-0-14-118776-1", "080442957X", "0747532699"])(
    "accepts %s",
    (isbn) => expect(isValidIsbn(isbn)).toBe(true)
  )

  it.each(["9781408855653", "12345", "978140885565X", "0747532698", ""])(
    "rejects %s",
    (isbn) => expect(isValidIsbn(isbn)).toBe(false)
  )

  it("converts ISBN-10 to ISBN-13", () => {
    expect(toIsbn13("0747532699")).toBe("9780747532699")
    expect(toIsbn13("9781408855652")).toBe("9781408855652")
  })
})
