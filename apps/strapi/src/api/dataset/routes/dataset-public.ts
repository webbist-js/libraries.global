export default {
  routes: [
    {
      method: "GET",
      path: "/datasets/by-key/:key",
      handler: "dataset.byKey",
      config: { auth: false },
    },
  ],
}
