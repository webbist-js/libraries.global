export default [
  {
    method: "GET",
    path: "/library/:entityRef",
    handler: "events.library",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/location",
    handler: "events.location",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/global",
    handler: "events.global",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/this-week",
    handler: "events.thisWeek",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/stats",
    handler: "events.stats",
    config: { auth: false, policies: [] },
  },
]
