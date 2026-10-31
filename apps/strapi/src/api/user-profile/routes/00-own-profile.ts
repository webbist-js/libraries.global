// This file must sort before 01-core-user-profile.ts. Route files load in
// name order and the first matching route answers, so the core findOne route
// (`/user-profiles/:id`) would otherwise take `/user-profiles/me`.
export default {
  routes: [
    {
      method: "GET",
      path: "/user-profiles/check-username",
      handler: "user-profile.checkUsername",
      config: { auth: false, policies: [] },
    },
    {
      // Bridge only: the controller checks X-Service-Secret and reads the
      // Better Auth id from X-Ba-User-Id, which the UI server sets from the
      // session. `baUserId` is private, so the core find can't filter on it.
      method: "GET",
      path: "/user-profiles/me",
      handler: "user-profile.findMe",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
