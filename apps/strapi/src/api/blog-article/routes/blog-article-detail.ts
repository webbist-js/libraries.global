export default {
  routes: [
    {
      method: "GET",
      path: "/blog-articles/detail/:slug",
      handler: "blog-article.detail",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/blog-articles/slugs",
      handler: "blog-article.slugs",
      config: { auth: false },
    },
  ],
}
