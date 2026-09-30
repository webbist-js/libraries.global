export default {
  routes: [
    {
      // Public: slug + locale + location slugs for sitemaps and static
      // params, paged with `start` and a `limit` capped at 1000.
      method: "GET",
      path: "/libraries/slugs",
      handler: "library.slugs",
      config: { auth: false },
    },
  ],
}
