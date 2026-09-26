export default {
  routes: [
    {
      method: "GET",
      path: "/homepage/stats",
      handler: "homepage.stats",
      config: {
        auth: false,
      },
    },
  ],
}
