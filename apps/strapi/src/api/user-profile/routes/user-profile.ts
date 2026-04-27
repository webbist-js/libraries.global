export default {
  routes: [
    {
      method: "GET",
      path: "/user-profiles/by-username/:username",
      handler: "user-profile.findByUsername",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
