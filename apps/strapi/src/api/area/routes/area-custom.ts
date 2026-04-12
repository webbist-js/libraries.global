export default {
  routes: [
    {
      method: "GET",
      path: "/areas/map-pins",
      handler: "area.mapPins",
      config: {
        auth: false,
      },
    },
  ],
}
