export default {
  routes: [
    {
      method: "GET",
      path: "/supporters",
      handler: "supporters.find",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
