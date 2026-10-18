export default {
  routes: [
    {
      method: "GET",
      path: "/blog-articles/browse",
      handler: "blog-browse.browse",
      config: { auth: false },
    },
  ],
}
