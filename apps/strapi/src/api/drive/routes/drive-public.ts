/**
 * drive-public routes.
 *
 * Public reads (`GET /drives`, `GET /drives/by-slug/:slug`,
 * `GET /drives/:documentId/stats`, `GET /drives/:documentId/leaderboard`)
 * need no auth and serve only public fields — the leaderboard never carries
 * a `baUserId`. Board writes (`POST /drives`,
 * `PUT /drives/:documentId`, `POST /drives/:documentId/actions`) are
 * `auth: false` here too — they are gated in the controller by the
 * Next.js ↔ Strapi bridge secret plus `X-Ba-User-Id`, then by
 * `isBoardMember`, the same two-step pattern as the other bridge-gated
 * routes in this codebase.
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
  ],
}
