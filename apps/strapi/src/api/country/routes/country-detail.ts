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
      path: "/countries/atlas",
      handler: "country.atlasList",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/countries/atlas/:slug/places",
      handler: "country.atlasPlaces",
      config: {
        auth: false,
      },
    },
    {
      method: "GET",
      path: "/countries/atlas/:slug",
      handler: "country.atlasDetail",
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
  ],
}
