export default {
  routes: [
    {
      method: "GET",
      path: "/wiki-articles/browse",
      handler: "wiki-browse.browse",
      config: { auth: false },
    },
  ],
}
