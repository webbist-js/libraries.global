export default {
  routes: [
    {
      method: "POST",
      path: "/notifications/operations",
      handler: "notification.operations",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/notifications/inbox",
      handler: "notification.inbox",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/notifications/read",
      handler: "notification.read",
      config: { auth: false },
    },
  ],
}
