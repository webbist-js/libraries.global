// Auth is enforced in the controller via ctx.state.user checks —
// the standard pattern in this codebase (Strapi v5).
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
