// Called server-to-server by Next.js only: `auth: false` here because the
// caller is authenticated by the bridge secret and the user by the
// X-Ba-User-Id header Next.js sets from the session, both checked in the
// controller. Next.js also sends the plan's limit for the kind being saved.
export default {
  routes: [
    {
      method: "GET",
      path: "/saved-views",
      handler: "saved-view.find",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/saved-views",
      handler: "saved-view.create",
      config: { auth: false, policies: [] },
    },
    {
      method: "DELETE",
      path: "/saved-views/:id",
      handler: "saved-view.delete",
      config: { auth: false, policies: [] },
    },
  ],
}
