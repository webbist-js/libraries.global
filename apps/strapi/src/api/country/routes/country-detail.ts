export default {
  routes: [
    {
      method: "GET",
      path: "/countries/detail/:slug",
      handler: "country.detail",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/countries/slugs",
      handler: "country.slugs",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/countries/map-pins",
      handler: "country.mapPins",
      config: {
        auth: false,
      },
    },
  ],
}
