export default {
  routes: [
    {
      method: "GET",
      path: "/saved-events",
      handler: "saved-event.find",
      config: { middlewares: ["plugin::users-permissions.isAuthenticated"] },
    },
    {
      method: "POST",
      path: "/saved-events",
      handler: "saved-event.create",
      config: { middlewares: ["plugin::users-permissions.isAuthenticated"] },
    },
    {
      method: "DELETE",
      path: "/saved-events/:id",
      handler: "saved-event.delete",
      config: { middlewares: ["plugin::users-permissions.isAuthenticated"] },
    },
  ],
}
