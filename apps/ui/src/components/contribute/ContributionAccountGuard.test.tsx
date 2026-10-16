// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { cleanup, render, screen } from "@/test/render"

import { ContributionAccountGuard } from "./ContributionAccountGuard"

Object.assign(globalThis, { React })
const actor = vi.hoisted(() => ({
  data: null as { user: { id: string } } | null,
  pending: true,
  path: "/contribute",
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: actor.data, isPending: actor.pending }),
}))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => actor.path,
  useRouter: () => ({ refresh: vi.fn() }),
}))
afterEach(cleanup)
describe("contribution account boundary", () => {
  it("preserves anonymous public hub content while hiding private pending session content", () => {
    actor.data = null
    actor.pending = true
    actor.path = "/contribute"
    const view = render(
      <ContributionAccountGuard expectedScope="guest">
        Public contribution hub
      </ContributionAccountGuard>
    )
    expect(screen.getByText("Public contribution hub")).toBeTruthy()
    view.unmount()
    actor.path = "/contribute/submissions"
    render(
      <ContributionAccountGuard
        expectedScope={contributionAccountScope({ id: "a" })}
      >
        Private saved draft
      </ContributionAccountGuard>
    )
    expect(screen.queryByText("Private saved draft")).toBeNull()
    expect(screen.getByText("Checking your session…")).toBeTruthy()
  })
  it("allows matching hydrated guest children to perform their server-authorized auth redirect", () => {
    actor.data = null
    actor.pending = true
    actor.path = "/contribute/knowledge/new"
    const authRedirect = vi.fn()
    function ServerAuthorizedAuthRedirect() {
      authRedirect()

      return <p>Sign in to write</p>
    }
    const view = render(
      <ContributionAccountGuard expectedScope="guest">
        <ServerAuthorizedAuthRedirect />
      </ContributionAccountGuard>
    )
    expect(screen.queryByText("Sign in to write")).toBeNull()
    expect(authRedirect).not.toHaveBeenCalled()
    actor.pending = false
    view.rerender(
      <ContributionAccountGuard expectedScope="guest">
        <ServerAuthorizedAuthRedirect />
      </ContributionAccountGuard>
    )
    expect(screen.getByText("Sign in to write")).toBeTruthy()
    expect(authRedirect).toHaveBeenCalledOnce()
    expect(screen.queryByText(/Your account or permissions changed/)).toBeNull()
  })
  it("canonicalizes equivalent permission order but distinguishes account and locale scopes", () => {
    expect(
      contributionAccountScope({
        id: "a",
        editorLocales: { journal: ["fr", "en"] },
      })
    ).toBe(
      contributionAccountScope({
        id: "a",
        editorLocales: { journal: ["en", "fr"] },
      })
    )
    expect(
      contributionAccountScope({ id: "a", editorLocales: { journal: ["en"] } })
    ).not.toBe(
      contributionAccountScope({ id: "a", editorLocales: { journal: ["fr"] } })
    )
    expect(contributionAccountScope({ id: "a" })).not.toBe(
      contributionAccountScope({ id: "b" })
    )
  })
})
