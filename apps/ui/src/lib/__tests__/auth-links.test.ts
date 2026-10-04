import { describe, expect, it } from "vitest"

import {
  linkLifetime,
  MAGIC_LINK_TTL_SECONDS,
  RESET_LINK_TTL_SECONDS,
  VERIFICATION_LINK_TTL_SECONDS,
} from "../auth-links"

describe("linkLifetime", () => {
  it("names the lifetimes the auth pages promise", () => {
    expect(linkLifetime(VERIFICATION_LINK_TTL_SECONDS)).toBe("one hour")
    expect(linkLifetime(MAGIC_LINK_TTL_SECONDS)).toBe("5 minutes")
    expect(linkLifetime(RESET_LINK_TTL_SECONDS)).toBe("one hour")
  })

  it("uses hours only for whole hours", () => {
    expect(linkLifetime(2 * 3600)).toBe("2 hours")
    expect(linkLifetime(90 * 60)).toBe("90 minutes")
    expect(linkLifetime(60)).toBe("one minute")
  })
})
