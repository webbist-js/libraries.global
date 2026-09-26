const can = (action: "read" | "award") => [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: [`plugin::rewards.${action}`] },
  },
]

export default [
  {
    method: "GET",
    path: "/events",
    handler: "rewards.adminEvents",
    config: { policies: can("read") },
  },
  {
    method: "PUT",
    path: "/award",
    handler: "rewards.adminAward",
    config: { policies: can("award") },
  },
  {
    method: "GET",
    path: "/stats",
    handler: "rewards.adminStats",
    config: { policies: can("read") },
  },
  {
    method: "GET",
    path: "/chart-data",
    handler: "rewards.adminChartData",
    config: { policies: can("read") },
  },
  {
    method: "POST",
    path: "/snapshot",
    handler: "rewards.adminTakeSnapshot",
    config: { policies: can("award") },
  },
]
