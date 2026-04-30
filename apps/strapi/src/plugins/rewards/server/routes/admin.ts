export default {
  type: "admin",
  routes: [
    {
      method: "GET",
      path: "/events",
      handler: "rewards.adminEvents",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "POST",
      path: "/award",
      handler: "rewards.adminAward",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/stats",
      handler: "rewards.adminStats",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
    {
      method: "GET",
      path: "/chart-data",
      handler: "rewards.adminChartData",
      config: {
        policies: ["admin::isAuthenticatedAdmin"],
      },
    },
  ],
}
