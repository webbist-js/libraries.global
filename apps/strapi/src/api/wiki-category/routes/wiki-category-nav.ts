export default {
  routes: [
    {
      method: "GET",
      path: "/wiki-categories/nav",
      handler: "wiki-category.nav",
      config: { auth: false },
    },
  ],
}
