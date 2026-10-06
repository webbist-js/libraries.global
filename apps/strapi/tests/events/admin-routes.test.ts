import { describe, expect, it } from "vitest"

import evRoutes from "../../src/plugins/events/server/routes/admin"

const hasPolicy = (r: any, name: string) =>
  r.config.policies.some(
    (p: any) => p === name || (typeof p === "object" && p.name === name)
  )

const perm = (r: any) =>
  r.config.policies.find(
    (p: any) => typeof p === "object" && p.name === "admin::hasPermissions"
  )?.config.actions

const byPath = (method: string, path: string) =>
  evRoutes.find((r: any) => r.method === method && r.path === path)

describe("events admin routes", () => {
  it("every route requires an authenticated admin and a permission", () => {
    expect(evRoutes.length).toBeGreaterThan(0)
    for (const r of evRoutes) {
      expect(hasPolicy(r, "admin::isAuthenticatedAdmin"), r.path).toBe(true)
      expect(hasPolicy(r, "admin::hasPermissions"), r.path).toBe(true)
      expect(perm(r)?.length, r.path).toBeGreaterThan(0)
      for (const action of perm(r)) {
        expect(action, r.path).toMatch(/^plugin::events\./)
      }
    }
  })

  it("reads need read, credential writes need manage-credentials, review needs review", () => {
    expect(perm(byPath("GET", "/admin/credentials"))).toEqual([
      "plugin::events.read",
    ])
    expect(perm(byPath("GET", "/admin/runs"))).toEqual(["plugin::events.read"])
    expect(perm(byPath("GET", "/admin/runs/:runId"))).toEqual([
      "plugin::events.read",
    ])
    expect(perm(byPath("GET", "/admin/worker-health"))).toEqual([
      "plugin::events.read",
    ])
    expect(perm(byPath("GET", "/admin/pending-review"))).toEqual([
      "plugin::events.read",
    ])

    for (const [method, path] of [
      ["POST", "/admin/credentials"],
      ["PUT", "/admin/credentials/:documentId"],
      ["DELETE", "/admin/credentials/:documentId"],
      ["POST", "/admin/credentials/:documentId/test"],
      ["POST", "/admin/sync"],
    ]) {
      expect(perm(byPath(method, path)), `${method} ${path}`).toEqual([
        "plugin::events.manage-credentials",
      ])
    }

    expect(perm(byPath("PATCH", "/admin/pending-review/:documentId"))).toEqual([
      "plugin::events.review",
    ])
  })

  it("has no test-raw route", () => {
    expect(byPath("POST", "/admin/credentials/test-raw")).toBeUndefined()
  })

  it("gates reveal behind its own permission", () => {
    const route = evRoutes.find(
      (r: any) => r.path === "/admin/credentials/:documentId/reveal"
    )
    expect(route.method).toBe("POST")
    expect(route.config.policies[1].config.actions).toEqual([
      "plugin::events.reveal-credentials",
    ])
  })
})
