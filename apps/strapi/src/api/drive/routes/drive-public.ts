/**
 * drive-public routes.
 *
 * Public reads (`GET /drives`, `GET /drives/by-slug/:slug`,
 * `GET /drives/:documentId/stats`, `GET /drives/:documentId/leaderboard`,
 * `GET /drives/:documentId/in-review`) need no auth and serve only public
 * fields — the leaderboard never carries a `baUserId`.
 * `GET /drives/:documentId/mine` is the caller's own counts: the bridge
 * secret plus `X-Ba-User-Id`, checked in the controller. Board writes
 * (`POST /drives`,
 * `PUT /drives/:documentId`, `POST /drives/:documentId/actions`,
 * `POST /drives/lifecycle/run`) are `auth: false` here too — they are gated
 * in the controller by the Next.js ↔ Strapi bridge secret plus
 * `X-Ba-User-Id`, then by `isBoardMember`, the same two-step pattern as the
 * other bridge-gated routes in this codebase. `/drives/lifecycle/run` runs
 * the same hourly cron step (`runLifecycle`) on demand, for local testing
 * and E2E without waiting for the clock.
 *
 * `POST /drives/:documentId/holds`, `DELETE
 * /drives/:documentId/holds/:libraryDocumentId` and `GET
 * /drives/:documentId/holds` are `auth: false` here too and gated in the
 * controller: the two write routes need the bridge secret plus
 * `X-Ba-User-Id` (signed-in only, no board check — any helper can hold a
 * library); the read needs only the bridge secret, with `X-Ba-User-Id`
 * optional, since a signed-out visitor can still see which rows are held.
 */

export default {
  routes: [
    {
      method: "GET",
      path: "/drives",
      handler: "drive.list",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/drives/by-slug/:slug",
      handler: "drive.bySlug",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/drives",
      handler: "drive.create",
      config: { auth: false },
    },
    {
      method: "PUT",
      path: "/drives/:documentId",
      handler: "drive.update",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/drives/:documentId/actions",
      handler: "drive.act",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/drives/lifecycle/run",
      handler: "drive.runLifecycle",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/drives/:documentId/stats",
      handler: "drive.stats",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/drives/:documentId/leaderboard",
      handler: "drive.leaderboard",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/drives/:documentId/in-review",
      handler: "drive.inReview",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/drives/:documentId/mine",
      handler: "drive.mine",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/drives/:documentId/holds",
      handler: "drive.hold",
      config: { auth: false },
    },
    {
      method: "DELETE",
      path: "/drives/:documentId/holds/:libraryDocumentId",
      handler: "drive.releaseHold",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/drives/:documentId/holds",
      handler: "drive.holds",
      config: { auth: false },
    },
  ],
}
