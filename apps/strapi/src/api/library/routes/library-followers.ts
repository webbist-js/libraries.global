export default {
  routes: [
    {
      // Public: returns an anonymous count only.
      method: "GET",
      path: "/libraries/:documentId/followers",
      handler: "library-followers.count",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
