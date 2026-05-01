export default {
  routes: [
    {
      method: "GET",
      path: "/user-profiles/by-username/:username",
      handler: "user-profile.findByUsername",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/user-profiles/by-username/:username/badges",
      handler: "user-profile.findBadgesByUsername",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
