export default {
  routes: [
    {
      // Public: slug + locale + location slugs for sitemaps and static
      // params, paged by keyset (`after`) with a `limit` capped at 1000.
      method: "GET",
      path: "/libraries/slugs",
      handler: "library.slugs",
      config: { auth: false },
    },
    {
      // Public: how many rows /libraries/slugs walks, to size sitemap files.
      method: "GET",
      path: "/libraries/slugs/count",
      handler: "library.slugsCount",
      config: { auth: false },
    },
    {
      // Public: published-library counts per location slug path.
      method: "GET",
      path: "/libraries/location-counts",
      handler: "library.locationCounts",
      config: { auth: false },
    },
  ],
}
