import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/constants"

import messages from "../../../../../../locales/en"
import { authErrorParts } from "../auth-error"
import { newPasswordRefusal, newPasswordSchema } from "../password-rules"

const t = createTranslator({ locale: "en", messages, namespace: "staticUi" })
const schema = newPasswordSchema(t)

describe("newPasswordSchema", () => {
  it("takes the lengths Better Auth takes", () => {
    expect(schema.safeParse("a".repeat(PASSWORD_MIN_LENGTH)).success).toBe(true)
    expect(schema.safeParse("a".repeat(PASSWORD_MAX_LENGTH)).success).toBe(true)
  })

  it("refuses short and long passwords with a field message", () => {
    const short = schema.safeParse("a".repeat(PASSWORD_MIN_LENGTH - 1))
    expect(short.success).toBe(false)
    expect(short.error?.issues[0]?.message).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters`
    )
    expect(schema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(
      false
    )
  })

  it("doesn't demand digits or symbols: unrelated words are fine", () => {
    expect(schema.safeParse("paper lantern orbit").success).toBe(true)
  })
})

describe("newPasswordRefusal", () => {
  it("turns Better Auth's length codes into field messages", () => {
    expect(newPasswordRefusal("PASSWORD_TOO_SHORT", t)).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters`
    )
    expect(newPasswordRefusal("PASSWORD_TOO_LONG", t)).toBe(
      `Keep it to ${PASSWORD_MAX_LENGTH} characters or fewer`
    )
    expect(newPasswordRefusal("INVALID_TOKEN", t)).toBeNull()
    expect(newPasswordRefusal(undefined, t)).toBeNull()
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
