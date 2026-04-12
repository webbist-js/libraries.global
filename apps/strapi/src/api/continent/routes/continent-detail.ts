export default {
  routes: [
    {
      method: "GET",
      path: "/continents/map-pins",
      handler: "continent.mapPins",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/continents/detail/:slug",
      handler: "continent.detail",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/continents/slugs",
      handler: "continent.slugs",
      config: {
        auth: false,
      },
    },
  ],
}
