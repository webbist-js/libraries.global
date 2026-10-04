import { describe, expect, it } from "vitest"

import { isPromptHidden, promptCookieName } from "../dismissed-prompts"

const jar = (...names: string[]) => ({
  has: (name: string) => names.includes(name),
})

describe("isPromptHidden", () => {
  it("shows the prompt with no cookie and no saved setting", () => {
    expect(isPromptHidden("find-contribute", jar(), null)).toBe(false)
    expect(
      isPromptHidden("find-contribute", jar(), { dismissedPrompts: [] })
    ).toBe(false)
  })

  it("hides it for the session with the cookie, signed in or not", () => {
    const cookies = jar(promptCookieName("find-contribute"))

    expect(isPromptHidden("find-contribute", cookies, null)).toBe(true)
    expect(
      isPromptHidden("find-contribute", cookies, { dismissedPrompts: [] })
    ).toBe(true)
  })

  it("hides it when the signed-in user's settings say so", () => {
    expect(
      isPromptHidden("find-contribute", jar(), {
        dismissedPrompts: ["find-contribute"],
      })
    ).toBe(true)
  })
})
