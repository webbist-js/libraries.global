export default {
  routes: [
    {
      method: "GET",
      path: "/sitemap/pages",
      handler: "sitemap.pages",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/sitemap/:source/count",
      handler: "sitemap.count",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/sitemap/:source",
      handler: "sitemap.rows",
      config: { auth: false },
    },
  ],
}
