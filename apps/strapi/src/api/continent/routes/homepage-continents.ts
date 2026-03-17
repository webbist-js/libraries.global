export default {
  routes: [
    {
      method: "GET",
      path: "/homepage/continents",
      handler: "continent.homepage",
      config: {
        auth: false,
      },
    },
  ],
}
