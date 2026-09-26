export default {
  routes: [
    {
      method: "GET",
      path: "/libraries/map-pins",
      handler: "library.mapPins",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/libraries/atlas",
      handler: "library.atlas",
      config: { auth: false },
    },
  ],
}
