import { afterEach, expect, it, vi } from "vitest"

import { registerFreshAuthorityMiddleware } from "../src/documentMiddlewares/fresh-authority"
import { requireFreshAdminAuth } from "../src/utils/fresh-admin-auth"

vi.mock("../src/utils/fresh-admin-auth", () => ({
  requireFreshAdminAuth: vi.fn(),
}))
afterEach(() => vi.resetAllMocks())
function fixture(ctx?: object) {
  let middleware: (
    context: { uid: string; action: string },
    next: () => Promise<void>
  ) => Promise<unknown>
  registerFreshAuthorityMiddleware({
    strapi: {
      documents: {
        use: (handler: typeof middleware) => {
          middleware = handler
        },
      },
      requestContext: { get: () => ctx },
    } as never,
  })

  return (uid: string, action: string, next = vi.fn(async () => {})) => ({
    next,
    result: middleware({ uid, action }, next),
  })
}
it("blocks authority writes from a stale CMS admin session before the model changes", async () => {
  vi.mocked(requireFreshAdminAuth).mockResolvedValue(false)
  const { result, next } = fixture({ state: { user: { id: 1 } } })(
    "api::role-grant.role-grant",
    "create"
  )
  await expect(result).rejects.toThrow("Sign out and sign back in")
  expect(next).not.toHaveBeenCalled()
})
it("allows authority changes after a fresh administrator sign-in", async () => {
  vi.mocked(requireFreshAdminAuth).mockResolvedValue(true)
  const { result, next } = fixture({ state: { user: { id: 1 } } })(
    "plugin::access.team-member",
    "update"
  )
  await result
  expect(next).toHaveBeenCalledOnce()
})
it("keeps non-browser fulfilment and unrelated content independent of CMS sign-in", async () => {
  await fixture()("plugin::access.team-member", "create").result
  await fixture({ state: { user: { id: 1 } } })(
    "api::wiki-article.wiki-article",
    "update"
  ).result
  expect(requireFreshAdminAuth).not.toHaveBeenCalled()
})
