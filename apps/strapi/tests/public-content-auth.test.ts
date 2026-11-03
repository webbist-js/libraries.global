import { expect, it, vi } from "vitest"

import {
  publicContentStrategy,
  PUBLIC_CONTENT_ACTIONS,
} from "../src/auth/public-content"

it("retains explicit public reads and refuses private models and writes", async () => {
  const ability = {
    can: (scope: string) => PUBLIC_CONTENT_ACTIONS.includes(scope),
  }
  const generateAbility = vi.fn(async () => ability)
  const strategy = publicContentStrategy({
    contentAPI: { permissions: { engine: { generateAbility } } },
  })
  const auth = await strategy.authenticate({
    request: { method: "GET", headers: {} },
  })
  expect(auth.authenticated).toBe(true)
  expect(() =>
    strategy.verify(auth, { scope: "api::library.library.find" })
  ).not.toThrow()
  for (const scope of [
    "api::library.library.create",
    "api::user-profile.user-profile.find",
    "plugin::better-auth.user.find",
  ])
    expect(() => strategy.verify(auth, { scope })).toThrow()
  expect(() => strategy.verify(auth, {})).toThrow()
  await expect(
    strategy.authenticate({
      request: { method: "GET", headers: { authorization: "Bearer invalid" } },
    })
  ).resolves.toEqual({ authenticated: false })
  await expect(
    strategy.authenticate({ request: { method: "POST", headers: {} } })
  ).resolves.toEqual({ authenticated: false })
})
