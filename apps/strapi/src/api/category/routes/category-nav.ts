export default {
  routes: [
    {
      method: "GET",
      path: "/categories/nav",
      handler: "category.nav",
      config: { auth: false },
    },
  ],
}
