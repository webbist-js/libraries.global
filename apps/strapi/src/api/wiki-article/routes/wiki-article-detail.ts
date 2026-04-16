export default {
  routes: [
    {
      method: "GET",
      path: "/wiki-articles/detail/:slug",
      handler: "wiki-article.detail",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/wiki-articles/slugs",
      handler: "wiki-article.slugs",
      config: { auth: false },
    },
  ],
}
