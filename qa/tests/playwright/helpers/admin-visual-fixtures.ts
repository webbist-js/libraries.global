import type { Page } from "@playwright/test"

/** Visual data is fixed and synthetic; authentication and RBAC stay native.
 * Native controller/permission checks live in permissions.spec.ts. */
export async function emptyPluginFixtures(page: Page) {
  const fixtures: Record<string, unknown> = {
    "/access/people": { data: [] },
    "/events/admin/credentials": [],
    "/events/admin/pending-review": { data: [], meta: { total: 0 } },
    "/events/admin/worker-health": { ok: false, status: "unreachable" },
    "/rewards/stats": { totalContributors: 0, pointsThisMonth: 0 },
    // Zero-filled daily buckets must render the empty explanation, not a blank chart.
    "/rewards/chart-data": {
      dailyPoints: [{ date: "2026-01-01", points: 0 }],
      actionBreakdown: [],
    },
    "/rewards/events": { data: [], meta: { total: 0, page: 1, limit: 25 } },
    "/content-moderation/submissions": {
      data: [],
      meta: { total: 0, counts: {} },
    },
    "/beta-invites/subscribers": {
      data: [],
      total: 0,
      counts: {},
      sendingAvailable: true,
    },
    ...Object.fromEntries(
      ["revisions", "reports", "subjects", "threads", "sanctions"].map(
        (name) => [`/discussions/${name}`, { data: [], nextOffset: null }]
      )
    ),
  }
  await page.route("**/*", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    await (request.method() === "GET" && Object.hasOwn(fixtures, path)
      ? route.fulfill({ json: fixtures[path] })
      : route.continue())
  })
}
