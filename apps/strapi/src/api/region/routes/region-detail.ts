export default {
  routes: [
    {
      method: "GET",
      path: "/regions/detail/:slug",
      handler: "region.detail",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/regions/slugs",
      handler: "region.slugs",
      config: {
        auth: false,
      },
    },
  ],
}
