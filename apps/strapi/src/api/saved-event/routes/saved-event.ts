// These routes are called server-to-server by Next.js only. They are
// `auth: false` at the Strapi level because the caller is authenticated by the
// bridge secret, and the user by the X-Ba-User-Id header that Next.js sets from
// the Better Auth session — both checked in the controller.
export default {
  routes: [
    {
      method: "GET",
      path: "/saved-events",
      handler: "saved-event.find",
      config: { auth: false, policies: [] },
    },
    {
      method: "POST",
      path: "/saved-events",
      handler: "saved-event.create",
      config: { auth: false, policies: [] },
    },
    {
      method: "DELETE",
      path: "/saved-events/:id",
      handler: "saved-event.delete",
      config: { auth: false, policies: [] },
    },
  ],
}
