export default {
  routes: [
    {
      method: "GET",
      path: "/libraries/map-pins",
      handler: "library.mapPins",
      config: { auth: false },
    },
  ],
}
