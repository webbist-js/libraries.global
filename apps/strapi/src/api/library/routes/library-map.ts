export default {
  routes: [
    {
      method: "GET",
      path: "/libraries/atlas",
      handler: "library.atlas",
      config: { auth: false },
    },
  ],
}
