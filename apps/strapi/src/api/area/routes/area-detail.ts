export default {
  routes: [
    {
      method: "GET",
      path: "/areas/detail/:slug",
      handler: "area.detail",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/areas/slugs",
      handler: "area.slugs",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/areas/map-pins",
      handler: "area.mapPins",
      config: { auth: false },
    },
  ],
}
