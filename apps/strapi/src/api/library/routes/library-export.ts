export default {
  routes: [
    {
      // Bridge only: the controller checks X-Service-Secret.
      method: "POST",
      path: "/libraries/export",
      handler: "library-export.exportRows",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
