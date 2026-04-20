export default {
  routes: [
    {
      method: "GET",
      path: "/wiki-sections/nav",
      handler: "wiki-section.nav",
      config: { auth: false },
    },
  ],
}
