import { describe, expect, it } from "vitest"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants"

import { authErrorParts } from "../auth-error"
import { newPasswordRefusal, newPasswordSchema } from "../password-rules"

describe("newPasswordSchema", () => {
  it("takes the lengths Better Auth takes", () => {
    expect(
      newPasswordSchema.safeParse("a".repeat(PASSWORD_MIN_LENGTH)).success
    ).toBe(true)
    expect(
      newPasswordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH)).success
    ).toBe(true)
  })

  it("refuses short and long passwords with a field message", () => {
    const short = newPasswordSchema.safeParse(
      "a".repeat(PASSWORD_MIN_LENGTH - 1)
    )
    expect(short.success).toBe(false)
    expect(short.error?.issues[0]?.message).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters`
    )
    expect(
      newPasswordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success
    ).toBe(false)
  })

  it("doesn't demand digits or symbols: unrelated words are fine", () => {
    expect(newPasswordSchema.safeParse("paper lantern orbit").success).toBe(
      true
    )
  })
})

describe("newPasswordRefusal", () => {
  it("turns Better Auth's length codes into field messages", () => {
    expect(newPasswordRefusal("PASSWORD_TOO_SHORT")).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters`
    )
    expect(newPasswordRefusal("PASSWORD_TOO_LONG")).toBe(
      `Keep it to ${PASSWORD_MAX_LENGTH} characters or fewer`
    )
    expect(newPasswordRefusal("INVALID_TOKEN")).toBeNull()
    expect(newPasswordRefusal(undefined)).toBeNull()
  })
})

describe("authErrorParts", () => {
  it("reads Better Auth's plain error object", () => {
    expect(
      authErrorParts({
        status: 400,
        code: "INVALID_PASSWORD",
        message: "Invalid password",
      })
    ).toEqual({
      status: 400,
      code: "INVALID_PASSWORD",
      message: "Invalid password",
    })
  })

  it("tolerates nothing at all", () => {
    expect(authErrorParts(null)).toEqual({})
    expect(authErrorParts(undefined)).toEqual({})
  })
})
